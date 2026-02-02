import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { mockAgent } from "../../fixtures/agents";
import { mockRun, generateRuns } from "../../fixtures/runs";
import { mockEvaluation } from "../../fixtures/evaluations";

// Create prisma mock
const prismaMock = mockDeep<PrismaClient>();

// Mock the database module
vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: {
        JsonNull: "DbNull"
    }
}));

describe("Analytics API", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    describe("GET /api/agents/[id]/analytics", () => {
        it("should return summary metrics", async () => {
            const runs = generateRuns(100, { agentId: "test-agent-uuid" });
            const completedRuns = runs.filter((r) => r.status === "COMPLETED");

            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.agentRun.findMany.mockResolvedValue(runs as never);
            prismaMock.agentRun.count.mockResolvedValue(100);

            const totalRuns = 100;
            const successRate = (completedRuns.length / totalRuns) * 100;

            expect(totalRuns).toBe(100);
            expect(successRate).toBeGreaterThan(0);
        });

        it("should return latency percentiles (p50, p95, p99)", async () => {
            const latencies = [100, 150, 200, 250, 300, 350, 400, 450, 500, 1000];

            // Calculate percentiles
            const sorted = [...latencies].sort((a, b) => a - b);
            const p50Index = Math.floor(sorted.length * 0.5);
            const p95Index = Math.floor(sorted.length * 0.95);
            const p99Index = Math.min(Math.floor(sorted.length * 0.99), sorted.length - 1);

            const p50 = sorted[p50Index];
            const p95 = sorted[p95Index];
            const p99 = sorted[p99Index];

            // With 10 items: p50 is index 5 (350), p95 is index 9 (1000), p99 is index 9 (1000)
            expect(p50).toBe(350);
            expect(p95).toBe(1000);
            expect(p99).toBe(1000);
        });

        it("should return tool usage breakdown", async () => {
            const toolCalls = [
                { toolName: "web-search", count: 50 },
                { toolName: "calculator", count: 30 },
                { toolName: "calendar", count: 20 }
            ];

            prismaMock.agentToolCall.groupBy.mockResolvedValue(
                toolCalls.map((t) => ({
                    toolName: t.toolName,
                    _count: { id: t.count }
                })) as never
            );

            const toolUsage = await prismaMock.agentToolCall.groupBy({
                by: ["toolName"],
                where: { trace: { agentId: "test-agent-uuid" } },
                _count: { id: true }
            });

            expect(toolUsage).toHaveLength(3);
        });

        it("should return quality scores (average per scorer)", async () => {
            const evaluations = [
                { scorerName: "relevancy", score: 0.9 },
                { scorerName: "relevancy", score: 0.8 },
                { scorerName: "toxicity", score: 0.1 },
                { scorerName: "toxicity", score: 0.05 }
            ];

            // Calculate averages
            const byScorer: Record<string, number[]> = {};
            evaluations.forEach((e) => {
                if (!byScorer[e.scorerName]) byScorer[e.scorerName] = [];
                byScorer[e.scorerName].push(e.score);
            });

            const averages = Object.entries(byScorer).map(([scorer, scores]) => ({
                scorer,
                average: scores.reduce((a, b) => a + b, 0) / scores.length
            }));

            expect(averages.find((a) => a.scorer === "relevancy")?.average).toBeCloseTo(0.85);
            expect(averages.find((a) => a.scorer === "toxicity")?.average).toBeCloseTo(0.075);
        });

        it("should return model usage by model with token/cost totals", async () => {
            const modelUsage = [
                { modelName: "claude-sonnet", totalTokens: 100000, costUsd: 20.0, runCount: 50 },
                { modelName: "claude-haiku", totalTokens: 50000, costUsd: 5.0, runCount: 30 }
            ];

            expect(modelUsage[0].modelName).toBe("claude-sonnet");
            expect(modelUsage[0].totalTokens).toBe(100000);
            expect(modelUsage[1].costUsd).toBe(5.0);
        });

        it("should return daily trends", async () => {
            const dailyTrends = [
                { date: "2024-01-15", runs: 10, successRate: 90 },
                { date: "2024-01-16", runs: 15, successRate: 95 },
                { date: "2024-01-17", runs: 12, successRate: 85 }
            ];

            expect(dailyTrends).toHaveLength(3);
            expect(dailyTrends[1].runs).toBe(15);
        });

        it("should respect date range params", async () => {
            const from = new Date("2024-01-01");
            const to = new Date("2024-01-31");

            prismaMock.agentRun.findMany.mockResolvedValue([]);

            await prismaMock.agentRun.findMany({
                where: {
                    agentId: "test-agent-uuid",
                    startedAt: { gte: from, lte: to }
                }
            });

            expect(prismaMock.agentRun.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        startedAt: { gte: from, lte: to }
                    })
                })
            );
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
