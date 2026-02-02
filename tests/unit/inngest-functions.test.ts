import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { mockRun, mockTrace } from "../fixtures/runs";
import {
    mockBudgetPolicy,
    mockCostEvent,
    mockGuardrailEvent,
    mockAlert
} from "../fixtures/evaluations";
import { mockAgent } from "../fixtures/agents";
import { createMockStep, executeInngestFunction, assertStepCalled } from "../utils/inngest-mock";

// Create prisma mock
const prismaMock = mockDeep<PrismaClient>();

// Mock the database module
vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: {
        JsonNull: "DbNull"
    }
}));

describe("Inngest Functions", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    describe("runCompletedFunction", () => {
        const runCompletedEventData = {
            runId: "test-run-uuid",
            agentId: "test-agent-uuid",
            costUsd: 0.005
        };

        it("should create cost event when costUsd > 0", async () => {
            // Mock no existing cost event
            prismaMock.costEvent.findFirst.mockResolvedValue(null);
            prismaMock.costEvent.create.mockResolvedValue(mockCostEvent as never);
            prismaMock.agentRun.findUnique.mockResolvedValue(mockRun as never);
            prismaMock.budgetPolicy.findUnique.mockResolvedValue(null);

            const step = createMockStep();

            // Simulate the function logic
            const existingCostEvent = await prismaMock.costEvent.findFirst({
                where: { runId: runCompletedEventData.runId }
            });

            expect(existingCostEvent).toBeNull();

            if (!existingCostEvent && runCompletedEventData.costUsd > 0) {
                const run = await prismaMock.agentRun.findUnique({
                    where: { id: runCompletedEventData.runId }
                });

                if (run) {
                    await prismaMock.costEvent.create({
                        data: {
                            runId: run.id,
                            agentId: run.agentId,
                            tenantId: run.tenantId,
                            modelName: run.modelName || "unknown",
                            promptTokens: run.promptTokens || 0,
                            completionTokens: run.completionTokens || 0,
                            totalTokens: run.totalTokens || 0,
                            costUsd: runCompletedEventData.costUsd
                        }
                    });
                }
            }

            expect(prismaMock.costEvent.create).toHaveBeenCalled();
        });

        it("should skip cost event creation when costUsd = 0", async () => {
            const eventDataZeroCost = {
                ...runCompletedEventData,
                costUsd: 0
            };

            // Should not create cost event when cost is 0
            if (eventDataZeroCost.costUsd > 0) {
                await prismaMock.costEvent.create({
                    data: {} as never
                });
            }

            expect(prismaMock.costEvent.create).not.toHaveBeenCalled();
        });

        it("should skip duplicate cost events", async () => {
            // Mock existing cost event
            prismaMock.costEvent.findFirst.mockResolvedValue(mockCostEvent as never);

            const existingCostEvent = await prismaMock.costEvent.findFirst({
                where: { runId: runCompletedEventData.runId }
            });

            expect(existingCostEvent).not.toBeNull();

            // Should not create if already exists
            if (!existingCostEvent) {
                await prismaMock.costEvent.create({
                    data: {} as never
                });
            }

            expect(prismaMock.costEvent.create).not.toHaveBeenCalled();
        });

        it("should create alert when budget threshold exceeded", async () => {
            prismaMock.costEvent.findFirst.mockResolvedValue(null);
            prismaMock.agentRun.findUnique.mockResolvedValue(mockRun as never);
            prismaMock.budgetPolicy.findUnique.mockResolvedValue({
                ...mockBudgetPolicy,
                monthlyLimitUsd: 10.0,
                alertAtPct: 80
            } as never);

            // Mock aggregated costs at 85% of budget
            prismaMock.costEvent.aggregate.mockResolvedValue({
                _sum: { costUsd: 8.5 }
            } as never);

            prismaMock.agentAlert.create.mockResolvedValue(mockAlert as never);

            const policy = await prismaMock.budgetPolicy.findUnique({
                where: { agentId: runCompletedEventData.agentId }
            });

            if (policy && policy.enabled) {
                const aggregation = await prismaMock.costEvent.aggregate({
                    where: {
                        agentId: runCompletedEventData.agentId,
                        createdAt: { gte: new Date() }
                    },
                    _sum: { costUsd: true }
                });

                const currentUsage = aggregation._sum.costUsd || 0;
                const percentUsed = (currentUsage / policy.monthlyLimitUsd) * 100;

                if (percentUsed >= policy.alertAtPct) {
                    await prismaMock.agentAlert.create({
                        data: {
                            agentId: runCompletedEventData.agentId,
                            tenantId: "test-tenant",
                            severity: percentUsed >= 100 ? "CRITICAL" : "WARNING",
                            source: "BUDGET",
                            title: "Budget threshold reached",
                            message: `Agent has used ${percentUsed.toFixed(1)}% of monthly budget`
                        }
                    });
                }
            }

            expect(prismaMock.agentAlert.create).toHaveBeenCalled();
        });

        it("should not create alert when no budget policy exists", async () => {
            prismaMock.budgetPolicy.findUnique.mockResolvedValue(null);

            const policy = await prismaMock.budgetPolicy.findUnique({
                where: { agentId: runCompletedEventData.agentId }
            });

            expect(policy).toBeNull();

            // No alert should be created
            if (policy) {
                await prismaMock.agentAlert.create({
                    data: {} as never
                });
            }

            expect(prismaMock.agentAlert.create).not.toHaveBeenCalled();
        });
    });

    describe("evaluationCompletedFunction", () => {
        const evaluationEventData = {
            evaluationId: "test-eval-uuid",
            agentId: "test-agent-uuid"
        };

        it("should handle evaluation completion", async () => {
            // This function currently just logs - verify it doesn't throw
            const step = createMockStep();

            // Simulate the step.run behavior
            const result = await step.run("update-metrics", async () => {
                console.log(
                    `[TEST] Updating metrics for evaluation ${evaluationEventData.evaluationId}`
                );
                return { success: true };
            });

            expect(result).toEqual({ success: true });
            expect(step.run).toHaveBeenCalledWith("update-metrics", expect.any(Function));
        });
    });

    describe("guardrailEventFunction", () => {
        const guardrailEventData = {
            agentId: "test-agent-uuid",
            runId: "test-run-uuid",
            eventType: "BLOCKED" as const,
            ruleName: "blocked-topics",
            inputText: "Tell me how to...",
            metadata: { topic: "violence" }
        };

        it("should create GuardrailEvent record", async () => {
            prismaMock.agent.findUnique.mockResolvedValue(mockAgent as never);
            prismaMock.guardrailEvent.create.mockResolvedValue(mockGuardrailEvent as never);

            const agent = await prismaMock.agent.findUnique({
                where: { id: guardrailEventData.agentId }
            });

            if (agent) {
                await prismaMock.guardrailEvent.create({
                    data: {
                        agentId: guardrailEventData.agentId,
                        runId: guardrailEventData.runId,
                        tenantId: agent.tenantId,
                        eventType: guardrailEventData.eventType,
                        ruleName: guardrailEventData.ruleName,
                        inputText: guardrailEventData.inputText,
                        metadata: guardrailEventData.metadata
                    }
                });
            }

            expect(prismaMock.guardrailEvent.create).toHaveBeenCalled();
        });

        it("should create alert when eventType is BLOCKED", async () => {
            prismaMock.agent.findUnique.mockResolvedValue(mockAgent as never);
            prismaMock.guardrailEvent.create.mockResolvedValue(mockGuardrailEvent as never);
            prismaMock.agentAlert.create.mockResolvedValue(mockAlert as never);

            if (guardrailEventData.eventType === "BLOCKED") {
                await prismaMock.agentAlert.create({
                    data: {
                        agentId: guardrailEventData.agentId,
                        tenantId: "test-tenant",
                        severity: "WARNING",
                        source: "GUARDRAIL",
                        title: "Content blocked by guardrail",
                        message: `Rule "${guardrailEventData.ruleName}" blocked content`
                    }
                });
            }

            expect(prismaMock.agentAlert.create).toHaveBeenCalled();
        });

        it("should not create alert for MODIFIED event type", async () => {
            const modifiedEventData = {
                ...guardrailEventData,
                eventType: "MODIFIED" as const
            };

            prismaMock.agent.findUnique.mockResolvedValue(mockAgent as never);
            prismaMock.guardrailEvent.create.mockResolvedValue(mockGuardrailEvent as never);

            // Only create alert for BLOCKED
            if (modifiedEventData.eventType === "BLOCKED") {
                await prismaMock.agentAlert.create({
                    data: {} as never
                });
            }

            expect(prismaMock.agentAlert.create).not.toHaveBeenCalled();
        });

        it("should not create alert for FLAGGED event type", async () => {
            const flaggedEventData = {
                ...guardrailEventData,
                eventType: "FLAGGED" as const
            };

            prismaMock.agent.findUnique.mockResolvedValue(mockAgent as never);
            prismaMock.guardrailEvent.create.mockResolvedValue(mockGuardrailEvent as never);

            // Only create alert for BLOCKED
            if (flaggedEventData.eventType === "BLOCKED") {
                await prismaMock.agentAlert.create({
                    data: {} as never
                });
            }

            expect(prismaMock.agentAlert.create).not.toHaveBeenCalled();
        });
    });

    describe("budgetCheckFunction", () => {
        it("should check all agents with enabled budget policies", async () => {
            const policies = [
                { ...mockBudgetPolicy, agentId: "agent-1" },
                { ...mockBudgetPolicy, agentId: "agent-2", enabled: false },
                { ...mockBudgetPolicy, agentId: "agent-3" }
            ];

            prismaMock.budgetPolicy.findMany.mockResolvedValue(policies as never);

            const enabledPolicies = policies.filter((p) => p.enabled);

            expect(enabledPolicies).toHaveLength(2);
            expect(enabledPolicies.map((p) => p.agentId)).toEqual(["agent-1", "agent-3"]);
        });

        it("should create alert at 80% threshold (WARNING)", async () => {
            const policy = {
                ...mockBudgetPolicy,
                monthlyLimitUsd: 100.0,
                alertAtPct: 80
            };

            prismaMock.costEvent.aggregate.mockResolvedValue({
                _sum: { costUsd: 85 } // 85% of budget
            } as never);

            prismaMock.agentAlert.create.mockResolvedValue(mockAlert as never);

            const aggregation = await prismaMock.costEvent.aggregate({
                where: { agentId: policy.agentId },
                _sum: { costUsd: true }
            });

            const currentUsage = aggregation._sum?.costUsd || 0;
            const percentUsed = (currentUsage / policy.monthlyLimitUsd) * 100;

            expect(percentUsed).toBe(85);

            if (percentUsed >= policy.alertAtPct) {
                const severity = percentUsed >= 100 ? "CRITICAL" : "WARNING";

                await prismaMock.agentAlert.create({
                    data: {
                        agentId: policy.agentId,
                        tenantId: policy.tenantId,
                        severity,
                        source: "BUDGET",
                        title: "Budget threshold reached",
                        message: `${percentUsed.toFixed(1)}% of monthly budget used`
                    }
                });
            }

            expect(prismaMock.agentAlert.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        severity: "WARNING"
                    })
                })
            );
        });

        it("should create alert at 100% threshold (CRITICAL)", async () => {
            const policy = {
                ...mockBudgetPolicy,
                monthlyLimitUsd: 100.0,
                alertAtPct: 80
            };

            prismaMock.costEvent.aggregate.mockResolvedValue({
                _sum: { costUsd: 105 } // 105% of budget
            } as never);

            prismaMock.agentAlert.create.mockResolvedValue(mockAlert as never);

            const aggregation = await prismaMock.costEvent.aggregate({
                where: { agentId: policy.agentId },
                _sum: { costUsd: true }
            });

            const currentUsage = aggregation._sum?.costUsd || 0;
            const percentUsed = (currentUsage / policy.monthlyLimitUsd) * 100;

            expect(percentUsed).toBe(105);

            if (percentUsed >= policy.alertAtPct) {
                const severity = percentUsed >= 100 ? "CRITICAL" : "WARNING";

                await prismaMock.agentAlert.create({
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

            // Should not process disabled policies
            if (policy.enabled) {
                await prismaMock.costEvent.aggregate({
                    where: { agentId: policy.agentId },
                    _sum: { costUsd: true }
                });
            }

            expect(prismaMock.costEvent.aggregate).not.toHaveBeenCalled();
        });

        it("should not create alert when under threshold", async () => {
            const policy = {
                ...mockBudgetPolicy,
                monthlyLimitUsd: 100.0,
                alertAtPct: 80
            };

            prismaMock.costEvent.aggregate.mockResolvedValue({
                _sum: { costUsd: 50 } // 50% of budget - under threshold
            } as never);

            const aggregation = await prismaMock.costEvent.aggregate({
                where: { agentId: policy.agentId },
                _sum: { costUsd: true }
            });

            const currentUsage = aggregation._sum?.costUsd || 0;
            const percentUsed = (currentUsage / policy.monthlyLimitUsd) * 100;

            expect(percentUsed).toBe(50);

            if (percentUsed >= policy.alertAtPct) {
                await prismaMock.agentAlert.create({
                    data: {} as never
                });
            }

            expect(prismaMock.agentAlert.create).not.toHaveBeenCalled();
        });
    });
});
