/**
 * Tier 1 Heuristic Pre-Screen
 *
 * Fast, deterministic checks that run on every completed run (~0 cost).
 * Flags runs for Tier 2 AI auditor evaluation if quality concerns are detected.
 */

import type { EvalContext, ScorecardCriterion, Tier1Result } from "./types";

/**
 * Default mapping from Tier 1 heuristic score keys to scorecard criterion IDs.
 * Each criterion maps to one or more Tier 1 keys; when multiple keys map,
 * their scores are averaged to produce the criterion estimate.
 */
const TIER1_TO_CRITERIA_MAP: Record<string, string[]> = {
    task_accuracy: ["relevance", "length", "goalCompletion"],
    instruction_adherence: ["relevance", "errorFree"],
    tool_usage: ["toolSuccess", "goalCompletion"],
    response_quality: ["length", "relevance"],
    safety_compliance: ["safety"],
    safety: ["safety"],
    efficiency: ["efficiency"]
};

/**
 * Map Tier 1 heuristic score keys to scorecard criteria IDs.
 * This allows Tier 1 evaluations to contribute to the same trend lines
 * as Tier 2 auditor evaluations in AgentQualityMetricDaily.
 *
 * Only criteria with at least one matching Tier 1 key are included;
 * criteria without a mapping are omitted (avoids false scores).
 */
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

/**
 * Tool keys whose successful execution counts as "effective output",
 * even when the agent returns no response text.
 */
const SIDE_EFFECT_TOOLS = new Set([
    "community-comment",
    "community-create-post",
    "community-vote",
    "community-create-board",
    "community-join-board",
    "backlog-add-task",
    "backlog-update-task",
    "backlog-complete-task"
]);

/**
 * Extract the content produced by side-effect tool calls so it can
 * be used as "effective output" for length / relevance scoring.
 */
function extractEffectiveOutput(toolCalls: EvalContext["toolCalls"]): string | null {
    const parts: string[] = [];
    for (const tc of toolCalls) {
        if (!tc.success || !SIDE_EFFECT_TOOLS.has(tc.toolKey)) continue;

        const out = tc.outputJson as Record<string, unknown> | undefined;
        if (!out) continue;

        const comment = out.comment as Record<string, unknown> | undefined;
        if (comment?.content) {
            parts.push(String(comment.content));
            continue;
        }

        const post = out.post as Record<string, unknown> | undefined;
        if (post?.content) {
            parts.push(`${post.title ?? ""}\n${post.content}`);
            continue;
        }

        const task = out.task as Record<string, unknown> | undefined;
        if (task?.title) {
            parts.push(String(task.title));
        }
    }
    return parts.length > 0 ? parts.join("\n\n") : null;
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

    const sideEffectSucceeded = effectiveOutput !== null;

    // 1. Output length check
    if (sideEffectSucceeded) {
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

    // 6. Goal completion (side-effect tools achieved the task)
    if (sideEffectSucceeded) {
        scores.goalCompletion = 1.0;
    }

    // 7. Input/output relevance (structure-aware heuristic)
    if (input.length > 0 && output.length > 0) {
        // If output has structure (lists, headers, emoji, formatting),
        // it's likely a processed response, not noise
        const hasStructure =
            /[\*\-\#\:]/.test(output) || output.includes("\n") || output.length > 100;

        // Check if output contains ANY key terms from input (relaxed threshold)
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

        // Structured, non-empty responses get a base score of 0.5
        // Word overlap adds up to 0.5 more
        scores.relevance = hasStructure
            ? Math.max(0.5, 0.5 + wordRelevance * 0.5)
            : Math.max(wordRelevance, 0.3);
    } else if (sideEffectSucceeded) {
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
    // Always run Tier 2 if:
    // 1. Any Tier 1 score is below 0.5 (quality concern)
    const isFlagged = Object.values(tier1Result.scores).some((s) => s < 0.5);
    // 2. There is ground truth to compare against
    // 3. Random sampling based on configured rate
    const isSampled = Math.random() < samplingRate;

    return isFlagged || hasGroundTruth || isSampled;
}
