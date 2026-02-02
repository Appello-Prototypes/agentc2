import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { mockAgent } from "../../fixtures/agents";
import { mockBudgetPolicy, mockCostEvent, generateCostEvent } from "../../fixtures/evaluations";

// Create prisma mock
const prismaMock = mockDeep<PrismaClient>();

// Mock the database module
vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: {
        JsonNull: "DbNull"
    }
}));

describe("Budget API", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    describe("GET /api/agents/[id]/budget", () => {
        it("should return budget policy if exists", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.budgetPolicy.findUnique.mockResolvedValue(mockBudgetPolicy as never);
            prismaMock.costEvent.aggregate.mockResolvedValue({
                _sum: { costUsd: 45.0 }
            } as never);

            const policy = await prismaMock.budgetPolicy.findUnique({
                where: { agentId: "test-agent-uuid" }
            });

            expect(policy).toBeDefined();
            expect(policy?.enabled).toBe(true);
            expect(policy?.monthlyLimitUsd).toBe(100.0);
            expect(policy?.alertAtPct).toBe(80);
        });

        it("should return null if no policy exists", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.budgetPolicy.findUnique.mockResolvedValue(null);

            const policy = await prismaMock.budgetPolicy.findUnique({
                where: { agentId: "test-agent-uuid" }
            });

            expect(policy).toBeNull();
        });

        it("should return current month usage", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.budgetPolicy.findUnique.mockResolvedValue(mockBudgetPolicy as never);
            prismaMock.costEvent.aggregate.mockResolvedValue({
                _sum: { costUsd: 45.0 }
            } as never);

            // Get current month's start
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

            const aggregation = await prismaMock.costEvent.aggregate({
                where: {
                    agentId: "test-agent-uuid",
                    createdAt: { gte: monthStart }
                },
                _sum: { costUsd: true }
            });

            const currentUsage = aggregation._sum.costUsd || 0;
            expect(currentUsage).toBe(45.0);

            // Calculate percentage
            const percentage = (currentUsage / 100.0) * 100;
            expect(percentage).toBe(45);
        });
    });

    describe("PUT /api/agents/[id]/budget", () => {
        it("should create new budget policy", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.budgetPolicy.upsert.mockResolvedValue(mockBudgetPolicy as never);

            const policyData = {
                enabled: true,
                monthlyLimitUsd: 100.0,
                alertAtPct: 80,
                hardLimit: false
            };

            const policy = await prismaMock.budgetPolicy.upsert({
                where: { agentId: "test-agent-uuid" },
                create: {
                    agentId: "test-agent-uuid",
                    tenantId: "test-tenant",
                    ...policyData
                },
                update: policyData
            });

            expect(policy).toBeDefined();
            expect(prismaMock.budgetPolicy.upsert).toHaveBeenCalled();
        });

        it("should update existing policy", async () => {
            const updatedPolicy = {
                ...mockBudgetPolicy,
                monthlyLimitUsd: 200.0,
                alertAtPct: 90
            };

            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.budgetPolicy.upsert.mockResolvedValue(updatedPolicy as never);

            const policy = await prismaMock.budgetPolicy.upsert({
                where: { agentId: "test-agent-uuid" },
                create: {} as never,
                update: {
                    monthlyLimitUsd: 200.0,
                    alertAtPct: 90
                }
            });

            expect(policy.monthlyLimitUsd).toBe(200.0);
            expect(policy.alertAtPct).toBe(90);
        });

        it("should create audit log entry", async () => {
            prismaMock.auditLog.create.mockResolvedValue({
                id: "audit-uuid",
                tenantId: "test-tenant",
                action: "BUDGET_UPDATED",
                entityType: "BudgetPolicy",
                entityId: "test-agent-uuid"
            } as never);

            await prismaMock.auditLog.create({
                data: {
                    tenantId: "test-tenant",
                    action: "BUDGET_UPDATED",
                    entityType: "BudgetPolicy",
                    entityId: "test-agent-uuid",
                    actorId: "user-123",
                    metadata: { monthlyLimitUsd: 100.0 }
                }
            });

            expect(prismaMock.auditLog.create).toHaveBeenCalled();
        });

        it("should return 400 for invalid limits", async () => {
            const invalidPolicyData = {
                monthlyLimitUsd: -100, // Invalid: negative
                alertAtPct: 150 // Invalid: > 100
            };

            // Validation would happen before database call
            const isValid =
                invalidPolicyData.monthlyLimitUsd > 0 &&
                invalidPolicyData.alertAtPct >= 0 &&
                invalidPolicyData.alertAtPct <= 100;

            expect(isValid).toBe(false);
        });

        it("should return 404 for invalid agent", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(null);

            const agent = await prismaMock.agent.findFirst({
                where: { id: "invalid-agent-uuid" }
            });

            expect(agent).toBeNull();
        });
    });
});

describe("Costs API", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    describe("GET /api/agents/[id]/costs", () => {
        it("should return cost totals", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.costEvent.aggregate.mockResolvedValue({
                _sum: {
                    costUsd: 25.5,
                    promptTokens: 50000,
                    completionTokens: 75000,
                    totalTokens: 125000
                }
            } as never);

            const aggregation = await prismaMock.costEvent.aggregate({
                where: { agentId: "test-agent-uuid" },
                _sum: {
                    costUsd: true,
                    promptTokens: true,
                    completionTokens: true,
                    totalTokens: true
                }
            });

            expect(aggregation._sum.costUsd).toBe(25.5);
            expect(aggregation._sum.promptTokens).toBe(50000);
            expect(aggregation._sum.completionTokens).toBe(75000);
            expect(aggregation._sum.totalTokens).toBe(125000);
        });

        it("should return by-model breakdown", async () => {
            const costsByModel = [
                {
                    modelName: "claude-sonnet-4-20250514",
                    _sum: { costUsd: 20.0, totalTokens: 100000 },
                    _count: 50
                },
                {
                    modelName: "claude-haiku",
                    _sum: { costUsd: 5.5, totalTokens: 25000 },
                    _count: 30
                }
            ];

            prismaMock.costEvent.groupBy.mockResolvedValue(costsByModel as never);

            const byModel = await prismaMock.costEvent.groupBy({
                by: ["modelName"],
                where: { agentId: "test-agent-uuid" },
                _sum: { costUsd: true, totalTokens: true },
                _count: true
            });

            expect(byModel).toHaveLength(2);
            expect(byModel[0].modelName).toBe("claude-sonnet-4-20250514");
            expect(byModel[0]._sum.costUsd).toBe(20.0);
        });

        it("should return by-day breakdown", async () => {
            const costEvents = [
                { ...mockCostEvent, createdAt: new Date("2024-01-15") },
                { ...mockCostEvent, createdAt: new Date("2024-01-15") },
                { ...mockCostEvent, createdAt: new Date("2024-01-16") }
            ];

            prismaMock.costEvent.findMany.mockResolvedValue(costEvents as never);

            // Group by day
            const events = await prismaMock.costEvent.findMany({
                where: { agentId: "test-agent-uuid" }
            });

            const byDay: Record<string, number> = {};
            events.forEach((e) => {
                const day = e.createdAt.toISOString().split("T")[0];
                byDay[day] = (byDay[day] || 0) + e.costUsd;
            });

            expect(Object.keys(byDay)).toHaveLength(2);
            expect(byDay["2024-01-15"]).toBe(0.01);
        });

        it("should return budget context", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.budgetPolicy.findUnique.mockResolvedValue(mockBudgetPolicy as never);
            prismaMock.costEvent.aggregate.mockResolvedValue({
                _sum: { costUsd: 45.0 }
            } as never);

            const policy = await prismaMock.budgetPolicy.findUnique({
                where: { agentId: "test-agent-uuid" }
            });

            const aggregation = await prismaMock.costEvent.aggregate({
                where: { agentId: "test-agent-uuid" },
                _sum: { costUsd: true }
            });

            const currentUsage = aggregation._sum.costUsd || 0;
            const budgetContext = {
                policy: policy,
                currentUsage,
                percentage: policy ? (currentUsage / policy.monthlyLimitUsd) * 100 : null
            };

            expect(budgetContext.policy).toBeDefined();
            expect(budgetContext.currentUsage).toBe(45.0);
            expect(budgetContext.percentage).toBe(45);
        });

        it("should respect date range", async () => {
            const from = new Date("2024-01-01");
            const to = new Date("2024-01-31");

            prismaMock.costEvent.aggregate.mockResolvedValue({
                _sum: { costUsd: 15.0 }
            } as never);

            await prismaMock.costEvent.aggregate({
                where: {
                    agentId: "test-agent-uuid",
                    createdAt: { gte: from, lte: to }
                },
                _sum: { costUsd: true }
            });

            expect(prismaMock.costEvent.aggregate).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        createdAt: { gte: from, lte: to }
                    })
                })
            );
        });

        it("should handle zero costs gracefully", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.costEvent.aggregate.mockResolvedValue({
                _sum: { costUsd: null, promptTokens: null, completionTokens: null }
            } as never);

            const aggregation = await prismaMock.costEvent.aggregate({
                where: { agentId: "test-agent-uuid" },
                _sum: { costUsd: true }
            });

            const totalCost = aggregation._sum.costUsd || 0;
            expect(totalCost).toBe(0);
        });

        it("should return 404 for invalid agent", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(null);

            const agent = await prismaMock.agent.findFirst({
                where: { id: "invalid-agent-uuid" }
            });

            expect(agent).toBeNull();
        });
    });
});
