// Re-export scorecard system types
export type {
    ScorecardCriterion,
    AuditorOutput,
    Tier1Result,
    Tier2Result,
    EvalContext,
    CriterionResult,
    SkillAttribution,
    TurnEvaluation,
    AarOutput
} from "./types";
export {
    DEFAULT_SCORECARD_CRITERIA,
    validateCriteriaWeights,
    computeWeightedScore,
    normalizeForDisplay
} from "./types";
export { runTier2Auditor, buildAuditorPrompt } from "./auditor";
export { runTier1Prescreen, shouldRunTier2, normalizeTier1ToScorecard } from "./tier1";
export { generateScorecard } from "./scorecard-generator";
export { SCORECARD_TEMPLATES } from "./templates";
export type { ScorecardTemplateDefinition } from "./templates";

// Scorer factory (Mastra-native evaluation primitives)
export {
    buildBulkScorecardScorer,
    buildHeuristicScorer,
    getPrebuiltScorers,
    runAllScorers,
    generateAAR,
    formatForAgentScorer
} from "./scorer-factory";
export type { ScorerResults } from "./scorer-factory";

/**
 * Heuristic helpfulness scorer (kept for backward compat in demo/orchestrator).
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

    const actionWords = ["here's how", "follow these steps", "you can", "try this", "to do this"];
    const hasActions = actionWords.some((word) => output.toLowerCase().includes(word));
    if (hasActions) {
        score += 0.2;
        reasoning.push("Contains actionable guidance");
    }

    const hasExamples =
        output.includes("example") || output.includes("for instance") || output.includes("```");
    if (hasExamples) {
        score += 0.15;
        reasoning.push("Includes examples or code");
    }

    const hasStructure = output.includes("1.") || output.includes("- ") || output.includes("##");
    if (hasStructure) {
        score += 0.1;
        reasoning.push("Well-structured response");
    }

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
 * Heuristic code quality evaluator (kept for backward compat in demo routes).
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
