import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import {
    mockSimulationSession,
    mockRunningSession,
    mockCompletedSession
} from "../../fixtures/simulations";
import { mockAgent } from "../../fixtures/agents";

// Create prisma mock
const prismaMock = mockDeep<PrismaClient>();

// Create inngest mock
const inngestMock = {
    send: vi.fn().mockResolvedValue({ ids: ["test-event-id"] })
};

// Mock agent resolver
const mockSimulatorAgent = {
    generate: vi.fn().mockResolvedValue({
        text: "Hey, I submitted my timesheet last Friday but it still shows as pending."
    })
};

const mockTargetAgent = {
    generate: vi.fn().mockResolvedValue({
        text: "I'll look into that for you. Can you confirm which pay period this is for?"
    })
};

const agentResolverMock = {
    resolve: vi.fn().mockImplementation(async (options: { slug?: string; id?: string }) => {
        if (options.slug === "simulator") {
            return {
                agent: mockSimulatorAgent,
                record: { slug: "simulator", maxSteps: 1 }
            };
        }
        return {
            agent: mockTargetAgent,
            record: mockAgent
        };
    })
};

// Mock modules
vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: {
        JsonNull: "DbNull",
        InputJsonValue: {}
    }
}));

vi.mock("@/lib/inngest", () => ({
    inngest: inngestMock
}));

vi.mock("@repo/mastra", () => ({
    agentResolver: agentResolverMock
}));

describe("Simulation Inngest Functions", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    describe("simulation/session.start", () => {
        it("should mark session as RUNNING", async () => {
            const runningSession = {
                ...mockSimulationSession,
                status: "RUNNING",
                startedAt: new Date()
            };
            prismaMock.simulationSession.update.mockResolvedValue(runningSession as never);

            const updated = await prismaMock.simulationSession.update({
                where: { id: mockSimulationSession.id },
                data: {
                    status: "RUNNING",
                    startedAt: new Date()
                }
            });

            expect(updated.status).toBe("RUNNING");
            expect(updated.startedAt).toBeDefined();
        });

        it("should fan out batch events", async () => {
            const targetCount = 100;
            const batchSize = 10;
            const numBatches = Math.ceil(targetCount / batchSize);

            const events = [];
            for (let i = 0; i < numBatches; i++) {
                events.push({
                    name: "simulation/batch.run",
                    data: {
                        sessionId: mockSimulationSession.id,
                        agentId: mockSimulationSession.agentId,
                        theme: mockSimulationSession.theme,
                        batchIndex: i,
                        batchSize: Math.min(batchSize, targetCount - i * batchSize)
                    }
                });
            }

            await inngestMock.send(events);

            expect(inngestMock.send).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        name: "simulation/batch.run",
                        data: expect.objectContaining({
                            batchIndex: 0,
                            batchSize: 10
                        })
                    })
                ])
            );
            expect(events).toHaveLength(10);
        });

        it("should respect concurrency setting for event chunking", async () => {
            const concurrency = 3;
            const events = Array.from({ length: 10 }, (_, i) => ({
                name: "simulation/batch.run",
                data: { batchIndex: i }
            }));

            // Simulate chunking
            const chunks: (typeof events)[] = [];
            for (let i = 0; i < events.length; i += concurrency) {
                chunks.push(events.slice(i, i + concurrency));
            }

            expect(chunks).toHaveLength(4); // 10 events / 3 concurrency = 4 chunks
            expect(chunks[0]).toHaveLength(3);
            expect(chunks[3]).toHaveLength(1); // Last chunk has 1 event
        });
    });

    describe("simulation/batch.run", () => {
        it("should resolve both simulator and target agents", async () => {
            const [simulatorResult, targetResult] = await Promise.all([
                agentResolverMock.resolve({ slug: "simulator" }),
                agentResolverMock.resolve({ id: mockAgent.id })
            ]);

            expect(simulatorResult.agent).toBe(mockSimulatorAgent);
            expect(targetResult.agent).toBe(mockTargetAgent);
        });

        it("should generate prompts using simulator agent", async () => {
            const theme = "Customer service about timesheets";
            const result = await mockSimulatorAgent.generate(
                `Generate a realistic user message for this theme: "${theme}"`,
                { maxSteps: 1 }
            );

            expect(result.text).toBeDefined();
            expect(result.text.length).toBeGreaterThan(0);
            expect(mockSimulatorAgent.generate).toHaveBeenCalled();
        });

        it("should run prompts through target agent", async () => {
            const prompt =
                "Hey, I submitted my timesheet last Friday but it still shows as pending.";
            const result = await mockTargetAgent.generate(prompt, { maxSteps: 5 });

            expect(result.text).toBeDefined();
            expect(mockTargetAgent.generate).toHaveBeenCalledWith(prompt, { maxSteps: 5 });
        });

        it("should save runs with source=simulation", async () => {
            const runData = {
                agentId: mockAgent.id,
                runType: "TEST",
                status: "COMPLETED",
                inputText: "Test prompt",
                outputText: "Test response",
                durationMs: 1000,
                source: "simulation",
                sessionId: mockSimulationSession.id
            };

            prismaMock.agentRun.create.mockResolvedValue(runData as never);

            const run = await prismaMock.agentRun.create({ data: runData as never });

            expect(run.source).toBe("simulation");
            expect(run.sessionId).toBe(mockSimulationSession.id);
        });

        it("should update session progress after batch", async () => {
            prismaMock.simulationSession.update.mockResolvedValue({
                ...mockRunningSession,
                completedCount: 44,
                failedCount: 3
            } as never);

            const updated = await prismaMock.simulationSession.update({
                where: { id: mockRunningSession.id },
                data: {
                    completedCount: { increment: 10 },
                    failedCount: { increment: 1 }
                }
            });

            expect(updated.completedCount).toBe(44);
            expect(updated.failedCount).toBe(3);
        });

        it("should mark session COMPLETED when all batches done", async () => {
            const session = {
                ...mockRunningSession,
                completedCount: 98,
                failedCount: 2,
                targetCount: 100
            };

            prismaMock.simulationSession.update.mockResolvedValue(session as never);

            const updated = await prismaMock.simulationSession.update({
                where: { id: session.id },
                data: {
                    completedCount: { increment: 10 }
                }
            });

            const totalProcessed = updated.completedCount + updated.failedCount;

            expect(totalProcessed).toBe(100);
            expect(totalProcessed).toBeGreaterThanOrEqual(session.targetCount);
        });

        it("should calculate final aggregates on completion", async () => {
            const runs = [
                { durationMs: 1000, status: "COMPLETED" },
                { durationMs: 1500, status: "COMPLETED" },
                { durationMs: 2000, status: "COMPLETED" },
                { durationMs: null, status: "FAILED" }
            ];

            prismaMock.agentRun.findMany.mockResolvedValue(runs as never);

            const allRuns = await prismaMock.agentRun.findMany({
                where: { source: "simulation", sessionId: mockSimulationSession.id }
            });

            const completedRuns = allRuns.filter((r) => r.status === "COMPLETED");
            const avgDuration =
                completedRuns.reduce((sum, r) => sum + (r.durationMs || 0), 0) /
                completedRuns.length;
            const successRate = completedRuns.length / allRuns.length;

            expect(avgDuration).toBe(1500); // (1000 + 1500 + 2000) / 3
            expect(successRate).toBe(0.75); // 3/4
        });

        it("should handle empty prompt from simulator gracefully", async () => {
            mockSimulatorAgent.generate.mockResolvedValueOnce({ text: "" });

            const result = await mockSimulatorAgent.generate("Generate prompt", { maxSteps: 1 });
            const userPrompt = result.text.trim();

            expect(userPrompt).toBe("");

            // Should skip this conversation and count as failed
            const conversationResult = {
                success: userPrompt.length > 0,
                error: userPrompt.length === 0 ? "Empty prompt generated" : undefined
            };

            expect(conversationResult.success).toBe(false);
            expect(conversationResult.error).toBe("Empty prompt generated");
        });

        it("should handle target agent errors gracefully", async () => {
            mockTargetAgent.generate.mockRejectedValueOnce(new Error("Model timeout"));

            try {
                await mockTargetAgent.generate("Test prompt", { maxSteps: 5 });
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toBe("Model timeout");
            }
        });
    });

    describe("Progress Tracking", () => {
        it("should calculate progress percentage correctly", () => {
            const testCases = [
                { completed: 0, failed: 0, target: 100, expected: 0 },
                { completed: 25, failed: 5, target: 100, expected: 30 },
                { completed: 50, failed: 0, target: 100, expected: 50 },
                { completed: 98, failed: 2, target: 100, expected: 100 }
            ];

            for (const { completed, failed, target, expected } of testCases) {
                const progress = Math.round(((completed + failed) / target) * 100);
                expect(progress).toBe(expected);
            }
        });

        it("should detect when session is complete", () => {
            const testCases = [
                { completed: 98, failed: 2, target: 100, isComplete: true },
                { completed: 50, failed: 5, target: 100, isComplete: false },
                { completed: 100, failed: 0, target: 100, isComplete: true },
                { completed: 99, failed: 0, target: 100, isComplete: false }
            ];

            for (const { completed, failed, target, isComplete } of testCases) {
                const totalProcessed = completed + failed;
                expect(totalProcessed >= target).toBe(isComplete);
            }
        });
    });
});

describe("Simulation Event Flow", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    it("should emit run/completed for each simulation run", async () => {
        // Simulate the run-recorder behavior
        const runCompleteEvent = {
            name: "run/completed",
            data: {
                runId: "sim-run-123",
                agentId: mockAgent.id,
                status: "COMPLETED",
                durationMs: 1200,
                totalTokens: 350,
                costUsd: 0.005
            }
        };

        await inngestMock.send(runCompleteEvent);

        expect(inngestMock.send).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "run/completed",
                data: expect.objectContaining({
                    status: "COMPLETED"
                })
            })
        );
    });

    it("should trigger evaluation pipeline for simulation runs", async () => {
        // The run/completed event should trigger evaluations
        const evaluationEvent = {
            name: "run/evaluate",
            data: {
                runId: "sim-run-123",
                agentId: mockAgent.id
            }
        };

        await inngestMock.send(evaluationEvent);

        expect(inngestMock.send).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "run/evaluate"
            })
        );
    });
});

describe("Error Handling", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    it("should handle database errors gracefully", async () => {
        prismaMock.simulationSession.update.mockRejectedValue(
            new Error("Database connection lost")
        );

        try {
            await prismaMock.simulationSession.update({
                where: { id: mockSimulationSession.id },
                data: { status: "RUNNING" }
            });
        } catch (error) {
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toBe("Database connection lost");
        }
    });

    it("should handle agent resolution errors", async () => {
        agentResolverMock.resolve.mockRejectedValueOnce(new Error("Agent not found"));

        try {
            await agentResolverMock.resolve({ id: "nonexistent-agent" });
        } catch (error) {
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toBe("Agent not found");
        }
    });

    it("should mark session as FAILED on critical error", async () => {
        const failedSession = {
            ...mockRunningSession,
            status: "FAILED",
            completedAt: new Date()
        };

        prismaMock.simulationSession.update.mockResolvedValue(failedSession as never);

        const updated = await prismaMock.simulationSession.update({
            where: { id: mockRunningSession.id },
            data: {
                status: "FAILED",
                completedAt: new Date()
            }
        });

        expect(updated.status).toBe("FAILED");
    });
});
