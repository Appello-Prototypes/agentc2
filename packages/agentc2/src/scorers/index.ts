import {
    createToxicityScorer,
    createCompletenessScorer,
    createToneScorer
} from "@mastra/evals/scorers/prebuilt";

// Re-export new scorecard system
export type {
    ScorecardCriterion,
    AuditorOutput,
    Tier1Result,
    Tier2Result,
    EvalContext,
    CriterionResult,
    SkillAttribution,
    TurnEvaluation
} from "./types";
export { DEFAULT_SCORECARD_CRITERIA, validateCriteriaWeights, computeWeightedScore } from "./types";
export { runTier2Auditor, buildAuditorPrompt } from "./auditor";
export { runTier1Prescreen, shouldRunTier2, normalizeTier1ToScorecard } from "./tier1";
export { generateScorecard } from "./scorecard-generator";
export { SCORECARD_TEMPLATES } from "./templates";
export type { ScorecardTemplateDefinition } from "./templates";

/**
 * Answer Relevancy Scorer
 *
 * Custom LLM-based scorer that evaluates semantic relevance directly.
 * Replaces createAnswerRelevancyScorer which used reverse-question-generation
 * and returned 0% for short answers and format-transformed outputs.
 * Score: 0-1 (higher is better)
 */
export const relevancyScorer = {
    name: "relevancy",
    async run({ input, output }: { input: string; output: string }) {
        const { generateText } = await import("ai");
        const { openai } = await import("@ai-sdk/openai");

        const prompt = `You are evaluating whether an AI agent's output is relevant to the input it received.

IMPORTANT: Relevancy means the output addresses what the input asked for or required. It does NOT mean the output contains the same words as the input.

Examples of HIGH relevancy:
- Input: "What is the capital of France?" Output: "Paris" (directly answers the question)
- Input: [raw email] Output: [triage classification to Slack] (fulfills the agent's purpose)
- Input: "Schedule a meeting" Output: [calendar event created] (completes the requested action)

Score 0.0-1.0 where:
- 1.0 = Output directly and completely addresses what the input required
- 0.7 = Output mostly addresses the input with minor gaps
- 0.4 = Output partially relevant but missing key aspects
- 0.1 = Output barely related to input
- 0.0 = Output completely unrelated to input

Input: ${JSON.stringify(input).slice(0, 2000)}
Output: ${JSON.stringify(output).slice(0, 2000)}

Return ONLY a JSON object with no other text: {"score": <number>, "reasoning": "<brief explanation>"}`;

        try {
            const result = await generateText({
                model: openai("gpt-4o-mini"),
                prompt,
                temperature: 0.1
            });

            const parsed = JSON.parse(result.text.trim());
            return {
                score: Math.max(0, Math.min(1, parsed.score)),
                reasoning: parsed.reasoning || ""
            };
        } catch (error) {
            console.error("[relevancyScorer] Error:", error);
            return { score: 0.5, reasoning: "Scorer error, defaulting to neutral" };
        }
    }
};

/**
 * Toxicity Scorer
 *
 * Detects harmful, offensive, or inappropriate content.
 * Score: 0-1 (lower is better - 0 means no toxicity)
 */
export const toxicityScorer = createToxicityScorer({
    model: "openai/gpt-4o-mini"
});

/**
 * Completeness Scorer
 *
 * Checks if responses include all necessary information.
 * Score: 0-1 (higher is better)
 */
export const completenessScorer = createCompletenessScorer();

/**
 * Tone Scorer
 *
 * Measures consistency in formality, complexity, and style.
 * Score: 0-1 (higher is better)
 */
export const toneScorer = createToneScorer();

/**
 * Custom Helpfulness Scorer
 *
 * Evaluates how helpful and actionable the response is.
 * Uses heuristic-based scoring for demonstration.
 */
export function evaluateHelpfulness(
    input: string,
    output: string
): {
    score: number;
    reasoning: string;
} {
    let score = 0.5;
    const reasoning: string[] = [];

    // Check for actionable content
    const actionWords = ["here's how", "follow these steps", "you can", "try this", "to do this"];
    const hasActions = actionWords.some((word) => output.toLowerCase().includes(word));
    if (hasActions) {
        score += 0.2;
        reasoning.push("Contains actionable guidance");
    }

    // Check for examples
    const hasExamples =
        output.includes("example") || output.includes("for instance") || output.includes("```");
    if (hasExamples) {
        score += 0.15;
        reasoning.push("Includes examples or code");
    }

    // Check for structure (lists, headers)
    const hasStructure = output.includes("1.") || output.includes("- ") || output.includes("##");
    if (hasStructure) {
        score += 0.1;
        reasoning.push("Well-structured response");
    }

    // Check response length (not too short)
    if (output.length > 200) {
        score += 0.05;
        reasoning.push("Sufficient detail");
    }

    score = Math.min(score, 1.0);

    return {
        score,
        reasoning:
            reasoning.length > 0 ? reasoning.join("; ") : "Basic response without special features"
    };
}

/**
 * Custom Code Quality Evaluator
 *
 * For evaluating responses that contain code.
 */
export function evaluateCodeQuality(output: string): {
    score: number;
    hasCode: boolean;
    codeBlocks: number;
    hasComments: boolean;
    hasErrorHandling: boolean;
} {
    const codeBlockMatches = output.match(/```[\s\S]*?```/g) || [];
    const codeBlocks = codeBlockMatches.length;
    const hasCode = codeBlocks > 0;

    if (!hasCode) {
        return {
            score: 0,
            hasCode: false,
            codeBlocks: 0,
            hasComments: false,
            hasErrorHandling: false
        };
    }

    let score = 0.5;

    const hasComments = codeBlockMatches.some(
        (block) => block.includes("//") || block.includes("/*") || block.includes("#")
    );
    if (hasComments) score += 0.2;

    const hasErrorHandling = codeBlockMatches.some(
        (block) =>
            block.includes("try") ||
            block.includes("catch") ||
            block.includes("throw") ||
            block.includes("Error")
    );
    if (hasErrorHandling) score += 0.2;

    if (codeBlocks > 1) score += 0.1;

    return {
        score: Math.min(score, 1.0),
        hasCode,
        codeBlocks,
        hasComments,
        hasErrorHandling
    };
}

/**
 * All scorers bundled for agent configuration
 */
export const scorers = {
    relevancy: relevancyScorer,
    toxicity: toxicityScorer,
    completeness: completenessScorer,
    tone: toneScorer
};

/**
 * Utility evaluators (not Mastra scorers, but useful helpers)
 */
export const evaluators = {
    helpfulness: evaluateHelpfulness,
    codeQuality: evaluateCodeQuality
};

// NOTE: Scorer registry is available via @repo/agentc2/scorers/registry
// It cannot be re-exported here due to circular dependency
// (registry imports scorers from this file).
