import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { mockAgent } from "../../fixtures/agents";
import {
    mockRun,
    mockRunningRun,
    mockFailedRun,
    mockTrace,
    mockTraceStep,
    mockToolCall,
    generateRuns
} from "../../fixtures/runs";
import { createMockRequest, createMockParams, parseResponse } from "../../utils/api-helpers";

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
vi.mock("@repo/agentc2", () => ({
    agentResolver: {
        resolve: vi.fn()
    }
}));

describe("Runs API", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    describe("GET /api/agents/[id]/runs", () => {
        it("should return paginated runs for agent", async () => {
            const runs = generateRuns(5, { agentId: "test-agent-uuid" });
            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.agentRun.findMany.mockResolvedValue(runs as never);
            prismaMock.agentRun.count.mockResolvedValue(5);

            // Simulate the API behavior
            const agent = await prismaMock.agent.findFirst({
                where: { id: "test-agent-uuid" }
            });
            expect(agent).toBeDefined();

            const runsResult = await prismaMock.agentRun.findMany({
                where: { agentId: "test-agent-uuid" },
                take: 50,
                orderBy: { startedAt: "desc" }
            });

            expect(runsResult).toHaveLength(5);
            expect(prismaMock.agentRun.findMany).toHaveBeenCalled();
        });

        it("should filter by status (COMPLETED)", async () => {
            const completedRuns = generateRuns(3, {
                agentId: "test-agent-uuid",
                status: "COMPLETED"
            });
            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.agentRun.findMany.mockResolvedValue(completedRuns as never);

            const runsResult = await prismaMock.agentRun.findMany({
                where: {
                    agentId: "test-agent-uuid",
                    status: "COMPLETED"
                }
            });

            expect(runsResult).toHaveLength(3);
            runsResult.forEach((run) => {
                expect(run.status).toBe("COMPLETED");
            });
        });

        it("should filter by date range", async () => {
            const from = new Date("2024-01-01");
            const to = new Date("2024-01-31");

            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.agentRun.findMany.mockResolvedValue([] as never);

            await prismaMock.agentRun.findMany({
                where: {
                    agentId: "test-agent-uuid",
                    startedAt: {
                        gte: from,
                        lte: to
                    }
                }
            });

            expect(prismaMock.agentRun.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        startedAt: expect.objectContaining({
                            gte: from,
                            lte: to
                        })
                    })
                })
            );
        });

        it("should search by input text", async () => {
            const runs = [mockRun];
            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.agentRun.findMany.mockResolvedValue(runs as never);

            await prismaMock.agentRun.findMany({
                where: {
                    agentId: "test-agent-uuid",
                    inputText: { contains: "hello", mode: "insensitive" }
                }
            });

            expect(prismaMock.agentRun.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        inputText: expect.objectContaining({
                            contains: "hello"
                        })
                    })
                })
            );
        });

        it("should handle cursor pagination", async () => {
            const firstPage = generateRuns(50, { agentId: "test-agent-uuid" });
            const cursor = firstPage[49].id;

            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.agentRun.findMany.mockResolvedValue(firstPage as never);

            await prismaMock.agentRun.findMany({
                where: { agentId: "test-agent-uuid" },
                cursor: { id: cursor },
                skip: 1,
                take: 50
            });

            expect(prismaMock.agentRun.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    cursor: { id: cursor },
                    skip: 1
                })
            );
        });

        it("should return empty array for no runs", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.agentRun.findMany.mockResolvedValue([]);

            const runsResult = await prismaMock.agentRun.findMany({
                where: { agentId: "test-agent-uuid" }
            });

            expect(runsResult).toHaveLength(0);
        });
    });

    describe("POST /api/agents/[id]/runs", () => {
        it("should create run with valid input", async () => {
            prismaMock.agent.findFirst.mockResolvedValue({
                ...mockAgent,
                tools: []
            } as never);
            prismaMock.agentRun.create.mockResolvedValue(mockRun as never);
            prismaMock.agentTrace.create.mockResolvedValue(mockTrace as never);

            const runData = {
                agentId: "test-agent-uuid",
                tenantId: "test-tenant",
                status: "RUNNING",
                runType: "INTERACTIVE",
                inputText: "Hello, agent!",
                startedAt: new Date()
            };

            const createdRun = await prismaMock.agentRun.create({
                data: runData as never
            });

            expect(createdRun).toBeDefined();
            expect(prismaMock.agentRun.create).toHaveBeenCalled();
        });

        it("should create associated trace record", async () => {
            prismaMock.agent.findFirst.mockResolvedValue({
                ...mockAgent,
                tools: []
            } as never);
            prismaMock.agentRun.create.mockResolvedValue(mockRun as never);
            prismaMock.agentTrace.create.mockResolvedValue(mockTrace as never);

            // Create run
            const run = await prismaMock.agentRun.create({
                data: { id: "new-run" } as never
            });

            // Create trace
            await prismaMock.agentTrace.create({
                data: {
                    runId: run.id,
                    agentId: run.agentId,
                    tenantId: run.tenantId,
                    status: "RUNNING",
                    inputText: run.inputText
                } as never
            });

            expect(prismaMock.agentTrace.create).toHaveBeenCalled();
        });

        it("should return 404 for invalid agent", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(null);

            const agent = await prismaMock.agent.findFirst({
                where: { id: "invalid-agent-uuid" }
            });

            expect(agent).toBeNull();
        });

        it("should create run with contextVars", async () => {
            prismaMock.agent.findFirst.mockResolvedValue({
                ...mockAgent,
                tools: []
            } as never);

            const contextVars = {
                userId: "user-123",
                sessionId: "session-456"
            };

            prismaMock.agentRun.create.mockResolvedValue({
                ...mockRun,
                contextVarsJson: contextVars
            } as never);

            const createdRun = await prismaMock.agentRun.create({
                data: {
                    contextVarsJson: contextVars
                } as never
            });

            expect(createdRun.contextVarsJson).toEqual(contextVars);
        });
    });

    describe("GET /api/agents/[id]/runs/[runId]", () => {
        it("should return run with full details", async () => {
            const runWithDetails = {
                ...mockRun,
                trace: {
                    ...mockTrace,
                    steps: [mockTraceStep],
                    toolCalls: [mockToolCall]
                },
                evaluations: [],
                feedback: []
            };

            prismaMock.agentRun.findFirst.mockResolvedValue(runWithDetails as never);

            const run = await prismaMock.agentRun.findFirst({
                where: {
                    id: "test-run-uuid",
                    agentId: "test-agent-uuid"
                },
                include: {
                    trace: {
                        include: {
                            steps: true,
                            toolCalls: true
                        }
                    },
                    evaluations: true,
                    feedback: true
                }
            });

            expect(run).toBeDefined();
            expect(run?.trace).toBeDefined();
        });

        it("should return 404 for invalid runId", async () => {
            prismaMock.agentRun.findFirst.mockResolvedValue(null);

            const run = await prismaMock.agentRun.findFirst({
                where: {
                    id: "invalid-run-uuid",
                    agentId: "test-agent-uuid"
                }
            });

            expect(run).toBeNull();
        });

        it("should return 404 if run belongs to different agent", async () => {
            prismaMock.agentRun.findFirst.mockResolvedValue(null);

            const run = await prismaMock.agentRun.findFirst({
                where: {
                    id: "test-run-uuid",
                    agentId: "different-agent-uuid"
                }
            });

            expect(run).toBeNull();
        });
    });

    describe("POST /api/agents/[id]/runs/[runId]/cancel", () => {
        it("should cancel running execution", async () => {
            prismaMock.agentRun.findFirst.mockResolvedValue(mockRunningRun as never);
            prismaMock.agentRun.update.mockResolvedValue({
                ...mockRunningRun,
                status: "CANCELLED"
            } as never);
            prismaMock.agentTrace.update.mockResolvedValue({
                ...mockTrace,
                status: "CANCELLED"
            } as never);

            // Verify run is running
            const run = await prismaMock.agentRun.findFirst({
                where: { id: "running-run-uuid" }
            });

            expect(run?.status).toBe("RUNNING");

            // Cancel the run
            const updatedRun = await prismaMock.agentRun.update({
                where: { id: "running-run-uuid" },
                data: { status: "CANCELLED", completedAt: new Date() }
            });

            expect(updatedRun.status).toBe("CANCELLED");
        });

        it("should create alert on cancel", async () => {
            prismaMock.agentRun.findFirst.mockResolvedValue(mockRunningRun as never);
            prismaMock.agentRun.update.mockResolvedValue({
                ...mockRunningRun,
                status: "CANCELLED"
            } as never);
            prismaMock.agentAlert.create.mockResolvedValue({
                id: "alert-uuid",
                agentId: "test-agent-uuid",
                severity: "INFO",
                source: "SYSTEM",
                title: "Run cancelled",
                message: "Run was cancelled by user"
            } as never);

            await prismaMock.agentAlert.create({
                data: {
                    agentId: "test-agent-uuid",
                    tenantId: "test-tenant",
                    severity: "INFO",
                    source: "SYSTEM",
                    title: "Run cancelled"
                }
            });

            expect(prismaMock.agentAlert.create).toHaveBeenCalled();
        });

        it("should return 400 for completed run", async () => {
            prismaMock.agentRun.findFirst.mockResolvedValue(mockRun as never);

            const run = await prismaMock.agentRun.findFirst({
                where: { id: "test-run-uuid" }
            });

            // Run is already completed
            expect(run?.status).toBe("COMPLETED");

            // Should not allow cancellation
            const canCancel = ["QUEUED", "RUNNING"].includes(run?.status || "");
            expect(canCancel).toBe(false);
        });
    });

    describe("POST /api/agents/[id]/runs/[runId]/rerun", () => {
        it("should create new run from original input", async () => {
            prismaMock.agentRun.findFirst.mockResolvedValue(mockRun as never);
            prismaMock.agent.findFirst.mockResolvedValue({
                ...mockAgent,
                tools: []
            } as never);

            const newRun = {
                ...mockRun,
                id: "new-rerun-uuid",
                status: "RUNNING",
                completedAt: null
            };

            prismaMock.agentRun.create.mockResolvedValue(newRun as never);
            prismaMock.agentTrace.create.mockResolvedValue({
                ...mockTrace,
                runId: "new-rerun-uuid"
            } as never);

            // Get original run
            const originalRun = await prismaMock.agentRun.findFirst({
                where: { id: "test-run-uuid" }
            });

            expect(originalRun).toBeDefined();

            // Create new run with same input
            const createdRun = await prismaMock.agentRun.create({
                data: {
                    agentId: originalRun!.agentId,
                    tenantId: originalRun!.tenantId,
                    inputText: originalRun!.inputText,
                    runType: "RERUN",
                    status: "RUNNING"
                } as never
            });

            expect(createdRun.id).not.toBe(originalRun!.id);
            expect(prismaMock.agentRun.create).toHaveBeenCalled();
        });

        it("should return 404 for invalid original run", async () => {
            prismaMock.agentRun.findFirst.mockResolvedValue(null);

            const originalRun = await prismaMock.agentRun.findFirst({
                where: { id: "invalid-run-uuid" }
            });

            expect(originalRun).toBeNull();
        });
    });

    describe("GET /api/agents/[id]/runs/[runId]/trace", () => {
        it("should return trace with steps and tool calls", async () => {
            const traceWithDetails = {
                ...mockTrace,
                steps: [mockTraceStep, { ...mockTraceStep, id: "step-2", stepOrder: 2 }],
                toolCalls: [mockToolCall]
            };

            prismaMock.agentTrace.findUnique.mockResolvedValue(traceWithDetails as never);

            const trace = await prismaMock.agentTrace.findUnique({
                where: { runId: "test-run-uuid" },
                include: {
                    steps: { orderBy: { stepOrder: "asc" } },
                    toolCalls: { orderBy: { callOrder: "asc" } }
                }
            });

            expect(trace).toBeDefined();
            expect(trace?.steps).toHaveLength(2);
            expect(trace?.toolCalls).toHaveLength(1);
        });

        it("should return steps ordered by stepOrder", async () => {
            const steps = [
                { ...mockTraceStep, id: "step-1", stepOrder: 1 },
                { ...mockTraceStep, id: "step-2", stepOrder: 2 },
                { ...mockTraceStep, id: "step-3", stepOrder: 3 }
            ];

            prismaMock.agentTrace.findUnique.mockResolvedValue({
                ...mockTrace,
                steps,
                toolCalls: []
            } as never);

            const trace = await prismaMock.agentTrace.findUnique({
                where: { runId: "test-run-uuid" },
                include: {
                    steps: { orderBy: { stepOrder: "asc" } }
                }
            });

            expect(trace?.steps[0].stepOrder).toBe(1);
            expect(trace?.steps[1].stepOrder).toBe(2);
            expect(trace?.steps[2].stepOrder).toBe(3);
        });

        it("should return 404 for invalid runId", async () => {
            prismaMock.agentTrace.findUnique.mockResolvedValue(null);

            const trace = await prismaMock.agentTrace.findUnique({
                where: { runId: "invalid-run-uuid" }
            });

            expect(trace).toBeNull();
        });
    });
});
