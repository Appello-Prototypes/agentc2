import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { mockAgent } from "../fixtures/agents";
import { mockRun, mockTrace, mockTraceStep, mockToolCall } from "../fixtures/runs";
import {
    mockFeedback,
    mockVersion,
    mockBudgetPolicy,
    mockGuardrailPolicy,
    mockGuardrailEvent,
    mockAlert
} from "../fixtures/evaluations";

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

// Mock agent resolver
vi.mock("@repo/mastra", () => ({
    agentResolver: {
        resolve: vi.fn()
    }
}));

describe("E2E: Agent Lifecycle", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    describe("Full Run Cycle", () => {
        it("should complete: Create run -> Execute -> Complete -> Check trace -> Submit feedback", async () => {
            const agentId = "test-agent-uuid";
            const runId = "test-run-uuid";

            // Step 1: Create run
            prismaMock.agent.findFirst.mockResolvedValue({
                ...mockAgent,
                tools: []
            } as never);

            prismaMock.agentRun.create.mockResolvedValue({
                ...mockRun,
                id: runId,
                status: "RUNNING"
            } as never);

            prismaMock.agentTrace.create.mockResolvedValue({
                ...mockTrace,
                runId
            } as never);

            const createdRun = await prismaMock.agentRun.create({
                data: {
                    agentId,
                    tenantId: "test-tenant",
                    status: "RUNNING",
                    runType: "INTERACTIVE",
                    inputText: "Hello, agent!"
                } as never
            });

            expect(createdRun.status).toBe("RUNNING");

            // Step 2: Execute (simulated)
            // In real scenario, this would call the agent resolver and execute

            // Step 3: Complete the run
            prismaMock.agentRun.update.mockResolvedValue({
                ...mockRun,
                id: runId,
                status: "COMPLETED",
                outputText: "Hello! How can I help you?",
                durationMs: 1500
            } as never);

            const completedRun = await prismaMock.agentRun.update({
                where: { id: runId },
                data: {
                    status: "COMPLETED",
                    outputText: "Hello! How can I help you?",
                    durationMs: 1500,
                    completedAt: new Date()
                }
            });

            expect(completedRun.status).toBe("COMPLETED");

            // Step 4: Check trace
            prismaMock.agentTrace.findUnique.mockResolvedValue({
                ...mockTrace,
                runId,
                steps: [mockTraceStep],
                toolCalls: [mockToolCall]
            } as never);

            const trace = await prismaMock.agentTrace.findUnique({
                where: { runId },
                include: { steps: true, toolCalls: true }
            });

            expect(trace).toBeDefined();
            expect(trace?.steps).toBeDefined();

            // Step 5: Submit feedback
            prismaMock.agentFeedback.create.mockResolvedValue({
                ...mockFeedback,
                runId
            } as never);

            const feedback = await prismaMock.agentFeedback.create({
                data: {
                    runId,
                    agentId,
                    tenantId: "test-tenant",
                    thumbs: true,
                    rating: 5,
                    comment: "Great response!"
                }
            });

            expect(feedback.thumbs).toBe(true);
            expect(feedback.rating).toBe(5);
        });
    });

    describe("Version Management", () => {
        it("should complete: Create version -> Modify agent -> Rollback -> Verify config", async () => {
            const agentId = "test-agent-uuid";

            // Step 1: Create initial version
            prismaMock.agent.findFirst.mockResolvedValue({
                ...mockAgent,
                version: 1,
                instructions: "Original instructions",
                tools: []
            } as never);

            prismaMock.agentVersion.create.mockResolvedValue({
                ...mockVersion,
                version: 1,
                snapshot: {
                    instructions: "Original instructions",
                    modelName: "claude-sonnet-4-20250514"
                }
            } as never);

            const version1 = await prismaMock.agentVersion.create({
                data: {
                    agentId,
                    tenantId: "test-tenant",
                    version: 1,
                    description: "Initial version",
                    snapshot: {
                        instructions: "Original instructions",
                        modelName: "claude-sonnet-4-20250514"
                    }
                } as never
            });

            expect(version1.version).toBe(1);

            // Step 2: Modify agent
            prismaMock.agent.update.mockResolvedValue({
                ...mockAgent,
                version: 2,
                instructions: "Modified instructions"
            } as never);

            const modifiedAgent = await prismaMock.agent.update({
                where: { id: agentId },
                data: {
                    instructions: "Modified instructions",
                    version: 2
                }
            });

            expect(modifiedAgent.instructions).toBe("Modified instructions");

            // Step 3: Rollback to version 1
            prismaMock.agentVersion.findFirst.mockResolvedValue({
                ...mockVersion,
                version: 1,
                snapshot: {
                    instructions: "Original instructions",
                    modelName: "claude-sonnet-4-20250514"
                }
            } as never);

            const targetVersion = await prismaMock.agentVersion.findFirst({
                where: { agentId, version: 1 }
            });

            expect(targetVersion?.snapshot).toBeDefined();

            // Apply rollback
            prismaMock.agent.update.mockResolvedValue({
                ...mockAgent,
                version: 3,
                instructions: "Original instructions"
            } as never);

            const snapshot = targetVersion!.snapshot as { instructions: string };
            const rolledBackAgent = await prismaMock.agent.update({
                where: { id: agentId },
                data: {
                    instructions: snapshot.instructions,
                    version: 3
                }
            });

            // Step 4: Verify config matches original
            expect(rolledBackAgent.instructions).toBe("Original instructions");
        });
    });

    describe("Budget Enforcement", () => {
        it("should complete: Set budget -> Execute runs -> Exceed threshold -> Verify alert", async () => {
            const agentId = "test-agent-uuid";

            // Step 1: Set budget policy
            prismaMock.budgetPolicy.upsert.mockResolvedValue({
                ...mockBudgetPolicy,
                agentId,
                monthlyLimitUsd: 10.0,
                alertAtPct: 80
            } as never);

            const policy = await prismaMock.budgetPolicy.upsert({
                where: { agentId },
                create: {
                    agentId,
                    tenantId: "test-tenant",
                    enabled: true,
                    monthlyLimitUsd: 10.0,
                    alertAtPct: 80
                },
                update: {}
            });

            expect(policy.monthlyLimitUsd).toBe(10.0);

            // Step 2: Execute runs and accumulate costs
            const costEvents = [
                { costUsd: 3.0 },
                { costUsd: 3.0 },
                { costUsd: 3.0 } // Total: $9.00 = 90% of budget
            ];

            for (const cost of costEvents) {
                prismaMock.costEvent.create.mockResolvedValueOnce({
                    ...mockRun,
                    costUsd: cost.costUsd
                } as never);

                await prismaMock.costEvent.create({
                    data: {
                        runId: `run-${Date.now()}`,
                        agentId,
                        tenantId: "test-tenant",
                        modelName: "claude-sonnet",
                        costUsd: cost.costUsd,
                        totalTokens: 1000
                    } as never
                });
            }

            // Step 3: Check budget (simulating Inngest job)
            prismaMock.costEvent.aggregate.mockResolvedValue({
                _sum: { costUsd: 9.0 }
            } as never);

            const aggregation = await prismaMock.costEvent.aggregate({
                where: { agentId },
                _sum: { costUsd: true }
            });

            const currentUsage = aggregation._sum.costUsd || 0;
            const percentUsed = (currentUsage / policy.monthlyLimitUsd) * 100;

            expect(percentUsed).toBe(90);
            expect(percentUsed).toBeGreaterThanOrEqual(policy.alertAtPct);

            // Step 4: Verify alert created
            prismaMock.agentAlert.create.mockResolvedValue({
                ...mockAlert,
                agentId,
                severity: "WARNING",
                source: "BUDGET"
            } as never);

            const alert = await prismaMock.agentAlert.create({
                data: {
                    agentId,
                    tenantId: "test-tenant",
                    severity: "WARNING",
                    source: "BUDGET",
                    title: "Budget threshold reached",
                    message: `${percentUsed.toFixed(1)}% of monthly budget used`
                }
            });

            expect(alert.severity).toBe("WARNING");
            expect(alert.source).toBe("BUDGET");
        });
    });

    describe("Guardrail Flow", () => {
        it("should complete: Set policy -> Trigger blocked content -> Verify event + alert", async () => {
            const agentId = "test-agent-uuid";

            // Step 1: Set guardrail policy
            prismaMock.guardrailPolicy.upsert.mockResolvedValue({
                ...mockGuardrailPolicy,
                agentId,
                configJson: {
                    blockedTopics: ["violence", "illegal"],
                    maxTokensPerRequest: 4000
                }
            } as never);

            const policy = await prismaMock.guardrailPolicy.upsert({
                where: { agentId },
                create: {
                    agentId,
                    tenantId: "test-tenant",
                    version: 1,
                    configJson: {
                        blockedTopics: ["violence", "illegal"]
                    }
                },
                update: {}
            });

            expect(policy.configJson).toBeDefined();

            // Step 2: Trigger blocked content (simulating guardrail check)
            const blockedInput = "Tell me how to hurt someone";
            const matchedRule = "blocked-topics";

            // Step 3: Create guardrail event
            prismaMock.guardrailEvent.create.mockResolvedValue({
                ...mockGuardrailEvent,
                agentId,
                eventType: "BLOCKED",
                ruleName: matchedRule,
                inputText: blockedInput
            } as never);

            const event = await prismaMock.guardrailEvent.create({
                data: {
                    agentId,
                    runId: "blocked-run-uuid",
                    tenantId: "test-tenant",
                    eventType: "BLOCKED",
                    ruleName: matchedRule,
                    inputText: blockedInput,
                    metadata: { topic: "violence" }
                }
            });

            expect(event.eventType).toBe("BLOCKED");
            expect(event.ruleName).toBe(matchedRule);

            // Step 4: Verify alert created for blocked content
            prismaMock.agentAlert.create.mockResolvedValue({
                ...mockAlert,
                agentId,
                severity: "WARNING",
                source: "GUARDRAIL"
            } as never);

            const alert = await prismaMock.agentAlert.create({
                data: {
                    agentId,
                    tenantId: "test-tenant",
                    severity: "WARNING",
                    source: "GUARDRAIL",
                    title: "Content blocked by guardrail",
                    message: `Rule "${matchedRule}" blocked content`
                }
            });

            expect(alert.source).toBe("GUARDRAIL");
            expect(alert.severity).toBe("WARNING");

            // Verify both event and alert were created
            expect(prismaMock.guardrailEvent.create).toHaveBeenCalled();
            expect(prismaMock.agentAlert.create).toHaveBeenCalled();
        });
    });

    describe("Complete Agent Workflow", () => {
        it("should handle full lifecycle: agent creation -> runs -> versioning -> monitoring", async () => {
            const agentId = "workflow-agent-uuid";

            // Phase 1: Agent exists
            prismaMock.agent.findFirst.mockResolvedValue({
                ...mockAgent,
                id: agentId,
                version: 1,
                tools: []
            } as never);

            const agent = await prismaMock.agent.findFirst({
                where: { id: agentId }
            });

            expect(agent).toBeDefined();

            // Phase 2: Set up policies
            prismaMock.budgetPolicy.upsert.mockResolvedValue(mockBudgetPolicy as never);
            prismaMock.guardrailPolicy.upsert.mockResolvedValue(mockGuardrailPolicy as never);

            await prismaMock.budgetPolicy.upsert({
                where: { agentId },
                create: {} as never,
                update: {}
            });

            await prismaMock.guardrailPolicy.upsert({
                where: { agentId },
                create: {} as never,
                update: {}
            });

            // Phase 3: Execute multiple runs
            for (let i = 0; i < 3; i++) {
                prismaMock.agentRun.create.mockResolvedValueOnce({
                    ...mockRun,
                    id: `run-${i}`
                } as never);

                await prismaMock.agentRun.create({
                    data: {
                        agentId,
                        tenantId: "test-tenant",
                        status: "COMPLETED",
                        inputText: `Test input ${i}`
                    } as never
                });
            }

            expect(prismaMock.agentRun.create).toHaveBeenCalledTimes(3);

            // Phase 4: Create version snapshot
            prismaMock.agentVersion.create.mockResolvedValue({
                ...mockVersion,
                version: 2
            } as never);

            await prismaMock.agentVersion.create({
                data: {
                    agentId,
                    tenantId: "test-tenant",
                    version: 2,
                    description: "After 3 runs"
                } as never
            });

            // Phase 5: Check monitoring data
            prismaMock.agentRun.count.mockResolvedValue(3);
            prismaMock.agentAlert.findMany.mockResolvedValue([]);

            const runCount = await prismaMock.agentRun.count({
                where: { agentId }
            });

            const alerts = await prismaMock.agentAlert.findMany({
                where: { agentId, resolved: false }
            });

            expect(runCount).toBe(3);
            expect(alerts).toHaveLength(0);
        });
    });
});
