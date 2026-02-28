/**
 * Centralized Learning Configuration
 *
 * This module provides a single source of truth for all continuous learning
 * thresholds, schedules, and policies. These defaults can be overridden
 * per-agent via the LearningPolicy database model.
 *
 * Inspired by Google DeepMind's approach to continuous, autonomous learning systems.
 */

// =============================================================================
// Signal Detection Thresholds
// =============================================================================

export const SIGNAL_THRESHOLDS = {
    /** Number of signals required to trigger a learning session */
    signalCount: 10,

    /** Time window (in minutes) for signal accumulation */
    signalWindowMinutes: 60,

    /** Minimum score below which a run is flagged as LOW_SCORE */
    lowScoreThreshold: 0.5,

    /** High severity score threshold (below this = high severity signal) */
    highSeverityThreshold: 0.3,

    /** Latency threshold (ms) for HIGH_LATENCY signals */
    highLatencyThresholdMs: 30000,

    /** Minimum runs needed in the dataset for a valid learning session */
    minRunsForSession: 10,

    /** Maximum runs to analyze in a single session */
    maxRunsPerSession: 100,

    /** Days of historical data to consider */
    datasetLookbackDays: 7
} as const;

// =============================================================================
// Scheduled Trigger Configuration
// =============================================================================

export const SCHEDULE_CONFIG = {
    /**
     * Cron expression for scheduled learning session checks.
     * Default: Every 6 hours (0 star/6 star star star)
     */
    cronExpression: "0 */6 * * *",

    /**
     * Minimum hours between sessions for the same agent.
     * Prevents over-learning and thrashing.
     */
    minHoursBetweenSessions: 8,

    /**
     * Maximum concurrent learning sessions across all agents.
     * Prevents system overload.
     */
    maxConcurrentSessions: 5
} as const;

// =============================================================================
// Traffic Split Configuration (Shadow A/B Testing)
// =============================================================================

export const TRAFFIC_SPLIT = {
    /**
     * Default traffic split for candidate version (0.0 - 1.0).
     * 0.1 = 10% of traffic goes to candidate.
     */
    defaultCandidateSplit: 0.1,

    /**
     * Minimum runs needed for each group before experiment evaluation.
     */
    minRunsPerGroup: 20,

    /**
     * Maximum runs for an experiment before auto-evaluation.
     */
    maxRunsPerExperiment: 200,

    /**
     * Maximum duration (hours) for a shadow experiment.
     */
    maxExperimentDurationHours: 72,

    /**
     * Traffic split progression for graduated rollouts.
     * Used when auto-promotion is enabled.
     */
    graduatedRollout: [0.05, 0.1, 0.25, 0.5, 1.0]
} as const;

// =============================================================================
// Auto-Promotion Thresholds
// =============================================================================

export const AUTO_PROMOTION = {
    /** Enable auto-promotion globally (can be overridden per-agent) */
    enabled: false,

    /**
     * Minimum win rate required for auto-promotion (0.0 - 1.0).
     * Default: 0.55 = candidate must win 55%+ of comparisons.
     */
    minWinRate: 0.55,

    /**
     * Minimum confidence score required for auto-promotion (0.0 - 1.0).
     */
    minConfidenceScore: 0.7,

    /**
     * Minimum number of runs before considering auto-promotion.
     */
    minRunsBeforeAutoPromotion: 50,

    /**
     * Maximum cost increase allowed for auto-promotion (percentage).
     * E.g., 0.1 = 10% cost increase is acceptable.
     */
    maxCostIncreasePct: 0.1,

    /**
     * Require no guardrail regressions for auto-promotion.
     */
    requireNoRegressions: true,

    /**
     * Require sustained improvement over N evaluations.
     */
    sustainedImprovementCount: 3
} as const;

// =============================================================================
// Risk Classification Rules
// =============================================================================

export const RISK_CLASSIFICATION = {
    /**
     * Low-risk changes that can be auto-promoted:
     * - Instruction-only edits
     * - No tool changes
     * - No model changes
     * - No memory changes
     * - No cost increase
     */
    lowRisk: {
        allowInstructionChanges: true,
        allowToolChanges: false,
        allowModelChanges: false,
        allowMemoryChanges: false,
        maxCostIncreasePct: 0
    },

    /**
     * Medium-risk changes that require review but aren't critical:
     * - Minor tool config changes
     * - Temperature adjustments
     */
    mediumRisk: {
        allowInstructionChanges: true,
        allowToolChanges: true, // Minor changes only
        allowModelChanges: false,
        allowMemoryChanges: false,
        maxCostIncreasePct: 0.05
    },

    /**
     * High-risk changes that always require human approval:
     * - Model provider/name changes
     * - Memory configuration changes
     * - Guardrail changes
     * - Significant cost increases
     */
    highRisk: {
        includesModelChanges: true,
        includesMemoryChanges: true,
        includesGuardrailChanges: true,
        costIncreaseAbovePct: 0.1
    }
} as const;

// =============================================================================
// Gating Thresholds for Experiments
// =============================================================================

export const EXPERIMENT_GATING = {
    /**
     * Default win rate threshold for passing an experiment.
     */
    defaultWinRateThreshold: 0.5,

    /**
     * Confidence interval width for statistical significance.
     */
    confidenceIntervalWidth: 0.1,

    /**
     * Minimum improvement percentage required.
     */
    minImprovementPct: 0.02,

    /**
     * Maximum regression tolerance (negative improvement allowed).
     */
    maxRegressionPct: 0.01,

    /**
     * Metrics to evaluate for gating decision.
     */
    gatingMetrics: ["avgScore", "successRate", "latency", "cost"] as const
} as const;

// =============================================================================
// Helper Functions
// =============================================================================

import type { RiskTier } from "@repo/database";

export interface ProposalChangeAnalysis {
    hasInstructionChanges: boolean;
    hasToolChanges: boolean;
    hasModelChanges: boolean;
    hasMemoryChanges: boolean;
    hasGuardrailChanges: boolean;
    estimatedCostIncreasePct: number;
}

/**
 * Classify a proposal's risk tier based on its changes.
 */
export function classifyRiskTier(changes: ProposalChangeAnalysis): {
    tier: RiskTier;
    reasons: string[];
    autoEligible: boolean;
} {
    const reasons: string[] = [];
    let tier: RiskTier = "LOW";

    // Check for high-risk indicators
    if (changes.hasModelChanges) {
        tier = "HIGH";
        reasons.push("Contains model provider or model name changes");
    }

    if (changes.hasMemoryChanges) {
        tier = "HIGH";
        reasons.push("Contains memory configuration changes");
    }

    if (changes.hasGuardrailChanges) {
        tier = "HIGH";
        reasons.push("Contains guardrail policy changes");
    }

    if (changes.estimatedCostIncreasePct > RISK_CLASSIFICATION.highRisk.costIncreaseAbovePct) {
        tier = "HIGH";
        reasons.push(
            `Cost increase (${(changes.estimatedCostIncreasePct * 100).toFixed(1)}%) exceeds threshold`
        );
    }

    // Check for medium-risk if not already high
    if (tier !== "HIGH") {
        if (changes.hasToolChanges) {
            tier = "MEDIUM";
            reasons.push("Contains tool configuration changes");
        }

        if (
            changes.estimatedCostIncreasePct > RISK_CLASSIFICATION.lowRisk.maxCostIncreasePct &&
            changes.estimatedCostIncreasePct <= RISK_CLASSIFICATION.mediumRisk.maxCostIncreasePct
        ) {
            tier = "MEDIUM";
            reasons.push(
                `Minor cost increase (${(changes.estimatedCostIncreasePct * 100).toFixed(1)}%)`
            );
        }
    }

    // Low risk: instruction-only changes with no cost increase
    if (tier === "LOW" && changes.hasInstructionChanges) {
        reasons.push("Instruction-only changes, no tool/model/memory modifications");
    }

    // Auto-eligibility: only LOW risk proposals can be auto-promoted
    const autoEligible = AUTO_PROMOTION.enabled && tier === "LOW" && reasons.length > 0;

    return { tier, reasons, autoEligible };
}

/**
 * Get merged configuration for an agent, combining global defaults
 * with per-agent overrides from LearningPolicy.
 */
export interface LearningPolicyOverrides {
    signalThreshold?: number | null;
    signalWindowMinutes?: number | null;
    trafficSplitCandidate?: number | null;
    minConfidenceForAuto?: number | null;
    minWinRateForAuto?: number | null;
    autoPromotionEnabled?: boolean | null;
    scheduledEnabled?: boolean | null;
    thresholdEnabled?: boolean | null;
}

export function getEffectiveConfig(overrides: LearningPolicyOverrides = {}) {
    return {
        signalThreshold: overrides.signalThreshold ?? SIGNAL_THRESHOLDS.signalCount,
        signalWindowMinutes: overrides.signalWindowMinutes ?? SIGNAL_THRESHOLDS.signalWindowMinutes,
        trafficSplitCandidate:
            overrides.trafficSplitCandidate ?? TRAFFIC_SPLIT.defaultCandidateSplit,
        minConfidenceForAuto: overrides.minConfidenceForAuto ?? AUTO_PROMOTION.minConfidenceScore,
        minWinRateForAuto: overrides.minWinRateForAuto ?? AUTO_PROMOTION.minWinRate,
        autoPromotionEnabled: overrides.autoPromotionEnabled ?? AUTO_PROMOTION.enabled,
        scheduledEnabled: overrides.scheduledEnabled ?? true,
        thresholdEnabled: overrides.thresholdEnabled ?? true
    };
}

/**
 * Check if an experiment should be auto-evaluated based on run counts.
 */
export function shouldEvaluateExperiment(
    baselineRunCount: number,
    candidateRunCount: number,
    startedAt: Date
): { shouldEvaluate: boolean; reason: string } {
    // Check minimum runs
    if (
        baselineRunCount >= TRAFFIC_SPLIT.minRunsPerGroup &&
        candidateRunCount >= TRAFFIC_SPLIT.minRunsPerGroup
    ) {
        return { shouldEvaluate: true, reason: "Minimum runs reached for both groups" };
    }

    // Check maximum runs
    const totalRuns = baselineRunCount + candidateRunCount;
    if (totalRuns >= TRAFFIC_SPLIT.maxRunsPerExperiment) {
        return { shouldEvaluate: true, reason: "Maximum experiment runs reached" };
    }

    // Check time limit
    const elapsedHours = (Date.now() - startedAt.getTime()) / (1000 * 60 * 60);
    if (elapsedHours >= TRAFFIC_SPLIT.maxExperimentDurationHours) {
        return { shouldEvaluate: true, reason: "Maximum experiment duration reached" };
    }

    return { shouldEvaluate: false, reason: "Waiting for more data" };
}

/**
 * Determine if a proposal meets auto-promotion criteria.
 */
export function canAutoPromote(params: {
    riskTier: RiskTier;
    winRate: number;
    confidenceScore: number;
    runCount: number;
    costIncreasePct: number;
    hasRegressions: boolean;
    policyOverrides?: LearningPolicyOverrides;
}): { canAutoPromote: boolean; reasons: string[] } {
    const config = getEffectiveConfig(params.policyOverrides);
    const reasons: string[] = [];

    // Check if auto-promotion is enabled
    if (!config.autoPromotionEnabled) {
        return { canAutoPromote: false, reasons: ["Auto-promotion is disabled"] };
    }

    // Check risk tier
    if (params.riskTier !== "LOW") {
        reasons.push(`Risk tier is ${params.riskTier}, requires human approval`);
        return { canAutoPromote: false, reasons };
    }

    // Check win rate
    if (params.winRate < config.minWinRateForAuto) {
        reasons.push(
            `Win rate ${(params.winRate * 100).toFixed(1)}% below threshold ${(config.minWinRateForAuto * 100).toFixed(1)}%`
        );
    }

    // Check confidence score
    if (params.confidenceScore < config.minConfidenceForAuto) {
        reasons.push(
            `Confidence ${(params.confidenceScore * 100).toFixed(1)}% below threshold ${(config.minConfidenceForAuto * 100).toFixed(1)}%`
        );
    }

    // Check run count
    if (params.runCount < AUTO_PROMOTION.minRunsBeforeAutoPromotion) {
        reasons.push(
            `Run count ${params.runCount} below threshold ${AUTO_PROMOTION.minRunsBeforeAutoPromotion}`
        );
    }

    // Check cost increase
    if (params.costIncreasePct > AUTO_PROMOTION.maxCostIncreasePct) {
        reasons.push(
            `Cost increase ${(params.costIncreasePct * 100).toFixed(1)}% exceeds threshold ${(AUTO_PROMOTION.maxCostIncreasePct * 100).toFixed(1)}%`
        );
    }

    // Check regressions
    if (AUTO_PROMOTION.requireNoRegressions && params.hasRegressions) {
        reasons.push("Guardrail regressions detected");
    }

    return { canAutoPromote: reasons.length === 0, reasons };
}
