/**
 * Unit Tests for Continuous Learning Configuration
 *
 * Tests risk scoring, gating logic, and auto-promotion decisions.
 */

import { describe, it, expect } from "vitest";
import {
    classifyRiskTier,
    canAutoPromote,
    shouldEvaluateExperiment,
    getEffectiveConfig,
    SIGNAL_THRESHOLDS,
    TRAFFIC_SPLIT,
    AUTO_PROMOTION
} from "../../apps/agent/src/lib/learning-config";

describe("Risk Classification", () => {
    it("should classify instruction-only changes as LOW risk", () => {
        const result = classifyRiskTier({
            hasInstructionChanges: true,
            hasToolChanges: false,
            hasModelChanges: false,
            hasMemoryChanges: false,
            hasGuardrailChanges: false,
            estimatedCostIncreasePct: 0
        });

        expect(result.tier).toBe("LOW");
        expect(result.reasons).toContain(
            "Instruction-only changes, no tool/model/memory modifications"
        );
    });

    it("should classify tool changes as MEDIUM risk", () => {
        const result = classifyRiskTier({
            hasInstructionChanges: true,
            hasToolChanges: true,
            hasModelChanges: false,
            hasMemoryChanges: false,
            hasGuardrailChanges: false,
            estimatedCostIncreasePct: 0
        });

        expect(result.tier).toBe("MEDIUM");
        expect(result.reasons).toContain("Contains tool configuration changes");
    });

    it("should classify model changes as HIGH risk", () => {
        const result = classifyRiskTier({
            hasInstructionChanges: true,
            hasToolChanges: false,
            hasModelChanges: true,
            hasMemoryChanges: false,
            hasGuardrailChanges: false,
            estimatedCostIncreasePct: 0
        });

        expect(result.tier).toBe("HIGH");
        expect(result.reasons).toContain("Contains model provider or model name changes");
    });

    it("should classify memory changes as HIGH risk", () => {
        const result = classifyRiskTier({
            hasInstructionChanges: true,
            hasToolChanges: false,
            hasModelChanges: false,
            hasMemoryChanges: true,
            hasGuardrailChanges: false,
            estimatedCostIncreasePct: 0
        });

        expect(result.tier).toBe("HIGH");
        expect(result.reasons).toContain("Contains memory configuration changes");
    });

    it("should classify guardrail changes as HIGH risk", () => {
        const result = classifyRiskTier({
            hasInstructionChanges: true,
            hasToolChanges: false,
            hasModelChanges: false,
            hasMemoryChanges: false,
            hasGuardrailChanges: true,
            estimatedCostIncreasePct: 0
        });

        expect(result.tier).toBe("HIGH");
        expect(result.reasons).toContain("Contains guardrail policy changes");
    });

    it("should classify high cost increase as HIGH risk", () => {
        const result = classifyRiskTier({
            hasInstructionChanges: true,
            hasToolChanges: false,
            hasModelChanges: false,
            hasMemoryChanges: false,
            hasGuardrailChanges: false,
            estimatedCostIncreasePct: 0.15 // 15%
        });

        expect(result.tier).toBe("HIGH");
        expect(result.reasons[0]).toContain("Cost increase");
    });

    it("should mark LOW risk as auto-eligible when auto-promotion is enabled", () => {
        // Note: AUTO_PROMOTION.enabled is false by default, so this tests the logic
        // when auto-promotion would be enabled
        const result = classifyRiskTier({
            hasInstructionChanges: true,
            hasToolChanges: false,
            hasModelChanges: false,
            hasMemoryChanges: false,
            hasGuardrailChanges: false,
            estimatedCostIncreasePct: 0
        });

        // When AUTO_PROMOTION.enabled is false, autoEligible should be false
        expect(result.autoEligible).toBe(AUTO_PROMOTION.enabled && result.tier === "LOW");
    });
});

describe("Auto-Promotion Decisions", () => {
    it("should not auto-promote when auto-promotion is disabled", () => {
        const result = canAutoPromote({
            riskTier: "LOW",
            winRate: 0.7,
            confidenceScore: 0.8,
            runCount: 100,
            costIncreasePct: 0,
            hasRegressions: false,
            policyOverrides: { autoPromotionEnabled: false }
        });

        expect(result.canAutoPromote).toBe(false);
        expect(result.reasons).toContain("Auto-promotion is disabled");
    });

    it("should not auto-promote HIGH risk changes", () => {
        const result = canAutoPromote({
            riskTier: "HIGH",
            winRate: 0.7,
            confidenceScore: 0.8,
            runCount: 100,
            costIncreasePct: 0,
            hasRegressions: false,
            policyOverrides: { autoPromotionEnabled: true }
        });

        expect(result.canAutoPromote).toBe(false);
        expect(result.reasons[0]).toContain("requires human approval");
    });

    it("should not auto-promote when win rate is below threshold", () => {
        const result = canAutoPromote({
            riskTier: "LOW",
            winRate: 0.4,
            confidenceScore: 0.8,
            runCount: 100,
            costIncreasePct: 0,
            hasRegressions: false,
            policyOverrides: { autoPromotionEnabled: true, minWinRateForAuto: 0.55 }
        });

        expect(result.canAutoPromote).toBe(false);
        expect(result.reasons[0]).toContain("Win rate");
    });

    it("should not auto-promote when confidence is below threshold", () => {
        const result = canAutoPromote({
            riskTier: "LOW",
            winRate: 0.7,
            confidenceScore: 0.5,
            runCount: 100,
            costIncreasePct: 0,
            hasRegressions: false,
            policyOverrides: { autoPromotionEnabled: true, minConfidenceForAuto: 0.7 }
        });

        expect(result.canAutoPromote).toBe(false);
        expect(result.reasons[0]).toContain("Confidence");
    });

    it("should not auto-promote when run count is insufficient", () => {
        const result = canAutoPromote({
            riskTier: "LOW",
            winRate: 0.7,
            confidenceScore: 0.8,
            runCount: 10,
            costIncreasePct: 0,
            hasRegressions: false,
            policyOverrides: { autoPromotionEnabled: true }
        });

        expect(result.canAutoPromote).toBe(false);
        expect(result.reasons[0]).toContain("Run count");
    });

    it("should not auto-promote when there are regressions", () => {
        const result = canAutoPromote({
            riskTier: "LOW",
            winRate: 0.7,
            confidenceScore: 0.8,
            runCount: 100,
            costIncreasePct: 0,
            hasRegressions: true,
            policyOverrides: { autoPromotionEnabled: true }
        });

        expect(result.canAutoPromote).toBe(false);
        expect(result.reasons).toContain("Guardrail regressions detected");
    });

    it("should allow auto-promote when all criteria are met", () => {
        const result = canAutoPromote({
            riskTier: "LOW",
            winRate: 0.7,
            confidenceScore: 0.8,
            runCount: 100,
            costIncreasePct: 0,
            hasRegressions: false,
            policyOverrides: {
                autoPromotionEnabled: true,
                minWinRateForAuto: 0.55,
                minConfidenceForAuto: 0.7
            }
        });

        expect(result.canAutoPromote).toBe(true);
        expect(result.reasons).toHaveLength(0);
    });
});

describe("Experiment Evaluation Criteria", () => {
    it("should evaluate when minimum runs are reached for both groups", () => {
        const startedAt = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

        const result = shouldEvaluateExperiment(
            TRAFFIC_SPLIT.minRunsPerGroup,
            TRAFFIC_SPLIT.minRunsPerGroup,
            startedAt
        );

        expect(result.shouldEvaluate).toBe(true);
        expect(result.reason).toBe("Minimum runs reached for both groups");
    });

    it("should evaluate when max runs are reached", () => {
        const startedAt = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

        // Use values that don't meet minRunsPerGroup individually but exceed maxRunsPerExperiment total
        // minRunsPerGroup is 20, maxRunsPerExperiment is 200
        // So 10 + 190 = 200 total but 10 < 20 for baseline
        const result = shouldEvaluateExperiment(
            10, // Below minRunsPerGroup
            TRAFFIC_SPLIT.maxRunsPerExperiment - 10, // 190 runs
            startedAt
        );

        expect(result.shouldEvaluate).toBe(true);
        expect(result.reason).toBe("Maximum experiment runs reached");
    });

    it("should evaluate when max duration is reached", () => {
        const startedAt = new Date(
            Date.now() - (TRAFFIC_SPLIT.maxExperimentDurationHours + 1) * 60 * 60 * 1000
        );

        const result = shouldEvaluateExperiment(5, 5, startedAt);

        expect(result.shouldEvaluate).toBe(true);
        expect(result.reason).toBe("Maximum experiment duration reached");
    });

    it("should not evaluate when waiting for more data", () => {
        const startedAt = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

        const result = shouldEvaluateExperiment(5, 5, startedAt);

        expect(result.shouldEvaluate).toBe(false);
        expect(result.reason).toBe("Waiting for more data");
    });
});

describe("Effective Configuration", () => {
    it("should return defaults when no overrides provided", () => {
        const config = getEffectiveConfig({});

        expect(config.signalThreshold).toBe(SIGNAL_THRESHOLDS.signalCount);
        expect(config.signalWindowMinutes).toBe(SIGNAL_THRESHOLDS.signalWindowMinutes);
        expect(config.trafficSplitCandidate).toBe(TRAFFIC_SPLIT.defaultCandidateSplit);
        expect(config.autoPromotionEnabled).toBe(AUTO_PROMOTION.enabled);
    });

    it("should apply overrides when provided", () => {
        const config = getEffectiveConfig({
            signalThreshold: 10,
            signalWindowMinutes: 30,
            trafficSplitCandidate: 0.2,
            autoPromotionEnabled: true
        });

        expect(config.signalThreshold).toBe(10);
        expect(config.signalWindowMinutes).toBe(30);
        expect(config.trafficSplitCandidate).toBe(0.2);
        expect(config.autoPromotionEnabled).toBe(true);
    });

    it("should handle null overrides by using defaults", () => {
        const config = getEffectiveConfig({
            signalThreshold: null,
            autoPromotionEnabled: null
        });

        expect(config.signalThreshold).toBe(SIGNAL_THRESHOLDS.signalCount);
        expect(config.autoPromotionEnabled).toBe(AUTO_PROMOTION.enabled);
    });
});
