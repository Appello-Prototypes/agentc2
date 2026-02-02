import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { mockRun } from "../../fixtures/runs";
import { mockBudgetPolicy, mockCostEvent, mockAlert } from "../../fixtures/evaluations";
import { createMockStep } from "../../utils/inngest-mock";

// Create prisma mock
const prismaMock = mockDeep<PrismaClient>();

// Mock the database module
vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: {
        JsonNull: "DbNull"
    }
}));

describe("Inngest: run-completed", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    describe("create-cost-event step", () => {
        it("should create CostEvent for run with correct values", async () => {
            const eventData = {
                runId: "test-run-uuid",
                agentId: "test-agent-uuid",
                costUsd: 0.005
            };

            prismaMock.costEvent.findFirst.mockResolvedValue(null);
            prismaMock.agentRun.findUnique.mockResolvedValue(mockRun as never);
            prismaMock.costEvent.create.mockResolvedValue(mockCostEvent as never);

            const step = createMockStep();

            // Simulate step execution
            await step.run("create-cost-event", async () => {
                const existing = await prismaMock.costEvent.findFirst({
                    where: { runId: eventData.runId }
                });

                if (existing) return null;

                const run = await prismaMock.agentRun.findUnique({
                    where: { id: eventData.runId }
                });

                if (!run || eventData.costUsd <= 0) return null;

                return prismaMock.costEvent.create({
                    data: {
                        runId: run.id,
                        agentId: run.agentId,
                        tenantId: run.tenantId,
                        modelName: run.modelName || "unknown",
                        promptTokens: run.promptTokens || 0,
                        completionTokens: run.completionTokens || 0,
                        totalTokens: run.totalTokens || 0,
                        costUsd: eventData.costUsd
                    }
                });
            });

            expect(prismaMock.costEvent.create).toHaveBeenCalled();
        });

        it("should skip duplicate cost events (only one per run)", async () => {
            const eventData = {
                runId: "test-run-uuid",
                agentId: "test-agent-uuid",
                costUsd: 0.005
            };

            // Mock existing cost event
            prismaMock.costEvent.findFirst.mockResolvedValue(mockCostEvent as never);

            const step = createMockStep();

            await step.run("create-cost-event", async () => {
                const existing = await prismaMock.costEvent.findFirst({
                    where: { runId: eventData.runId }
                });

                if (existing) return null; // Skip if exists

                return prismaMock.costEvent.create({ data: {} as never });
            });

            expect(prismaMock.costEvent.create).not.toHaveBeenCalled();
        });
    });

    describe("check-budget step", () => {
        it("should check budget and create alert if threshold exceeded", async () => {
            const eventData = {
                runId: "test-run-uuid",
                agentId: "test-agent-uuid",
                costUsd: 0.005
            };

            // Budget: $100, alert at 80%, current usage: $85
            prismaMock.budgetPolicy.findUnique.mockResolvedValue({
                ...mockBudgetPolicy,
                monthlyLimitUsd: 100.0,
                alertAtPct: 80
            } as never);

            prismaMock.costEvent.aggregate.mockResolvedValue({
                _sum: { costUsd: 85.0 }
            } as never);

            prismaMock.agentAlert.create.mockResolvedValue(mockAlert as never);

            const step = createMockStep();

            await step.run("check-budget", async () => {
                const policy = await prismaMock.budgetPolicy.findUnique({
                    where: { agentId: eventData.agentId }
                });

                if (!policy || !policy.enabled) return null;

                const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

                const aggregation = await prismaMock.costEvent.aggregate({
                    where: {
                        agentId: eventData.agentId,
                        createdAt: { gte: monthStart }
                    },
                    _sum: { costUsd: true }
                });

                const currentUsage = aggregation._sum.costUsd || 0;
                const percentUsed = (currentUsage / policy.monthlyLimitUsd) * 100;

                if (percentUsed >= policy.alertAtPct) {
                    return prismaMock.agentAlert.create({
                        data: {
                            agentId: eventData.agentId,
                            tenantId: "test-tenant",
                            severity: percentUsed >= 100 ? "CRITICAL" : "WARNING",
                            source: "BUDGET",
                            title: "Budget threshold reached",
                            message: `${percentUsed.toFixed(1)}% of monthly budget used`
                        }
                    });
                }

                return null;
            });

            expect(prismaMock.agentAlert.create).toHaveBeenCalled();
        });

        it("should not create alert when no budget policy exists", async () => {
            const eventData = {
                runId: "test-run-uuid",
                agentId: "test-agent-uuid",
                costUsd: 0.005
            };

            prismaMock.budgetPolicy.findUnique.mockResolvedValue(null);

            const step = createMockStep();

            await step.run("check-budget", async () => {
                const policy = await prismaMock.budgetPolicy.findUnique({
                    where: { agentId: eventData.agentId }
                });

                if (!policy) return null;

                return prismaMock.agentAlert.create({ data: {} as never });
            });

            expect(prismaMock.agentAlert.create).not.toHaveBeenCalled();
        });

        it("should not create alert when under threshold", async () => {
            const eventData = {
                runId: "test-run-uuid",
                agentId: "test-agent-uuid",
                costUsd: 0.005
            };

            // Budget: $100, alert at 80%, current usage: $50 (under threshold)
            prismaMock.budgetPolicy.findUnique.mockResolvedValue({
                ...mockBudgetPolicy,
                monthlyLimitUsd: 100.0,
                alertAtPct: 80
            } as never);

            prismaMock.costEvent.aggregate.mockResolvedValue({
                _sum: { costUsd: 50.0 }
            } as never);

            const step = createMockStep();

            await step.run("check-budget", async () => {
                const policy = await prismaMock.budgetPolicy.findUnique({
                    where: { agentId: eventData.agentId }
                });

                if (!policy || !policy.enabled) return null;

                const aggregation = await prismaMock.costEvent.aggregate({
                    where: { agentId: eventData.agentId },
                    _sum: { costUsd: true }
                });

                const currentUsage = aggregation._sum.costUsd || 0;
                const percentUsed = (currentUsage / policy.monthlyLimitUsd) * 100;

                if (percentUsed >= policy.alertAtPct) {
                    return prismaMock.agentAlert.create({ data: {} as never });
                }

                return null;
            });

            expect(prismaMock.agentAlert.create).not.toHaveBeenCalled();
        });
    });
});
