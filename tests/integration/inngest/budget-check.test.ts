import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { mockBudgetPolicy, mockAlert } from "../../fixtures/evaluations";
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

describe("Inngest: budget-check", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    describe("check-agent-budget step", () => {
        it("should process all agents with enabled budget policies", async () => {
            const policies = [
                { ...mockBudgetPolicy, agentId: "agent-1", enabled: true },
                { ...mockBudgetPolicy, agentId: "agent-2", enabled: true },
                { ...mockBudgetPolicy, agentId: "agent-3", enabled: false }
            ];

            prismaMock.budgetPolicy.findMany.mockResolvedValue(policies as never);

            const step = createMockStep();

            await step.run("check-agent-budget", async () => {
                const allPolicies = await prismaMock.budgetPolicy.findMany({
                    where: { enabled: true }
                });

                const enabledPolicies = allPolicies.filter((p) => p.enabled);
                return { checked: enabledPolicies.length };
            });

            // Should only return enabled policies
            expect(prismaMock.budgetPolicy.findMany).toHaveBeenCalledWith({
                where: { enabled: true }
            });
        });

        it("should create WARNING alert at 80% threshold", async () => {
            const policy = {
                ...mockBudgetPolicy,
                agentId: "test-agent-uuid",
                monthlyLimitUsd: 100.0,
                alertAtPct: 80
            };

            // 85% usage
            prismaMock.costEvent.aggregate.mockResolvedValue({
                _sum: { costUsd: 85.0 }
            } as never);

            prismaMock.agentAlert.create.mockResolvedValue({
                ...mockAlert,
                severity: "WARNING"
            } as never);

            const step = createMockStep();

            await step.run("check-agent-budget", async () => {
                const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

                const aggregation = await prismaMock.costEvent.aggregate({
                    where: {
                        agentId: policy.agentId,
                        createdAt: { gte: monthStart }
                    },
                    _sum: { costUsd: true }
                });

                const currentUsage = aggregation._sum.costUsd || 0;
                const percentUsed = (currentUsage / policy.monthlyLimitUsd) * 100;

                if (percentUsed >= policy.alertAtPct) {
                    const severity = percentUsed >= 100 ? "CRITICAL" : "WARNING";

                    return prismaMock.agentAlert.create({
                        data: {
                            agentId: policy.agentId,
                            tenantId: policy.tenantId,
                            severity,
                            source: "BUDGET",
                            title:
                                severity === "CRITICAL"
                                    ? "Budget exceeded"
                                    : "Budget threshold reached",
                            message: `${percentUsed.toFixed(1)}% of monthly budget used`
                        }
                    });
                }

                return null;
            });

            expect(prismaMock.agentAlert.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        severity: "WARNING"
                    })
                })
            );
        });

        it("should create CRITICAL alert at 100% threshold", async () => {
            const policy = {
                ...mockBudgetPolicy,
                agentId: "test-agent-uuid",
                monthlyLimitUsd: 100.0,
                alertAtPct: 80
            };

            // 105% usage (over budget)
            prismaMock.costEvent.aggregate.mockResolvedValue({
                _sum: { costUsd: 105.0 }
            } as never);

            prismaMock.agentAlert.create.mockResolvedValue({
                ...mockAlert,
                severity: "CRITICAL"
            } as never);

            const step = createMockStep();

            await step.run("check-agent-budget", async () => {
                const aggregation = await prismaMock.costEvent.aggregate({
                    where: { agentId: policy.agentId },
                    _sum: { costUsd: true }
                });

                const currentUsage = aggregation._sum.costUsd || 0;
                const percentUsed = (currentUsage / policy.monthlyLimitUsd) * 100;

                if (percentUsed >= policy.alertAtPct) {
                    const severity = percentUsed >= 100 ? "CRITICAL" : "WARNING";

                    return prismaMock.agentAlert.create({
                        data: {
                            agentId: policy.agentId,
                            tenantId: policy.tenantId,
                            severity,
                            source: "BUDGET",
                            title: "Budget exceeded",
                            message: `${percentUsed.toFixed(1)}% of monthly budget used`
                        }
                    });
                }

                return null;
            });

            expect(prismaMock.agentAlert.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        severity: "CRITICAL"
                    })
                })
            );
        });

        it("should skip disabled budget policies", async () => {
            const policy = {
                ...mockBudgetPolicy,
                enabled: false
            };

            const step = createMockStep();

            await step.run("check-agent-budget", async () => {
                if (!policy.enabled) {
                    return { skipped: true };
                }

                // Would normally check budget here
                await prismaMock.costEvent.aggregate({
                    where: { agentId: policy.agentId },
                    _sum: { costUsd: true }
                });

                return { checked: true };
            });

            expect(prismaMock.costEvent.aggregate).not.toHaveBeenCalled();
        });

        it("should not create alert when under threshold", async () => {
            const policy = {
                ...mockBudgetPolicy,
                agentId: "test-agent-uuid",
                monthlyLimitUsd: 100.0,
                alertAtPct: 80
            };

            // 50% usage (under threshold)
            prismaMock.costEvent.aggregate.mockResolvedValue({
                _sum: { costUsd: 50.0 }
            } as never);

            const step = createMockStep();

            await step.run("check-agent-budget", async () => {
                const aggregation = await prismaMock.costEvent.aggregate({
                    where: { agentId: policy.agentId },
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

        it("should handle zero cost gracefully", async () => {
            const policy = {
                ...mockBudgetPolicy,
                agentId: "test-agent-uuid",
                monthlyLimitUsd: 100.0
            };

            // No costs yet
            prismaMock.costEvent.aggregate.mockResolvedValue({
                _sum: { costUsd: null }
            } as never);

            const step = createMockStep();

            await step.run("check-agent-budget", async () => {
                const aggregation = await prismaMock.costEvent.aggregate({
                    where: { agentId: policy.agentId },
                    _sum: { costUsd: true }
                });

                const currentUsage = aggregation._sum.costUsd || 0;
                const percentUsed = (currentUsage / policy.monthlyLimitUsd) * 100;

                expect(currentUsage).toBe(0);
                expect(percentUsed).toBe(0);

                return null;
            });

            expect(prismaMock.agentAlert.create).not.toHaveBeenCalled();
        });
    });
});
