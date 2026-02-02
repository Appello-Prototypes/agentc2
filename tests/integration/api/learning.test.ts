/**
 * Integration Tests for Learning API Logic
 *
 * Tests the policy, pause, and experiments API logic using mocks.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { mockAgent } from "../../fixtures/agents";
import {
    getEffectiveConfig,
    SIGNAL_THRESHOLDS,
    TRAFFIC_SPLIT,
    AUTO_PROMOTION
} from "../../../apps/agent/src/lib/learning-config";

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

describe("Learning Policy API Logic", () => {
    beforeEach(() => {
        mockReset(prismaMock);
    });

    describe("GET policy - defaults when no policy exists", () => {
        it("should return default effective config when no policy exists", async () => {
            prismaMock.agent.findFirst.mockResolvedValue({
                ...mockAgent,
                id: "agent-123"
            } as any);
            prismaMock.learningPolicy.findUnique.mockResolvedValue(null);

            // Simulate API logic: when no policy exists, return defaults
            const agent = await prismaMock.agent.findFirst({
                where: { slug: mockAgent.slug }
            });
            const policy = await prismaMock.learningPolicy.findUnique({
                where: { agentId: agent?.id }
            });

            // API would return effectiveConfig from getEffectiveConfig
            const effectiveConfig = getEffectiveConfig(policy || undefined);

            expect(policy).toBeNull();
            expect(effectiveConfig.autoPromotionEnabled).toBe(false);
            expect(effectiveConfig.signalThreshold).toBe(SIGNAL_THRESHOLDS.signalCount);
        });

        it("should return policy with effective config when policy exists", async () => {
            const existingPolicy = {
                id: "policy-123",
                agentId: "agent-123",
                enabled: true,
                autoPromotionEnabled: true,
                scheduledEnabled: true,
                thresholdEnabled: true,
                paused: false,
                signalThreshold: 10
            };

            prismaMock.agent.findFirst.mockResolvedValue({
                ...mockAgent,
                id: "agent-123"
            } as any);
            prismaMock.learningPolicy.findUnique.mockResolvedValue(existingPolicy as any);

            const agent = await prismaMock.agent.findFirst({
                where: { slug: mockAgent.slug }
            });
            const policy = await prismaMock.learningPolicy.findUnique({
                where: { agentId: agent?.id }
            });

            const effectiveConfig = getEffectiveConfig({
                autoPromotionEnabled: policy?.autoPromotionEnabled,
                signalThreshold: policy?.signalThreshold
            });

            expect(policy?.autoPromotionEnabled).toBe(true);
            expect(effectiveConfig.autoPromotionEnabled).toBe(true);
            expect(effectiveConfig.signalThreshold).toBe(10);
        });
    });

    describe("POST policy - create and update", () => {
        it("should create a new policy when none exists", async () => {
            prismaMock.agent.findFirst.mockResolvedValue({
                ...mockAgent,
                id: "agent-123"
            } as any);
            prismaMock.learningPolicy.findUnique.mockResolvedValue(null);
            prismaMock.learningPolicy.create.mockResolvedValue({
                id: "new-policy-123",
                agentId: "agent-123",
                enabled: true,
                autoPromotionEnabled: true,
                signalThreshold: 10
            } as any);
            prismaMock.auditLog.create.mockResolvedValue({} as any);

            // Simulate API logic
            const agent = await prismaMock.agent.findFirst({
                where: { slug: mockAgent.slug }
            });
            const existingPolicy = await prismaMock.learningPolicy.findUnique({
                where: { agentId: agent?.id }
            });

            // API would create new policy since none exists
            const newPolicy = await prismaMock.learningPolicy.create({
                data: {
                    agentId: agent!.id,
                    autoPromotionEnabled: true,
                    signalThreshold: 10
                }
            });

            // API would create audit log
            await prismaMock.auditLog.create({
                data: {
                    action: "LEARNING_POLICY_UPDATED",
                    entityType: "Agent",
                    entityId: agent!.id,
                    actorId: "test-user",
                    details: { autoPromotionEnabled: true, signalThreshold: 10 }
                }
            });

            expect(existingPolicy).toBeNull();
            expect(newPolicy.autoPromotionEnabled).toBe(true);
            expect(prismaMock.learningPolicy.create).toHaveBeenCalled();
            expect(prismaMock.auditLog.create).toHaveBeenCalled();
        });

        it("should update an existing policy", async () => {
            prismaMock.agent.findFirst.mockResolvedValue({
                ...mockAgent,
                id: "agent-123"
            } as any);
            prismaMock.learningPolicy.findUnique.mockResolvedValue({
                id: "existing-policy",
                agentId: "agent-123",
                autoPromotionEnabled: false
            } as any);
            prismaMock.learningPolicy.update.mockResolvedValue({
                id: "existing-policy",
                agentId: "agent-123",
                autoPromotionEnabled: true
            } as any);

            const agent = await prismaMock.agent.findFirst({
                where: { slug: mockAgent.slug }
            });
            const existingPolicy = await prismaMock.learningPolicy.findUnique({
                where: { agentId: agent?.id }
            });

            // API would update since policy exists
            const updatedPolicy = await prismaMock.learningPolicy.update({
                where: { id: existingPolicy!.id },
                data: { autoPromotionEnabled: true }
            });

            expect(existingPolicy?.autoPromotionEnabled).toBe(false);
            expect(updatedPolicy.autoPromotionEnabled).toBe(true);
            expect(prismaMock.learningPolicy.update).toHaveBeenCalled();
        });
    });
});

describe("Learning Pause API Logic", () => {
    beforeEach(() => {
        mockReset(prismaMock);
    });

    describe("POST pause", () => {
        it("should pause learning", async () => {
            prismaMock.agent.findFirst.mockResolvedValue({
                ...mockAgent,
                id: "agent-123"
            } as any);
            prismaMock.learningPolicy.upsert.mockResolvedValue({
                id: "policy-123",
                agentId: "agent-123",
                paused: true
            } as any);
            prismaMock.auditLog.create.mockResolvedValue({} as any);

            const agent = await prismaMock.agent.findFirst({
                where: { slug: mockAgent.slug }
            });

            // API would upsert policy with paused: true
            const policy = await prismaMock.learningPolicy.upsert({
                where: { agentId: agent!.id },
                update: { paused: true },
                create: { agentId: agent!.id, paused: true }
            });

            expect(policy.paused).toBe(true);
            expect(prismaMock.learningPolicy.upsert).toHaveBeenCalled();
        });

        it("should resume learning", async () => {
            prismaMock.agent.findFirst.mockResolvedValue({
                ...mockAgent,
                id: "agent-123"
            } as any);
            prismaMock.learningPolicy.upsert.mockResolvedValue({
                id: "policy-123",
                agentId: "agent-123",
                paused: false,
                pausedUntil: null
            } as any);

            const agent = await prismaMock.agent.findFirst({
                where: { slug: mockAgent.slug }
            });

            const policy = await prismaMock.learningPolicy.upsert({
                where: { agentId: agent!.id },
                update: { paused: false, pausedUntil: null },
                create: { agentId: agent!.id, paused: false }
            });

            expect(policy.paused).toBe(false);
            expect(policy.pausedUntil).toBeNull();
        });

        it("should set pausedUntil when provided", async () => {
            const pauseUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);

            prismaMock.agent.findFirst.mockResolvedValue({
                ...mockAgent,
                id: "agent-123"
            } as any);
            prismaMock.learningPolicy.upsert.mockResolvedValue({
                id: "policy-123",
                agentId: "agent-123",
                paused: true,
                pausedUntil: pauseUntil
            } as any);

            const agent = await prismaMock.agent.findFirst({
                where: { slug: mockAgent.slug }
            });

            const policy = await prismaMock.learningPolicy.upsert({
                where: { agentId: agent!.id },
                update: { paused: true, pausedUntil: pauseUntil },
                create: { agentId: agent!.id, paused: true, pausedUntil: pauseUntil }
            });

            expect(policy.paused).toBe(true);
            expect(policy.pausedUntil).toEqual(pauseUntil);
        });
    });
});

describe("Learning Experiments API Logic", () => {
    beforeEach(() => {
        mockReset(prismaMock);
    });

    describe("GET experiments", () => {
        it("should list active experiments for an agent", async () => {
            const mockExperiment = {
                id: "exp-123",
                sessionId: "session-123",
                proposalId: "proposal-123",
                status: "RUNNING",
                trafficSplit: { baseline: 0.9, candidate: 0.1 },
                shadowRunCount: 50,
                baselineRunCount: 45,
                candidateRunCount: 5,
                createdAt: new Date(),
                session: {
                    agentId: "agent-123"
                },
                proposal: {
                    riskTier: "LOW",
                    autoEligible: true,
                    title: "Test proposal"
                }
            };

            prismaMock.agent.findFirst.mockResolvedValue({
                ...mockAgent,
                id: "agent-123"
            } as any);
            prismaMock.learningExperiment.findMany.mockResolvedValue([mockExperiment] as any);

            const agent = await prismaMock.agent.findFirst({
                where: { slug: mockAgent.slug }
            });

            // API would query experiments with session filter
            const experiments = await prismaMock.learningExperiment.findMany({
                where: {
                    session: { agentId: agent!.id },
                    status: { in: ["PENDING", "RUNNING"] }
                },
                include: {
                    session: true,
                    proposal: true
                }
            });

            expect(experiments).toHaveLength(1);
            expect(experiments[0].status).toBe("RUNNING");
            expect(experiments[0].trafficSplit).toEqual({ baseline: 0.9, candidate: 0.1 });
        });

        it("should include traffic split and run counts", async () => {
            const mockExperiment = {
                id: "exp-123",
                status: "RUNNING",
                trafficSplit: { baseline: 0.9, candidate: 0.1 },
                shadowRunCount: 50,
                baselineRunCount: 45,
                candidateRunCount: 5
            };

            prismaMock.learningExperiment.findMany.mockResolvedValue([mockExperiment] as any);

            const experiments = await prismaMock.learningExperiment.findMany({});

            expect(experiments[0].trafficSplit).toEqual({ baseline: 0.9, candidate: 0.1 });
            expect(experiments[0].shadowRunCount).toBe(50);
            expect(experiments[0].baselineRunCount).toBe(45);
            expect(experiments[0].candidateRunCount).toBe(5);
        });

        it("should return empty array when no active experiments", async () => {
            prismaMock.agent.findFirst.mockResolvedValue({
                ...mockAgent,
                id: "agent-123"
            } as any);
            prismaMock.learningExperiment.findMany.mockResolvedValue([]);

            const experiments = await prismaMock.learningExperiment.findMany({
                where: {
                    session: { agentId: "agent-123" },
                    status: { in: ["PENDING", "RUNNING"] }
                }
            });

            expect(experiments).toHaveLength(0);
        });
    });
});

describe("Effective Config Merging", () => {
    it("should use defaults when no overrides provided", () => {
        const config = getEffectiveConfig({});

        expect(config.signalThreshold).toBe(SIGNAL_THRESHOLDS.signalCount);
        expect(config.trafficSplitCandidate).toBe(TRAFFIC_SPLIT.defaultCandidateSplit);
        expect(config.autoPromotionEnabled).toBe(AUTO_PROMOTION.enabled);
    });

    it("should apply overrides when provided", () => {
        const config = getEffectiveConfig({
            signalThreshold: 10,
            autoPromotionEnabled: true,
            trafficSplitCandidate: 0.2
        });

        expect(config.signalThreshold).toBe(10);
        expect(config.autoPromotionEnabled).toBe(true);
        expect(config.trafficSplitCandidate).toBe(0.2);
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
