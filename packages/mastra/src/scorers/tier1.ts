/**
 * Tier 1 Heuristic Pre-Screen
 *
 * Fast, deterministic checks that run on every completed run (~0 cost).
 * Flags runs for Tier 2 AI auditor evaluation if quality concerns are detected.
 */

import type { EvalContext, Tier1Result } from "./types";

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

/**
 * Run the Tier 1 heuristic pre-screen on a completed run.
 * Returns scores for fast checks and flags any concerns.
 */
export function runTier1Prescreen(context: EvalContext): Tier1Result {
    const flags: string[] = [];
    const scores: Record<string, number> = {};

    const output = context.run.outputText || "";
    const input = context.run.inputText || "";

    // 1. Output length check
    if (output.length === 0) {
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
        scores.toolSuccess = 1.0; // No tools used, no failures
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
        // A reasonable ratio is 0.1-2.0; extreme values may indicate issues
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
        scores.efficiency = 0.8; // Unknown, assume reasonable
    }

    // 6. Input/output relevance (basic word overlap)
    if (input.length > 0 && output.length > 0) {
        const inputWords = new Set(
            input
                .toLowerCase()
                .split(/\s+/)
                .filter((w) => w.length > 3)
        );
        const outputWords = output.toLowerCase().split(/\s+/);
        const overlap = outputWords.filter((w) => inputWords.has(w)).length;
        const relevance = inputWords.size > 0 ? Math.min(overlap / inputWords.size, 1.0) : 0.5;
        scores.relevance = Math.max(relevance, 0.2); // Floor at 0.2
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
    // Always run Tier 2 if:
    // 1. Any Tier 1 score is below 0.5 (quality concern)
    const isFlagged = Object.values(tier1Result.scores).some((s) => s < 0.5);
    // 2. There is ground truth to compare against
    // 3. Random sampling based on configured rate
    const isSampled = Math.random() < samplingRate;

    return isFlagged || hasGroundTruth || isSampled;
}
