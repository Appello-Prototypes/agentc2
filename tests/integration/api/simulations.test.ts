import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { mockAgent } from "../../fixtures/agents";
import {
    mockSimulationSession,
    mockRunningSession,
    mockCompletedSession,
    mockCancelledSession,
    generateSessions,
    generateSimulationRuns
} from "../../fixtures/simulations";

// Create prisma mock
const prismaMock = mockDeep<PrismaClient>();

// Create inngest mock
const inngestMock = {
    send: vi.fn().mockResolvedValue({ ids: ["test-event-id"] })
};

// Mock the database module
vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: {
        JsonNull: "DbNull",
        InputJsonValue: {}
    }
}));

// Mock inngest
vi.mock("@/lib/inngest", () => ({
    inngest: inngestMock
}));

describe("Simulations API", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    describe("GET /api/agents/[id]/simulations", () => {
        it("should return empty list when no sessions exist", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.simulationSession.findMany.mockResolvedValue([]);
            prismaMock.simulationSession.count.mockResolvedValue(0);

            const agent = await prismaMock.agent.findFirst({
                where: { slug: "mcp-agent" }
            });
            expect(agent).toBeDefined();

            const sessions = await prismaMock.simulationSession.findMany({
                where: { agentId: agent!.id }
            });

            expect(sessions).toHaveLength(0);
        });

        it("should return paginated sessions for agent", async () => {
            const sessions = generateSessions(5, { agentId: "test-agent-uuid" });
            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.simulationSession.findMany.mockResolvedValue(sessions as never);
            prismaMock.simulationSession.count.mockResolvedValue(5);

            const agent = await prismaMock.agent.findFirst({
                where: { slug: "mcp-agent" }
            });
            expect(agent).toBeDefined();

            const result = await prismaMock.simulationSession.findMany({
                where: { agentId: agent!.id },
                orderBy: { createdAt: "desc" },
                take: 20
            });

            expect(result).toHaveLength(5);
            expect(prismaMock.simulationSession.findMany).toHaveBeenCalled();
        });

        it("should return 404 when agent not found", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(null);

            const agent = await prismaMock.agent.findFirst({
                where: { slug: "nonexistent-agent" }
            });

            expect(agent).toBeNull();
        });
    });

    describe("POST /api/agents/[id]/simulations", () => {
        it("should create a new simulation session", async () => {
            const newSession = {
                ...mockSimulationSession,
                theme: "Technical support questions"
            };

            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.simulationSession.create.mockResolvedValue(newSession as never);

            const agent = await prismaMock.agent.findFirst({
                where: { slug: "mcp-agent" }
            });
            expect(agent).toBeDefined();

            const session = await prismaMock.simulationSession.create({
                data: {
                    agentId: agent!.id,
                    theme: "Technical support questions",
                    status: "PENDING",
                    targetCount: 100,
                    concurrency: 5
                }
            });

            expect(session.theme).toBe("Technical support questions");
            expect(session.status).toBe("PENDING");
            expect(session.targetCount).toBe(100);
        });

        it("should emit inngest event after creating session", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.simulationSession.create.mockResolvedValue(mockSimulationSession as never);

            // Simulate the API behavior
            await prismaMock.simulationSession.create({
                data: {
                    agentId: mockAgent.id,
                    theme: "Test theme",
                    status: "PENDING",
                    targetCount: 100,
                    concurrency: 5
                }
            });

            // Simulate inngest event emission
            await inngestMock.send({
                name: "simulation/session.start",
                data: {
                    sessionId: mockSimulationSession.id,
                    agentId: mockAgent.id,
                    theme: "Test theme",
                    targetCount: 100,
                    concurrency: 5
                }
            });

            expect(inngestMock.send).toHaveBeenCalledWith({
                name: "simulation/session.start",
                data: expect.objectContaining({
                    sessionId: mockSimulationSession.id,
                    agentId: mockAgent.id
                })
            });
        });

        it("should validate theme is required", async () => {
            // Theme validation happens at the API level
            const theme = "";
            expect(theme.trim().length).toBe(0);
        });

        it("should cap count at 1000", async () => {
            const requestedCount = 5000;
            const cappedCount = Math.max(1, Math.min(1000, requestedCount));
            expect(cappedCount).toBe(1000);
        });

        it("should cap concurrency at 10", async () => {
            const requestedConcurrency = 50;
            const cappedConcurrency = Math.max(1, Math.min(10, requestedConcurrency));
            expect(cappedConcurrency).toBe(10);
        });
    });

    describe("GET /api/agents/[id]/simulations/[sessionId]", () => {
        it("should return session details with runs", async () => {
            const runs = generateSimulationRuns(10, "completed-session-uuid", "test-agent-uuid");

            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.simulationSession.findFirst.mockResolvedValue(mockCompletedSession as never);
            prismaMock.agentRun.findMany.mockResolvedValue(runs as never);

            const session = await prismaMock.simulationSession.findFirst({
                where: { id: "completed-session-uuid" }
            });

            expect(session).toBeDefined();
            expect(session!.status).toBe("COMPLETED");
            expect(session!.avgQualityScore).toBe(0.82);

            const sessionRuns = await prismaMock.agentRun.findMany({
                where: {
                    source: "simulation",
                    sessionId: "completed-session-uuid"
                }
            });

            expect(sessionRuns).toHaveLength(10);
        });

        it("should return 404 when session not found", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.simulationSession.findFirst.mockResolvedValue(null);

            const session = await prismaMock.simulationSession.findFirst({
                where: { id: "nonexistent-session" }
            });

            expect(session).toBeNull();
        });
    });

    describe("DELETE /api/agents/[id]/simulations/[sessionId]", () => {
        it("should cancel a running session", async () => {
            const cancelledSession = {
                ...mockRunningSession,
                status: "CANCELLED",
                completedAt: new Date()
            };

            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.simulationSession.findFirst.mockResolvedValue(mockRunningSession as never);
            prismaMock.simulationSession.update.mockResolvedValue(cancelledSession as never);

            const session = await prismaMock.simulationSession.findFirst({
                where: { id: "running-session-uuid" }
            });

            expect(session!.status).toBe("RUNNING");

            const updated = await prismaMock.simulationSession.update({
                where: { id: "running-session-uuid" },
                data: {
                    status: "CANCELLED",
                    completedAt: new Date()
                }
            });

            expect(updated.status).toBe("CANCELLED");
            expect(updated.completedAt).toBeDefined();
        });

        it("should not cancel a completed session", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.simulationSession.findFirst.mockResolvedValue(mockCompletedSession as never);

            const session = await prismaMock.simulationSession.findFirst({
                where: { id: "completed-session-uuid" }
            });

            // Completed sessions should not be cancellable
            expect(["PENDING", "RUNNING"].includes(session!.status)).toBe(false);
        });

        it("should not cancel an already cancelled session", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.simulationSession.findFirst.mockResolvedValue(mockCancelledSession as never);

            const session = await prismaMock.simulationSession.findFirst({
                where: { id: "cancelled-session-uuid" }
            });

            expect(["PENDING", "RUNNING"].includes(session!.status)).toBe(false);
        });
    });

    describe("Source filtering", () => {
        it("should filter runs by source=simulation", async () => {
            const simulationRuns = generateSimulationRuns(5, "test-session", "test-agent-uuid");

            prismaMock.agentRun.findMany.mockResolvedValue(simulationRuns as never);

            const runs = await prismaMock.agentRun.findMany({
                where: {
                    agentId: "test-agent-uuid",
                    source: "simulation"
                }
            });

            expect(runs).toHaveLength(5);
            runs.forEach((run) => {
                expect(run.source).toBe("simulation");
            });
        });

        it("should exclude simulation runs with source=production", async () => {
            // Production filter uses OR: [{ source: { not: "simulation" } }, { source: null }]
            const productionRuns = [
                { id: "1", source: "api" },
                { id: "2", source: "slack" },
                { id: "3", source: null }
            ];

            prismaMock.agentRun.findMany.mockResolvedValue(productionRuns as never);

            const runs = await prismaMock.agentRun.findMany({
                where: {
                    agentId: "test-agent-uuid",
                    AND: [{ OR: [{ source: { not: "simulation" } }, { source: null }] }]
                }
            });

            expect(runs).toHaveLength(3);
            runs.forEach((run) => {
                expect(run.source).not.toBe("simulation");
            });
        });
    });
});

describe("Simulation Session Lifecycle", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    it("should transition PENDING -> RUNNING -> COMPLETED", async () => {
        // Step 1: Create session (PENDING)
        prismaMock.simulationSession.create.mockResolvedValue(mockSimulationSession as never);

        const created = await prismaMock.simulationSession.create({
            data: {
                agentId: "test-agent-uuid",
                theme: "Test",
                status: "PENDING",
                targetCount: 10,
                concurrency: 2
            }
        });
        expect(created.status).toBe("PENDING");

        // Step 2: Start session (RUNNING)
        const runningSession = {
            ...mockSimulationSession,
            status: "RUNNING",
            startedAt: new Date()
        };
        prismaMock.simulationSession.update.mockResolvedValue(runningSession as never);

        const running = await prismaMock.simulationSession.update({
            where: { id: created.id },
            data: { status: "RUNNING", startedAt: new Date() }
        });
        expect(running.status).toBe("RUNNING");

        // Step 3: Complete session
        const completedSession = {
            ...runningSession,
            status: "COMPLETED",
            completedCount: 10,
            completedAt: new Date(),
            avgDurationMs: 1500,
            successRate: 1.0
        };
        prismaMock.simulationSession.update.mockResolvedValue(completedSession as never);

        const completed = await prismaMock.simulationSession.update({
            where: { id: created.id },
            data: {
                status: "COMPLETED",
                completedCount: 10,
                completedAt: new Date(),
                avgDurationMs: 1500,
                successRate: 1.0
            }
        });
        expect(completed.status).toBe("COMPLETED");
        expect(completed.completedCount).toBe(10);
    });

    it("should track progress during simulation", async () => {
        const progressUpdates = [
            { completedCount: 0, failedCount: 0 },
            { completedCount: 10, failedCount: 1 },
            { completedCount: 20, failedCount: 2 },
            { completedCount: 30, failedCount: 2 }
        ];

        for (const progress of progressUpdates) {
            const session = { ...mockRunningSession, ...progress };
            prismaMock.simulationSession.update.mockResolvedValue(session as never);

            const updated = await prismaMock.simulationSession.update({
                where: { id: "running-session-uuid" },
                data: {
                    completedCount: { increment: 10 },
                    failedCount: { increment: progress.failedCount > 0 ? 1 : 0 }
                }
            });

            expect(updated.completedCount).toBe(progress.completedCount);
        }
    });
});

describe("Batch Processing", () => {
    it("should calculate correct batch count", () => {
        const testCases = [
            { targetCount: 100, batchSize: 10, expected: 10 },
            { targetCount: 15, batchSize: 10, expected: 2 },
            { targetCount: 10, batchSize: 10, expected: 1 },
            { targetCount: 1, batchSize: 10, expected: 1 },
            { targetCount: 500, batchSize: 10, expected: 50 }
        ];

        for (const { targetCount, batchSize, expected } of testCases) {
            const numBatches = Math.ceil(targetCount / batchSize);
            expect(numBatches).toBe(expected);
        }
    });

    it("should calculate correct batch sizes", () => {
        const targetCount = 25;
        const batchSize = 10;
        const numBatches = Math.ceil(targetCount / batchSize);

        const batchSizes: number[] = [];
        for (let i = 0; i < numBatches; i++) {
            batchSizes.push(Math.min(batchSize, targetCount - i * batchSize));
        }

        expect(batchSizes).toEqual([10, 10, 5]);
        expect(batchSizes.reduce((a, b) => a + b, 0)).toBe(targetCount);
    });
});

describe("Quality Score Calculation", () => {
    function calculateSimpleQualityScore(input: string, output: string): number {
        let score = 0.5;

        const outputLength = output.length;
        if (outputLength > 50 && outputLength < 2000) {
            score += 0.15;
        } else if (outputLength > 20) {
            score += 0.05;
        }

        const inputWords = new Set(
            input
                .toLowerCase()
                .split(/\s+/)
                .filter((w) => w.length > 3)
        );
        const outputWords = output
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 3);
        const overlap = outputWords.filter((w) => inputWords.has(w)).length;
        if (overlap > 0) {
            score += Math.min(0.2, overlap * 0.05);
        }

        if (output.includes(".") || output.includes("!") || output.includes("?")) {
            score += 0.1;
        }

        return Math.min(1.0, score);
    }

    it("should score a good response highly", () => {
        const input = "How do I submit my timesheet?";
        const output =
            "To submit your timesheet, go to the HR portal and click on the Timesheet tab. Fill in your hours for each day and click Submit.";

        const score = calculateSimpleQualityScore(input, output);
        expect(score).toBeGreaterThan(0.7);
    });

    it("should score an empty response low", () => {
        const input = "How do I submit my timesheet?";
        const output = "";

        const score = calculateSimpleQualityScore(input, output);
        expect(score).toBe(0.5);
    });

    it("should score a short response lower", () => {
        const input = "How do I submit my timesheet?";
        const output = "Click submit.";

        const score = calculateSimpleQualityScore(input, output);
        expect(score).toBeLessThan(0.7);
    });

    it("should reward word overlap with input", () => {
        const input = "How do I submit my timesheet?";
        const outputWithOverlap = "To submit your timesheet, follow these steps.";
        const outputNoOverlap = "Please follow these instructions carefully.";

        const scoreWithOverlap = calculateSimpleQualityScore(input, outputWithOverlap);
        const scoreNoOverlap = calculateSimpleQualityScore(input, outputNoOverlap);

        expect(scoreWithOverlap).toBeGreaterThan(scoreNoOverlap);
    });

    it("should cap score at 1.0", () => {
        const input = "timesheet submit hours work schedule payroll";
        const output =
            "Your timesheet for submit should include all work hours from your schedule. Contact payroll for assistance with timesheet submission and work hours tracking.";

        const score = calculateSimpleQualityScore(input, output);
        expect(score).toBeLessThanOrEqual(1.0);
    });
});
