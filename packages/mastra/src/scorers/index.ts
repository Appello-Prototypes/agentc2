import {
    createAnswerRelevancyScorer,
    createToxicityScorer,
    createCompletenessScorer,
    createToneScorer
} from "@mastra/evals/scorers/prebuilt";

/**
 * Answer Relevancy Scorer
 *
 * Evaluates how well responses address the input query.
 * Score: 0-1 (higher is better)
 */
export const relevancyScorer = createAnswerRelevancyScorer({
    model: "openai/gpt-4o-mini"
});

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
