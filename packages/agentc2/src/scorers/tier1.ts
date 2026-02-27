/**
 * Tier 1 Heuristic Pre-Screen
 *
 * Fast, deterministic checks that run on every completed run (~0 cost).
 * Flags runs for Tier 2 AI auditor evaluation if quality concerns are detected.
 */

import type { EvalContext, ScorecardCriterion, Tier1Result } from "./types";
import { toolBehaviorMap } from "../tools/registry";

const TIER1_TO_CRITERIA_MAP: Record<string, string[]> = {
    task_accuracy: ["relevance", "length", "goalCompletion"],
    instruction_adherence: ["relevance", "errorFree"],
    tool_usage: ["toolSuccess", "goalCompletion"],
    response_quality: ["length", "relevance"],
    safety_compliance: ["safety"],
    safety: ["safety"],
    efficiency: ["efficiency"]
};

export function normalizeTier1ToScorecard(
    tier1Scores: Record<string, number>,
    criteria: ScorecardCriterion[]
): Record<string, number> {
    const normalized: Record<string, number> = {};
    for (const criterion of criteria) {
        const mappedKeys = TIER1_TO_CRITERIA_MAP[criterion.id];
        if (mappedKeys) {
            const mapped = mappedKeys
                .filter((k) => tier1Scores[k] !== undefined)
                .map((k) => tier1Scores[k]);
            if (mapped.length > 0) {
                normalized[criterion.id] = mapped.reduce((a, b) => a + b, 0) / mapped.length;
            }
        }
    }
    return normalized;
}

const TOXICITY_WORDS = [
    "stupid",
    "idiot",
    "hate",
    "kill",
    "die",
    "moron",
    "dumb",
    "loser",
    "pathetic",
    "worthless",
    "shut up",
    "go to hell"
];

function getNestedValue(obj: unknown, path: string): unknown {
    return path.split(".").reduce((curr, key) => (curr as Record<string, unknown>)?.[key], obj);
}

/**
 * Extract the content produced by mutation tool calls so it can
 * be used as "effective output" for length / relevance scoring.
 * Uses toolBehaviorMap from the registry to identify mutations
 * and their output content paths.
 */
function extractEffectiveOutput(toolCalls: EvalContext["toolCalls"]): string | null {
    const parts: string[] = [];
    for (const tc of toolCalls) {
        if (!tc.success) continue;
        const meta = toolBehaviorMap[tc.toolKey];
        if (!meta || meta.behavior !== "mutation") continue;
        if (meta.outputContentPath && tc.outputJson) {
            const value = getNestedValue(tc.outputJson, meta.outputContentPath);
            if (value) parts.push(String(value));
        } else if (meta.behavior === "mutation" && tc.success) {
            parts.push(`[${tc.toolKey} succeeded]`);
        }
    }
    return parts.length > 0 ? parts.join("\n\n") : null;
}

function hasMutationSuccess(toolCalls: EvalContext["toolCalls"]): boolean {
    if (!toolCalls) return false;
    return toolCalls.some(
        (tc) => tc.success && toolBehaviorMap[tc.toolKey]?.behavior === "mutation"
    );
}

/**
 * Run the Tier 1 heuristic pre-screen on a completed run.
 * Returns scores for fast checks and flags any concerns.
 */
export function runTier1Prescreen(context: EvalContext): Tier1Result {
    const flags: string[] = [];
    const scores: Record<string, number> = {};

    const rawOutput = context.run.outputText || "";
    const input = context.run.inputText || "";

    const isEmptyOutput = rawOutput.length === 0 || rawOutput.includes("no text output");

    const effectiveOutput =
        isEmptyOutput && context.toolCalls?.length
            ? extractEffectiveOutput(context.toolCalls)
            : null;

    const output = effectiveOutput ?? rawOutput;

    const mutationSucceeded = effectiveOutput !== null || hasMutationSuccess(context.toolCalls);

    // 1. Output length check
    if (mutationSucceeded && isEmptyOutput) {
        scores.length = Math.min(output.length / 200, 1.0);
    } else if (output.length === 0) {
        scores.length = 0;
        flags.push("empty_output");
    } else if (output.length < 20) {
        scores.length = 0.3;
        flags.push("very_short_output");
    } else if (output.length < 50) {
        scores.length = 0.5;
    } else {
        scores.length = Math.min(output.length / 200, 1.0);
    }

    // 2. Tool failure detection
    if (context.toolCalls && context.toolCalls.length > 0) {
        const failedCalls = context.toolCalls.filter((tc) => tc.success === false);
        const successRate =
            (context.toolCalls.length - failedCalls.length) / context.toolCalls.length;
        scores.toolSuccess = successRate;
        if (failedCalls.length > 0) {
            flags.push(`tool_failures:${failedCalls.length}`);
        }
    } else {
        scores.toolSuccess = 1.0;
    }

    // 3. Error pattern matching
    const errorPatterns = [
        /error:/i,
        /exception/i,
        /failed to/i,
        /unable to/i,
        /could not/i,
        /api error/i,
        /rate limit/i,
        /timeout/i,
        /internal server error/i,
        /something went wrong/i
    ];
    const errorCount = errorPatterns.filter((p) => p.test(output)).length;
    if (errorCount > 2) {
        scores.errorFree = 0.3;
        flags.push("multiple_error_patterns");
    } else if (errorCount > 0) {
        scores.errorFree = 0.7;
    } else {
        scores.errorFree = 1.0;
    }

    // 4. Profanity/toxicity word list check
    const lowerOutput = output.toLowerCase();
    const toxicHits = TOXICITY_WORDS.filter((word) => lowerOutput.includes(word));
    if (toxicHits.length > 0) {
        scores.safety = 0.0;
        flags.push(`toxicity_detected:${toxicHits.join(",")}`);
    } else {
        scores.safety = 1.0;
    }

    // 5. Token efficiency
    if (context.run.totalTokens && context.run.promptTokens && context.run.completionTokens) {
        const ratio = context.run.completionTokens / context.run.promptTokens;
        if (ratio > 5.0) {
            scores.efficiency = 0.5;
            flags.push("high_token_ratio");
        } else if (ratio < 0.01) {
            scores.efficiency = 0.3;
            flags.push("very_low_token_ratio");
        } else {
            scores.efficiency = Math.min(1.0, 0.5 + ratio * 0.25);
        }
    } else {
        scores.efficiency = 0.8;
    }

    // 6. Goal completion (mutation tools achieved the task)
    if (mutationSucceeded) {
        scores.goalCompletion = 1.0;
    }

    // 7. Input/output relevance (structure-aware heuristic)
    if (input.length > 0 && output.length > 0) {
        const hasStructure =
            /[\*\-\#\:]/.test(output) || output.includes("\n") || output.length > 100;

        const inputWords = new Set(
            input
                .toLowerCase()
                .split(/\s+/)
                .filter((w) => w.length > 2)
        );
        const outputWords = output.toLowerCase().split(/\s+/);
        const overlap = outputWords.filter((w) => inputWords.has(w)).length;
        const wordRelevance =
            inputWords.size > 0 ? Math.min(overlap / Math.min(inputWords.size, 10), 1.0) : 0.5;

        scores.relevance = hasStructure
            ? Math.max(0.5, 0.5 + wordRelevance * 0.5)
            : Math.max(wordRelevance, 0.3);
    } else if (mutationSucceeded) {
        scores.relevance = 0.8;
    } else {
        scores.relevance = 0.5;
    }

    // Compute average
    const scoreValues = Object.values(scores);
    const avgScore = scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length;

    return {
        scores,
        avgScore,
        flags
    };
}

/**
 * Determine if a run should be sent to Tier 2 AI auditor.
 */
export function shouldRunTier2(
    tier1Result: Tier1Result,
    samplingRate: number,
    hasGroundTruth: boolean
): boolean {
    const isFlagged = Object.values(tier1Result.scores).some((s) => s < 0.5);
    const isSampled = Math.random() < samplingRate;

    return isFlagged || hasGroundTruth || isSampled;
}
