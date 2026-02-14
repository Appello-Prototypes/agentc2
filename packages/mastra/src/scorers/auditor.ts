/**
 * AI Auditor
 *
 * Core evaluation engine that uses an LLM to grade agent runs
 * against a custom scorecard with structured output.
 */

import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { prisma } from "@repo/database";
import type { EvalContext, ScorecardCriterion, Tier2Result, AarOutput } from "./types";
import { DEFAULT_SCORECARD_CRITERIA, computeWeightedScore } from "./types";

/**
 * Truncate text to a maximum length, adding ellipsis if truncated.
 */
function truncate(text: string | null | undefined, maxLen: number): string {
    if (!text) return "(empty)";
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + "...";
}

/**
 * Zod schema for the AI auditor's structured output.
 */
const AuditorOutputSchema = z.object({
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
        .optional(),
    turn_evaluations: z
        .array(
            z.object({
                turn_index: z.number(),
                score: z.number().min(0).max(1),
                feedback: z.string()
            })
        )
        .optional()
        .describe("Only for multi-turn conversations if evaluateTurns is enabled"),
    aar: z
        .object({
            what_should_have_happened: z
                .string()
                .describe("What the agent was supposed to do per its instructions and scorecard"),
            what_actually_happened: z
                .string()
                .describe("What the agent actually did based on the trace"),
            why_difference: z.string().describe("Root cause analysis of any gaps"),
            sustain: z
                .array(
                    z.object({
                        pattern: z.string().describe("What the agent did well"),
                        evidence: z.string().describe("Specific trace evidence"),
                        category: z
                            .string()
                            .describe("classification|enrichment|tone|routing|safety")
                    })
                )
                .describe("Patterns to reinforce"),
            improve: z
                .array(
                    z.object({
                        pattern: z.string().describe("What the agent did poorly or missed"),
                        evidence: z.string().describe("Specific trace evidence"),
                        category: z
                            .string()
                            .describe("classification|enrichment|tone|routing|safety"),
                        recommendation: z.string().describe("Specific actionable recommendation")
                    })
                )
                .describe("Patterns to fix")
        })
        .optional()
        .describe("After Action Review: structured sustain/improve recommendations")
});

/**
 * The auditor system prompt.
 */
const AUDITOR_SYSTEM_PROMPT = `You are a senior quality auditor evaluating an AI agent's performance. You are rigorous, fair, and specific in your assessments. You evaluate based on a provided scorecard with defined criteria and rubrics.

RULES:
1. Score each criterion independently on a 0.0-1.0 scale following the rubric exactly.
2. Provide specific, actionable written feedback for each criterion citing evidence from the trace.
3. When ground truth (expected output) is provided, compare the actual output against it.
4. When skills are active, attribute any quality issues to the specific skill if identifiable.
5. Express your confidence in the overall assessment (0.0-1.0).
6. Be consistent: the same quality of work should always receive the same score.

## After Action Review (AAR) Methodology

In addition to scoring each criterion, you MUST conduct a structured After Action Review:

1. WHAT WAS THE PLAN? Review the agent's instructions and scorecard criteria. What was the agent supposed to do?
2. WHAT ACTUALLY HAPPENED? Analyze the trace, tool calls, and output. What did the agent actually do?
3. WHY WAS THERE A DIFFERENCE? If there's a gap, identify the root cause. Was it a classification error? Missing context? Wrong tool usage?
4. WHAT SHOULD WE SUSTAIN? Identify specific patterns the agent did well. These become "sustain" recommendations that reinforce good behavior.
5. WHAT SHOULD WE IMPROVE? Identify specific patterns that need fixing. These become "improve" recommendations with actionable suggestions.

Every evaluation MUST have at least one sustain and one improve item, even for high-scoring runs.
If human feedback is provided, weigh it heavily -- the human is the ground truth.

OUTPUT FORMAT: JSON matching the provided schema exactly.`;

/**
 * Build the user prompt for the auditor from the evaluation context.
 */
export async function buildAuditorPrompt(context: EvalContext): Promise<string> {
    const criteria = context.agent.scorecard?.criteria ?? DEFAULT_SCORECARD_CRITERIA;
    const parts: string[] = [];

    // 1. Agent identity
    parts.push(`## Agent: ${context.agent.name}`);
    parts.push(`**Role:** ${context.agent.description || "General assistant"}`);
    parts.push(
        `**Instructions (what the agent was told to do):**\n${truncate(context.agent.instructions, 2000)}`
    );

    // 2. Active skills (for attribution)
    if (context.skillsJson && context.skillsJson.length > 0) {
        parts.push(`**Active Skills:**`);
        for (const skill of context.skillsJson) {
            parts.push(
                `- ${skill.skillSlug}${skill.skillVersion ? ` (v${skill.skillVersion})` : ""}`
            );
        }
    }

    // 3. Scorecard criteria (the rubric)
    parts.push(`## Scorecard Criteria`);
    for (const criterion of criteria) {
        parts.push(
            `### ${criterion.name} (weight: ${criterion.weight}, ${criterion.scoreDirection})`
        );
        parts.push(`**What to evaluate:** ${criterion.description}`);
        parts.push(`**Rubric:** ${criterion.rubric}`);
    }

    // 4. The run being evaluated
    parts.push(`## Run Under Evaluation`);
    parts.push(`**User Input:**\n${truncate(context.run.inputText, 2000)}`);
    parts.push(`**Agent Output:**\n${truncate(context.run.outputText, 3000)}`);

    // 5. Ground truth (if available from test case)
    if (context.testRun?.testCase?.expectedOutput) {
        parts.push(
            `**Expected Output (Ground Truth):**\n${truncate(context.testRun.testCase.expectedOutput, 2000)}`
        );
        parts.push(`Compare the actual output against this expected output when scoring.`);
    }

    // 6. Execution trace
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

    // Tool calls
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

    // Execution steps
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

    // 7. Human feedback (from Slack, UI, API, etc.)
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

    // 8. Conversation turns (for multi-turn)
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

/**
 * Run the Tier 2 AI auditor evaluation.
 *
 * This calls the LLM with the scorecard criteria and trace context,
 * and returns structured evaluation results.
 */
export async function runTier2Auditor(context: EvalContext): Promise<Tier2Result> {
    const criteria: ScorecardCriterion[] =
        context.agent.scorecard?.criteria ?? DEFAULT_SCORECARD_CRITERIA;
    const auditorModel = context.agent.scorecard?.auditorModel ?? "gpt-4o-mini";

    const userPrompt = await buildAuditorPrompt(context);

    const { object: auditorOutput } = await generateObject({
        model: openai(auditorModel),
        schema: AuditorOutputSchema,
        system: AUDITOR_SYSTEM_PROMPT,
        prompt: userPrompt,
        temperature: 0.1 // Low temperature for consistency
    });

    // Build scoresJson: {criterion_id: score}
    const scoresJson: Record<string, number> = {};
    const feedbackJson: Record<string, string> = {};

    for (const cs of auditorOutput.criteria_scores) {
        scoresJson[cs.criterion_id] = cs.score;
        feedbackJson[cs.criterion_id] = cs.feedback;
    }

    // Compute weighted overall grade
    const overallGrade = computeWeightedScore(scoresJson, criteria);

    // Build skill attributions
    const skillAttributions = auditorOutput.skill_attributions
        ? auditorOutput.skill_attributions.map((sa) => ({
              skill_slug: sa.skill_slug,
              impact: sa.impact,
              note: sa.note
          }))
        : null;

    // Build turn evaluations
    const turnEvaluations = auditorOutput.turn_evaluations
        ? auditorOutput.turn_evaluations.map((te) => ({
              turn_index: te.turn_index,
              score: te.score,
              feedback: te.feedback
          }))
        : null;

    // Build AAR output
    const aar: AarOutput | null = auditorOutput.aar
        ? {
              what_should_have_happened: auditorOutput.aar.what_should_have_happened,
              what_actually_happened: auditorOutput.aar.what_actually_happened,
              why_difference: auditorOutput.aar.why_difference,
              sustain: auditorOutput.aar.sustain.map((s) => ({
                  pattern: s.pattern,
                  evidence: s.evidence,
                  category: s.category
              })),
              improve: auditorOutput.aar.improve.map((i) => ({
                  pattern: i.pattern,
                  evidence: i.evidence,
                  category: i.category,
                  recommendation: i.recommendation
              }))
          }
        : null;

    return {
        scoresJson,
        feedbackJson,
        overallGrade,
        narrative: auditorOutput.overall_narrative,
        confidenceScore: auditorOutput.confidence,
        skillAttributions,
        turnEvaluations,
        aar
    };
}
