import {
    createAnswerRelevancyScorer,
    createToxicityScorer,
    createCompletenessScorer,
    createToneConsistencyScorer
} from "@mastra/evals/scorers/prebuilt";
import { createScorer } from "@mastra/evals";
import { z } from "zod";

/**
 * Answer Relevancy Scorer
 *
 * Evaluates how well responses address the input query.
 * Score: 0-1 (higher is better)
 */
export const relevancyScorer = createAnswerRelevancyScorer({
    model: "openai/gpt-4.1-nano"
});

/**
 * Toxicity Scorer
 *
 * Detects harmful, offensive, or inappropriate content.
 * Score: 0-1 (lower is better - 0 means no toxicity)
 */
export const toxicityScorer = createToxicityScorer({
    model: "openai/gpt-4.1-nano"
});

/**
 * Completeness Scorer
 *
 * Checks if responses include all necessary information.
 * Score: 0-1 (higher is better)
 */
export const completenessScorer = createCompletenessScorer({
    model: "openai/gpt-4.1-nano"
});

/**
 * Tone Consistency Scorer
 *
 * Measures consistency in formality, complexity, and style.
 * Score: 0-1 (higher is better)
 */
export const toneScorer = createToneConsistencyScorer({
    model: "openai/gpt-4.1-nano"
});

/**
 * Custom Helpfulness Scorer
 *
 * Evaluates how helpful and actionable the response is.
 * Uses heuristic-based scoring for demonstration.
 */
export const helpfulnessScorer = createScorer({
    id: "helpfulness",
    name: "Helpfulness Scorer",
    description: "Evaluates how helpful and actionable the response is",

    inputSchema: z.object({
        input: z.string().describe("The original query"),
        output: z.string().describe("The agent's response")
    }),

    outputSchema: z.object({
        score: z.number().min(0).max(1),
        reasoning: z.string()
    }),

    execute: async ({ input, output }) => {
        let score = 0.5;
        const reasoning: string[] = [];

        // Check for actionable content
        const actionWords = [
            "here's how",
            "follow these steps",
            "you can",
            "try this",
            "to do this"
        ];
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
        const hasStructure =
            output.includes("1.") || output.includes("- ") || output.includes("##");
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
                reasoning.length > 0
                    ? reasoning.join("; ")
                    : "Basic response without special features"
        };
    }
});

/**
 * Custom Code Quality Scorer
 *
 * For evaluating responses that contain code.
 */
export const codeQualityScorer = createScorer({
    id: "code-quality",
    name: "Code Quality Scorer",
    description: "Evaluates code responses for quality and completeness",

    inputSchema: z.object({
        input: z.string(),
        output: z.string()
    }),

    outputSchema: z.object({
        score: z.number().min(0).max(1),
        hasCode: z.boolean(),
        codeBlocks: z.number(),
        hasComments: z.boolean(),
        hasErrorHandling: z.boolean()
    }),

    execute: async ({ input, output }) => {
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
});

/**
 * All scorers bundled for agent configuration
 */
export const scorers = {
    relevancy: relevancyScorer,
    toxicity: toxicityScorer,
    completeness: completenessScorer,
    tone: toneScorer,
    helpfulness: helpfulnessScorer,
    codeQuality: codeQualityScorer
};
