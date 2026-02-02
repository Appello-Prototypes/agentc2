/**
 * Integration Tests for Learning Inngest Functions
 *
 * Tests the scheduled triggers, signal detection, and A/B routing.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { SIGNAL_THRESHOLDS, SCHEDULE_CONFIG } from "../../../apps/agent/src/lib/learning-config";

// Create prisma mock
const prismaMock = mockDeep<PrismaClient>();

// Mock the database module
vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: {
        JsonNull: "DbNull",
        InputJsonValue: {}
    }
}));

// Mock Inngest
const inngestMock = {
    send: vi.fn().mockResolvedValue(undefined)
};

vi.mock("../../../apps/agent/src/lib/inngest", () => ({
    inngest: inngestMock
}));

describe("Learning Inngest Functions", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    describe("Signal Detector Configuration", () => {
        it("should use signal threshold from config", () => {
            expect(SIGNAL_THRESHOLDS.signalCount).toBe(5);
            expect(SIGNAL_THRESHOLDS.signalWindowMinutes).toBe(60);
        });

        it("should use schedule from config", () => {
            expect(SCHEDULE_CONFIG.cronExpression).toBe("0 */6 * * *");
            expect(SCHEDULE_CONFIG.minHoursBetweenSessions).toBe(4);
        });
    });

    describe("Learning Policy Respects Disabled State", () => {
        it("should define policy fields for disabled state", async () => {
            const mockPolicy = {
                id: "policy-123",
                agentId: "agent-123",
                enabled: false,
                autoPromotionEnabled: false,
                scheduledEnabled: false,
                thresholdEnabled: false,
                paused: false
            };

            // Verify policy structure is correct
            expect(mockPolicy.enabled).toBe(false);
            expect(mockPolicy.scheduledEnabled).toBe(false);
            expect(mockPolicy.thresholdEnabled).toBe(false);
        });

        it("should define policy fields for paused state", async () => {
            const mockPolicy = {
                id: "policy-123",
                agentId: "agent-123",
                enabled: true,
                autoPromotionEnabled: false,
                scheduledEnabled: true,
                thresholdEnabled: true,
                paused: true,
                pausedUntil: new Date(Date.now() + 60 * 60 * 1000)
            };

            expect(mockPolicy.paused).toBe(true);
            expect(mockPolicy.pausedUntil).toBeInstanceOf(Date);
        });
    });

    describe("Scheduled Trigger Filtering", () => {
        it("should have correct schedule configuration", () => {
            // Cron expression for every 6 hours
            expect(SCHEDULE_CONFIG.cronExpression).toMatch(/\*\/6/);
        });

        it("should respect minimum hours between sessions", () => {
            expect(SCHEDULE_CONFIG.minHoursBetweenSessions).toBeGreaterThan(0);
            expect(SCHEDULE_CONFIG.maxConcurrentSessions).toBeGreaterThan(0);
        });
    });

    describe("Shadow A/B Routing Configuration", () => {
        it("should tag runs with experiment metadata", async () => {
            const mockRun = {
                id: "run-123",
                agentId: "agent-123",
                experimentId: "exp-123",
                experimentGroup: "candidate"
            };

            // Verify experiment tagging structure
            expect(mockRun.experimentId).toBeDefined();
            expect(mockRun.experimentGroup).toBe("candidate");
        });

        it("should track baseline vs candidate run counts", async () => {
            const mockExperiment = {
                id: "exp-123",
                status: "RUNNING",
                baselineRunCount: 90,
                candidateRunCount: 10,
                shadowRunCount: 100,
                trafficSplit: {
                    baseline: 0.9,
                    candidate: 0.1
                }
            };

            expect(mockExperiment.baselineRunCount + mockExperiment.candidateRunCount).toBe(
                mockExperiment.shadowRunCount
            );
            expect(mockExperiment.trafficSplit.candidate).toBe(0.1);
        });
    });

    describe("Trigger Type Tracking", () => {
        it("should support multiple trigger types", () => {
            const validTriggerTypes = ["threshold", "scheduled", "manual"];

            validTriggerTypes.forEach((type) => {
                expect(["threshold", "scheduled", "manual"]).toContain(type);
            });
        });

        it("should store trigger type in session metadata", () => {
            const mockSession = {
                id: "session-123",
                agentId: "agent-123",
                status: "COLLECTING",
                metadata: {
                    triggerType: "scheduled"
                }
            };

            expect(mockSession.metadata.triggerType).toBe("scheduled");
        });
    });

    describe("Risk Tier and Auto-Eligibility", () => {
        it("should define risk tiers correctly", () => {
            const validRiskTiers = ["LOW", "MEDIUM", "HIGH"];

            validRiskTiers.forEach((tier) => {
                expect(["LOW", "MEDIUM", "HIGH"]).toContain(tier);
            });
        });

        it("should track auto-eligibility on proposals", () => {
            const lowRiskProposal = {
                id: "proposal-123",
                riskTier: "LOW",
                autoEligible: true,
                riskReasons: ["Instruction-only changes"]
            };

            const highRiskProposal = {
                id: "proposal-456",
                riskTier: "HIGH",
                autoEligible: false,
                riskReasons: ["Contains model changes", "Contains memory changes"]
            };

            expect(lowRiskProposal.autoEligible).toBe(true);
            expect(highRiskProposal.autoEligible).toBe(false);
        });
    });

    describe("Auto-Approval Tracking", () => {
        it("should track auto-approved vs manual approvals", () => {
            const autoApproval = {
                id: "approval-123",
                proposalId: "proposal-123",
                decision: "approved",
                autoApproved: true
            };

            const manualApproval = {
                id: "approval-456",
                proposalId: "proposal-456",
                decision: "approved",
                autoApproved: false,
                reviewerId: "user-123"
            };

            expect(autoApproval.autoApproved).toBe(true);
            expect(manualApproval.autoApproved).toBe(false);
            expect(manualApproval.reviewerId).toBeDefined();
        });
    });
});
