/**
 * Scorer Factory
 *
 * Bridges AgentC2's scorecard system with Mastra's createScorer primitive.
 * Creates MastraScorer instances from scorecard criteria for async evaluation via Inngest.
 *
 * Three scorer types:
 * 1. Heuristic scorer (JS-only, zero LLM cost) - fast deterministic checks
 * 2. Bulk scorecard scorer (single LLM call) - evaluates all criteria at once
 * 3. Prebuilt Mastra scorers (toxicity, tool-call-accuracy, etc.)
 */

import { createScorer } from "@mastra/core/evals";
import type { MastraScorer } from "@mastra/core/evals";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { prisma } from "@repo/database";
import type {
    EvalContext,
    ScorecardCriterion,
    Tier1Result,
    AarOutput,
    SkillAttribution,
    TurnEvaluation
} from "./types";
import { computeWeightedScore, DEFAULT_SCORECARD_CRITERIA } from "./types";
import { runTier1Prescreen, shouldRunTier2 } from "./tier1";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/**
 * Structured output schema for the bulk scorecard analysis LLM call.
 * Covers per-criterion scores/feedback, narrative, confidence,
 * skill attributions, and turn evaluations.
 * AAR is handled separately by generateAAR().
 */
const BulkAnalysisSchema = z.object({
    criteria_scores: z.array(
        z.object({
            criterion_id: z.string(),
            score: z.number().min(0).max(1),
            feedback: z.string().describe("Specific feedback with evidence from the trace")
        })
    ),
    overall_narrative: z.string().describe("2-4 sentence overall assessment"),
    confidence: z.number().min(0).max(1).describe("How confident you are in this assessment"),
    skill_attributions: z
        .array(
            z.object({
                skill_slug: z.string(),
                impact: z.enum(["positive", "negative", "neutral"]),
                note: z.string()
            })
        )
        .nullable(),
    turn_evaluations: z
        .array(
            z.object({
                turn_index: z.number(),
                score: z.number().min(0).max(1),
                feedback: z.string()
            })
        )
        .nullable()
        .describe("Only for multi-turn conversations if evaluateTurns is enabled")
});

type BulkAnalysis = z.infer<typeof BulkAnalysisSchema>;

const AarSchema = z.object({
    what_should_have_happened: z
        .string()
        .describe("What the agent was supposed to do per its instructions and scorecard"),
    what_actually_happened: z.string().describe("What the agent actually did based on the trace"),
    why_difference: z.string().describe("Root cause analysis of any gaps"),
    sustain: z
        .array(
            z.object({
                pattern: z.string().describe("What the agent did well"),
                evidence: z.string().describe("Specific trace evidence"),
                category: z.string().describe("classification|enrichment|tone|routing|safety")
            })
        )
        .describe("Patterns to reinforce"),
    improve: z
        .array(
            z.object({
                pattern: z.string().describe("What the agent did poorly or missed"),
                evidence: z.string().describe("Specific trace evidence"),
                category: z.string().describe("classification|enrichment|tone|routing|safety"),
                recommendation: z.string().describe("Specific actionable recommendation")
            })
        )
        .describe("Patterns to fix")
});

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const AUDITOR_SYSTEM_PROMPT = `You are a senior quality auditor evaluating an AI agent's performance. You are rigorous, fair, and specific in your assessments. You evaluate based on a provided scorecard with defined criteria and rubrics.

RULES:
1. Score each criterion independently on a 0.0-1.0 scale following the rubric exactly.
2. Provide specific, actionable written feedback for each criterion citing evidence from the trace.
3. When ground truth (expected output) is provided, compare the actual output against it.
4. When skills are active, attribute any quality issues to the specific skill if identifiable.
5. Express your confidence in the overall assessment (0.0-1.0).
6. Be consistent: the same quality of work should always receive the same score.
If human feedback is provided, weigh it heavily -- the human is the ground truth.

OUTPUT FORMAT: JSON matching the provided schema exactly.`;

const AAR_SYSTEM_PROMPT = `You are conducting an After Action Review (AAR) for an AI agent's performance. You have access to the agent's scorecard results and full execution trace.

## AAR Methodology

1. WHAT WAS THE PLAN? Review the agent's instructions and scorecard criteria. What was the agent supposed to do?
2. WHAT ACTUALLY HAPPENED? Analyze the trace, tool calls, and output. What did the agent actually do?
3. WHY WAS THERE A DIFFERENCE? If there's a gap, identify the root cause. Was it a classification error? Missing context? Wrong tool usage?
4. WHAT SHOULD WE SUSTAIN? Identify specific patterns the agent did well. These become "sustain" recommendations that reinforce good behavior.
5. WHAT SHOULD WE IMPROVE? Identify specific patterns that need fixing. These become "improve" recommendations with actionable suggestions.

Every review MUST have at least one sustain and one improve item, even for high-scoring runs.

OUTPUT FORMAT: JSON matching the provided schema exactly.`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(text: string | null | undefined, maxLen: number): string {
    if (!text) return "(empty)";
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + "...";
}

/**
 * Format plain strings into MastraDBMessage format for prebuilt scorers
 * that use type: "agent" internally.
 */
export function formatForAgentScorer(
    inputText: string,
    outputText: string
): {
    input: unknown;
    output: unknown;
} {
    return {
        input: {
            inputMessages: [
                {
                    role: "user" as const,
                    content: {
                        content: inputText,
                        parts: [{ type: "text" as const, text: inputText }]
                    }
                }
            ],
            rememberedMessages: [],
            systemMessages: [],
            taggedSystemMessages: {}
        },
        output: [
            {
                role: "assistant" as const,
                content: {
                    content: outputText,
                    parts: [{ type: "text" as const, text: outputText }]
                }
            }
        ]
    };
}

/**
 * Build the prompt for the bulk scorecard auditor from the evaluation context.
 */
async function buildBulkAuditorPrompt(
    context: EvalContext,
    criteria: ScorecardCriterion[]
): Promise<string> {
    const parts: string[] = [];

    parts.push(`## Agent: ${context.agent.name}`);
    parts.push(`**Role:** ${context.agent.description || "General assistant"}`);
    parts.push(
        `**Instructions (what the agent was told to do):**\n${truncate(context.agent.instructions, 2000)}`
    );

    if (context.skillsJson && context.skillsJson.length > 0) {
        parts.push(`**Active Skills:**`);
        for (const skill of context.skillsJson) {
            parts.push(
                `- ${skill.skillSlug}${skill.skillVersion ? ` (v${skill.skillVersion})` : ""}`
            );
        }
    }

    parts.push(`## Scorecard Criteria`);
    for (const criterion of criteria) {
        parts.push(
            `### ${criterion.name} (weight: ${criterion.weight}, ${criterion.scoreDirection})`
        );
        parts.push(`**What to evaluate:** ${criterion.description}`);
        parts.push(`**Rubric:** ${criterion.rubric}`);
    }

    parts.push(`## Run Under Evaluation`);
    parts.push(`**User Input:**\n${truncate(context.run.inputText, 2000)}`);
    parts.push(`**Agent Output:**\n${truncate(context.run.outputText, 3000)}`);

    if (context.testRun?.testCase?.expectedOutput) {
        parts.push(
            `**Expected Output (Ground Truth):**\n${truncate(context.testRun.testCase.expectedOutput, 2000)}`
        );
        parts.push(`Compare the actual output against this expected output when scoring.`);
    }

    parts.push(`## Execution Trace`);
    if (context.run.durationMs) {
        parts.push(`**Duration:** ${context.run.durationMs}ms`);
    }
    if (context.run.totalTokens) {
        parts.push(
            `**Tokens:** ${context.run.totalTokens} (prompt: ${context.run.promptTokens ?? "?"}, completion: ${context.run.completionTokens ?? "?"})`
        );
    }
    if (context.run.costUsd) {
        parts.push(`**Cost:** $${context.run.costUsd}`);
    }

    if (context.toolCalls && context.toolCalls.length > 0) {
        parts.push(`**Tool Calls (${context.toolCalls.length}):**`);
        for (const tc of context.toolCalls) {
            const status = tc.success ? "SUCCESS" : `FAILED: ${tc.error || "unknown"}`;
            parts.push(
                `- ${tc.toolKey} [${status}]${tc.durationMs ? ` (${tc.durationMs}ms)` : ""}`
            );
            if (tc.inputJson) {
                parts.push(`  Input: ${truncate(JSON.stringify(tc.inputJson), 500)}`);
            }
            if (tc.outputJson) {
                parts.push(`  Output: ${truncate(JSON.stringify(tc.outputJson), 500)}`);
            }
            if (tc.toolSource) {
                parts.push(`  Source: ${tc.toolSource}`);
            }
        }
    }

    if (context.trace?.stepsJson) {
        const steps = context.trace.stepsJson as {
            step: number;
            type: string;
            content: string;
        }[];
        if (Array.isArray(steps) && steps.length > 0) {
            parts.push(`**Execution Steps:**`);
            for (const step of steps) {
                parts.push(`${step.step}. [${step.type}] ${truncate(step.content, 300)}`);
            }
        }
    }

    if (context.run.id) {
        try {
            const feedbacks = await prisma.agentFeedback.findMany({
                where: { runId: context.run.id },
                orderBy: { createdAt: "asc" }
            });
            if (feedbacks.length > 0) {
                parts.push(`## Human Feedback on This Run`);
                for (const fb of feedbacks) {
                    const source = fb.source ? ` (via ${fb.source})` : "";
                    const sentiment =
                        fb.thumbs === true
                            ? "Positive"
                            : fb.thumbs === false
                              ? "Negative"
                              : "Neutral";
                    parts.push(`- ${sentiment}${source}: "${fb.comment || "(no comment)"}"`);
                }
                parts.push(
                    `\nHuman feedback is ground truth. Weight it heavily in your assessment.`
                );
            }
        } catch {
            // Non-critical: continue without feedback
        }
    }

    const evaluateTurns = context.agent.scorecard?.evaluateTurns ?? false;
    if (context.turns && context.turns.length > 1 && evaluateTurns) {
        parts.push(`## Conversation Turns (${context.turns.length})`);
        parts.push(
            `You MUST provide turn_evaluations for each turn since evaluateTurns is enabled.`
        );
        for (const turn of context.turns) {
            parts.push(`### Turn ${turn.turnIndex}`);
            parts.push(`User: ${truncate(turn.inputText, 500)}`);
            parts.push(`Agent: ${truncate(turn.outputText, 500)}`);
        }
    }

    return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// Scorer builders
// ---------------------------------------------------------------------------

/**
 * Build a heuristic scorer that wraps Tier 1 deterministic checks.
 * Uses only JS function steps -- zero LLM cost.
 */
export function buildHeuristicScorer(): MastraScorer<"heuristic-prescreen"> {
    return createScorer({
        id: "heuristic-prescreen" as const,
        description:
            "Fast deterministic quality checks (length, tool success, errors, toxicity words, efficiency, relevance)"
    })
        .preprocess(({ run }) => {
            const context = run.requestContext?.evalContext as EvalContext;
            const tier1 = runTier1Prescreen(context);
            return { scores: tier1.scores, flags: tier1.flags, avgScore: tier1.avgScore };
        })
        .generateScore(({ results }) => {
            return results.preprocessStepResult.avgScore;
        })
        .generateReason(({ results }) => {
            const flags = results.preprocessStepResult.flags;
            return flags.length > 0
                ? `Flagged: ${flags.join(", ")}`
                : "All heuristic checks passed";
        }) as unknown as MastraScorer<"heuristic-prescreen">;
}

/**
 * Build a bulk scorecard scorer that evaluates ALL criteria in a single LLM call.
 * Uses the analyze step (PromptObject with outputSchema) for structured output,
 * then JS functions for generateScore and generateReason.
 */
export function buildBulkScorecardScorer(
    criteria: ScorecardCriterion[],
    auditorModel: string
): MastraScorer<"scorecard-auditor"> {
    const modelString = auditorModel.includes("/") ? auditorModel : `openai/${auditorModel}`;

    return createScorer({
        id: "scorecard-auditor" as const,
        description: "Evaluates agent run against all scorecard criteria in a single LLM call",
        judge: {
            model: modelString,
            instructions: AUDITOR_SYSTEM_PROMPT
        }
    })
        .analyze({
            description: "Score all criteria with evidence-based feedback",
            outputSchema: BulkAnalysisSchema,
            createPrompt: async ({ run }) => {
                const ctx = run.requestContext?.evalContext as EvalContext;
                return buildBulkAuditorPrompt(ctx, criteria);
            }
        })
        .generateScore(({ results }) => {
            const scores: Record<string, number> = {};
            for (const cs of results.analyzeStepResult.criteria_scores) {
                scores[cs.criterion_id] = cs.score;
            }
            return computeWeightedScore(scores, criteria);
        })
        .generateReason(({ results }) => {
            return results.analyzeStepResult.overall_narrative;
        }) as unknown as MastraScorer<"scorecard-auditor">;
}

/**
 * Get prebuilt Mastra scorers relevant to the agent configuration.
 * These use type: "agent" internally and need formatted input via formatForAgentScorer().
 */
export async function getPrebuiltScorers(
    agentConfig: EvalContext["agent"],
    auditorModel: string
): Promise<{ id: string; scorer: MastraScorer<string> }[]> {
    const modelString = auditorModel.includes("/") ? auditorModel : `openai/${auditorModel}`;

    const scorers: { id: string; scorer: MastraScorer<string> }[] = [];

    try {
        const { createToxicityScorer } = await import("@mastra/evals/scorers/prebuilt");
        scorers.push({
            id: "toxicity",
            scorer: createToxicityScorer({ model: modelString }) as MastraScorer<string>
        });
    } catch {
        console.warn("[scorer-factory] Failed to load toxicity scorer");
    }

    if (agentConfig.tools && agentConfig.tools.length > 0) {
        try {
            const { createToolCallAccuracyScorerLLM } =
                await import("@mastra/evals/scorers/prebuilt");
            scorers.push({
                id: "tool-call-accuracy",
                scorer: createToolCallAccuracyScorerLLM({
                    model: modelString,
                    availableTools: []
                }) as MastraScorer<string>
            });
        } catch {
            console.warn("[scorer-factory] Failed to load tool-call-accuracy scorer");
        }
    }

    return scorers;
}

// ---------------------------------------------------------------------------
// Scorer results types
// ---------------------------------------------------------------------------

export interface ScorerResults {
    heuristic: {
        score: number;
        reason: string;
        scores: Record<string, number>;
        flags: string[];
    };
    scorecard: {
        score: number;
        reason: string;
        analysis: BulkAnalysis;
        scoresJson: Record<string, number>;
        feedbackJson: Record<string, string>;
        confidenceScore: number;
        skillAttributions: SkillAttribution[] | null;
        turnEvaluations: TurnEvaluation[] | null;
    } | null;
    prebuilt: Record<string, { score: number; reason?: string }>;
    tier: "heuristic" | "full";
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Run all scorers against a completed run.
 *
 * 1. Always runs the heuristic scorer (fast, free).
 * 2. If heuristic flags or sampling hits: runs bulk scorecard + prebuilt scorers.
 * 3. Returns unified ScorerResults.
 */
export async function runAllScorers(context: EvalContext): Promise<ScorerResults> {
    const criteria = context.agent.scorecard?.criteria ?? DEFAULT_SCORECARD_CRITERIA;
    const samplingRate = context.agent.scorecard?.samplingRate ?? 1.0;
    const auditorModel = context.agent.scorecard?.auditorModel ?? "gpt-4o-mini";
    const hasGroundTruth = !!context.testRun?.testCase?.expectedOutput;

    const scorerInput = {
        input: context.run.inputText || "",
        output: context.run.outputText || "",
        groundTruth: context.testRun?.testCase?.expectedOutput ?? undefined,
        requestContext: { evalContext: context }
    };

    // Step 1: Heuristic scorer (always runs)
    const heuristicScorer = buildHeuristicScorer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const heuristicResult: any = await heuristicScorer.run(scorerInput);

    const heuristicTier1: Tier1Result = {
        scores: heuristicResult.preprocessStepResult?.scores ?? {},
        avgScore: heuristicResult.score ?? 0,
        flags: heuristicResult.preprocessStepResult?.flags ?? []
    };

    // Step 2: Should we run LLM scorers?
    const shouldRunLLM = shouldRunTier2(heuristicTier1, samplingRate, hasGroundTruth);

    if (!shouldRunLLM) {
        return {
            heuristic: {
                score: heuristicResult.score ?? 0,
                reason: heuristicResult.reason ?? "",
                scores: heuristicTier1.scores,
                flags: heuristicTier1.flags
            },
            scorecard: null,
            prebuilt: {},
            tier: "heuristic"
        };
    }

    // Step 3: Bulk scorecard scorer
    const scorecardScorer = buildBulkScorecardScorer(criteria, auditorModel);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scorecardResult: any = await scorecardScorer.run(scorerInput);

    const analysis = scorecardResult.analyzeStepResult as BulkAnalysis;

    const scoresJson: Record<string, number> = {};
    const feedbackJson: Record<string, string> = {};
    for (const cs of analysis.criteria_scores) {
        scoresJson[cs.criterion_id] = cs.score;
        feedbackJson[cs.criterion_id] = cs.feedback;
    }

    // Step 4: Prebuilt scorers
    const prebuiltResults: Record<string, { score: number; reason?: string }> = {};
    try {
        const prebuiltScorers = await getPrebuiltScorers(context.agent, auditorModel);
        const formatted = formatForAgentScorer(
            context.run.inputText || "",
            context.run.outputText || ""
        );

        for (const { id, scorer } of prebuiltScorers) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result: any = await (scorer as any).run({
                    input: formatted.input,
                    output: formatted.output
                });
                prebuiltResults[id] = {
                    score: result.score ?? 0,
                    reason: result.reason
                };
            } catch (err) {
                console.error(`[scorer-factory] Prebuilt scorer ${id} failed:`, err);
            }
        }
    } catch (err) {
        console.error("[scorer-factory] Failed to load prebuilt scorers:", err);
    }

    return {
        heuristic: {
            score: heuristicResult.score ?? 0,
            reason: heuristicResult.reason ?? "",
            scores: heuristicTier1.scores,
            flags: heuristicTier1.flags
        },
        scorecard: {
            score: scorecardResult.score ?? 0,
            reason: scorecardResult.reason ?? "",
            analysis,
            scoresJson,
            feedbackJson,
            confidenceScore: analysis.confidence,
            skillAttributions: analysis.skill_attributions
                ? analysis.skill_attributions.map((sa) => ({
                      skill_slug: sa.skill_slug,
                      impact: sa.impact,
                      note: sa.note
                  }))
                : null,
            turnEvaluations: analysis.turn_evaluations
                ? analysis.turn_evaluations.map((te) => ({
                      turn_index: te.turn_index,
                      score: te.score,
                      feedback: te.feedback
                  }))
                : null
        },
        prebuilt: prebuiltResults,
        tier: "full"
    };
}

// ---------------------------------------------------------------------------
// AAR Generation (standalone, not a MastraScorer)
// ---------------------------------------------------------------------------

/**
 * Generate an After Action Review from scorer results and run context.
 * Makes a single LLM call with all scorer results as context.
 * Returns null if the run doesn't warrant an AAR (heuristic-only evaluations).
 */
export async function generateAAR(
    scorerResults: ScorerResults,
    context: EvalContext
): Promise<AarOutput | null> {
    if (!scorerResults.scorecard) return null;

    const auditorModel = context.agent.scorecard?.auditorModel ?? "gpt-4o-mini";
    const criteria = context.agent.scorecard?.criteria ?? DEFAULT_SCORECARD_CRITERIA;

    const parts: string[] = [];

    parts.push(`## Agent: ${context.agent.name}`);
    parts.push(`**Instructions:**\n${truncate(context.agent.instructions, 1500)}`);

    parts.push(`## Scorecard Results`);
    parts.push(`**Overall Grade:** ${(scorerResults.scorecard.score * 100).toFixed(0)}%`);
    parts.push(`**Narrative:** ${scorerResults.scorecard.reason}`);

    parts.push(`### Per-Criterion Scores:`);
    for (const criterion of criteria) {
        const score = scorerResults.scorecard.scoresJson[criterion.id];
        const feedback = scorerResults.scorecard.feedbackJson[criterion.id];
        if (score !== undefined) {
            parts.push(
                `- **${criterion.name}**: ${(score * 100).toFixed(0)}% — ${feedback || "No feedback"}`
            );
        }
    }

    if (scorerResults.heuristic.flags.length > 0) {
        parts.push(`### Heuristic Flags: ${scorerResults.heuristic.flags.join(", ")}`);
    }

    if (Object.keys(scorerResults.prebuilt).length > 0) {
        parts.push(`### Prebuilt Scorer Results:`);
        for (const [id, result] of Object.entries(scorerResults.prebuilt)) {
            parts.push(`- **${id}**: ${(result.score * 100).toFixed(0)}%`);
        }
    }

    parts.push(`## Run Details`);
    parts.push(`**User Input:**\n${truncate(context.run.inputText, 1500)}`);
    parts.push(`**Agent Output:**\n${truncate(context.run.outputText, 2000)}`);

    if (context.toolCalls && context.toolCalls.length > 0) {
        parts.push(`**Tool Calls (${context.toolCalls.length}):**`);
        for (const tc of context.toolCalls) {
            const status = tc.success ? "SUCCESS" : `FAILED: ${tc.error || "unknown"}`;
            parts.push(`- ${tc.toolKey} [${status}]`);
        }
    }

    try {
        const { object: aar } = await generateObject({
            model: openai(auditorModel),
            schema: AarSchema,
            system: AAR_SYSTEM_PROMPT,
            prompt: parts.join("\n\n"),
            temperature: 0.1
        });

        return {
            what_should_have_happened: aar.what_should_have_happened,
            what_actually_happened: aar.what_actually_happened,
            why_difference: aar.why_difference,
            sustain: aar.sustain.map((s) => ({
                pattern: s.pattern,
                evidence: s.evidence,
                category: s.category
            })),
            improve: aar.improve.map((i) => ({
                pattern: i.pattern,
                evidence: i.evidence,
                category: i.category,
                recommendation: i.recommendation
            }))
        };
    } catch (err) {
        console.error("[generateAAR] Failed:", err);
        return null;
    }
}
