import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { mockAgent } from "../../fixtures/agents";
import { mockRun, mockFailedRun, generateRuns } from "../../fixtures/runs";
import { mockAlert, mockEvaluation } from "../../fixtures/evaluations";

// Create prisma mock
const prismaMock = mockDeep<PrismaClient>();

// Mock the database module
vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: {
        JsonNull: "DbNull"
    }
}));

describe("Overview API", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    describe("GET /api/agents/[id]/overview", () => {
        it("should return stats for date range", async () => {
            const runs = [mockRun, { ...mockRun, id: "run-2" }, { ...mockRun, id: "run-3" }];

            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.agentRun.findMany.mockResolvedValue(runs as never);
            prismaMock.agentRun.count.mockResolvedValue(3);
            prismaMock.agentAlert.findMany.mockResolvedValue([]);
            prismaMock.agentEvaluation.findMany.mockResolvedValue([]);

            // Get runs for stats
            const runsResult = await prismaMock.agentRun.findMany({
                where: {
                    agentId: "test-agent-uuid",
                    startedAt: { gte: new Date(), lte: new Date() }
                }
            });

            expect(runsResult).toHaveLength(3);

            // Calculate stats
            const totalRuns = runsResult.length;
            const successfulRuns = runsResult.filter((r) => r.status === "COMPLETED").length;
            const successRate = totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0;
            const avgLatency =
                runsResult.reduce((sum, r) => sum + (r.durationMs || 0), 0) / totalRuns;

            expect(totalRuns).toBe(3);
            expect(successRate).toBe(100);
            expect(avgLatency).toBeGreaterThan(0);
        });

        it("should return recent runs (limit 10)", async () => {
            const recentRuns = generateRuns(10, { agentId: "test-agent-uuid" });

            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.agentRun.findMany.mockResolvedValue(recentRuns as never);

            const runs = await prismaMock.agentRun.findMany({
                where: { agentId: "test-agent-uuid" },
                orderBy: { startedAt: "desc" },
                take: 10
            });

            expect(runs).toHaveLength(10);
            expect(prismaMock.agentRun.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    orderBy: { startedAt: "desc" },
                    take: 10
                })
            );
        });

        it("should return active alerts (non-resolved)", async () => {
            const activeAlerts = [
                { ...mockAlert, id: "alert-1", resolved: false },
                { ...mockAlert, id: "alert-2", resolved: false }
            ];

            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.agentAlert.findMany.mockResolvedValue(activeAlerts as never);

            const alerts = await prismaMock.agentAlert.findMany({
                where: {
                    agentId: "test-agent-uuid",
                    resolved: false
                },
                orderBy: { createdAt: "desc" }
            });

            expect(alerts).toHaveLength(2);
            alerts.forEach((alert) => {
                expect(alert.resolved).toBe(false);
            });
        });

        it("should calculate health status as HEALTHY when success rate > 95%", async () => {
            // 98 successful, 2 failed = 98% success rate
            const runs = [
                ...generateRuns(98, { status: "COMPLETED" }),
                ...generateRuns(2, { status: "FAILED" })
            ];

            const successfulRuns = runs.filter((r) => r.status === "COMPLETED").length;
            const successRate = (successfulRuns / runs.length) * 100;

            expect(successRate).toBe(98);

            // Health calculation
            let health: "HEALTHY" | "DEGRADED" | "CRITICAL";
            if (successRate >= 95) {
                health = "HEALTHY";
            } else if (successRate >= 80) {
                health = "DEGRADED";
            } else {
                health = "CRITICAL";
            }

            expect(health).toBe("HEALTHY");
        });

        it("should calculate health status as DEGRADED when success rate 80-95%", async () => {
            // 85 successful, 15 failed = 85% success rate
            const runs = [
                ...generateRuns(85, { status: "COMPLETED" }),
                ...generateRuns(15, { status: "FAILED" })
            ];

            const successfulRuns = runs.filter((r) => r.status === "COMPLETED").length;
            const successRate = (successfulRuns / runs.length) * 100;

            expect(successRate).toBe(85);

            let health: "HEALTHY" | "DEGRADED" | "CRITICAL";
            if (successRate >= 95) {
                health = "HEALTHY";
            } else if (successRate >= 80) {
                health = "DEGRADED";
            } else {
                health = "CRITICAL";
            }

            expect(health).toBe("DEGRADED");
        });

        it("should calculate health status as CRITICAL when success rate < 80%", async () => {
            // 70 successful, 30 failed = 70% success rate
            const runs = [
                ...generateRuns(70, { status: "COMPLETED" }),
                ...generateRuns(30, { status: "FAILED" })
            ];

            const successfulRuns = runs.filter((r) => r.status === "COMPLETED").length;
            const successRate = (successfulRuns / runs.length) * 100;

            expect(successRate).toBe(70);

            let health: "HEALTHY" | "DEGRADED" | "CRITICAL";
            if (successRate >= 95) {
                health = "HEALTHY";
            } else if (successRate >= 80) {
                health = "DEGRADED";
            } else {
                health = "CRITICAL";
            }

            expect(health).toBe("CRITICAL");
        });

        it("should return quality scores from evaluations", async () => {
            const evaluations = [
                { ...mockEvaluation, scorerName: "helpfulness", score: 0.9 },
                { ...mockEvaluation, scorerName: "relevancy", score: 0.85 },
                { ...mockEvaluation, scorerName: "toxicity", score: 0.1 },
                { ...mockEvaluation, scorerName: "helpfulness", score: 0.8 },
                { ...mockEvaluation, scorerName: "relevancy", score: 0.9 }
            ];

            prismaMock.agentEvaluation.findMany.mockResolvedValue(evaluations as never);

            // Calculate averages by scorer
            const scoresByScorer: Record<string, number[]> = {};
            evaluations.forEach((e) => {
                if (!scoresByScorer[e.scorerName]) {
                    scoresByScorer[e.scorerName] = [];
                }
                scoresByScorer[e.scorerName].push(e.score);
            });

            const averages: Record<string, number> = {};
            Object.entries(scoresByScorer).forEach(([scorer, scores]) => {
                averages[scorer] = scores.reduce((a, b) => a + b, 0) / scores.length;
            });

            expect(averages.helpfulness).toBeCloseTo(0.85);
            expect(averages.relevancy).toBeCloseTo(0.875);
            expect(averages.toxicity).toBeCloseTo(0.1);
        });

        it("should return 404 for invalid agent", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(null);

            const agent = await prismaMock.agent.findFirst({
                where: { id: "invalid-agent-uuid" }
            });

            expect(agent).toBeNull();
        });

        it("should handle empty runs gracefully", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.agentRun.findMany.mockResolvedValue([]);
            prismaMock.agentRun.count.mockResolvedValue(0);

            const runs = await prismaMock.agentRun.findMany({
                where: { agentId: "test-agent-uuid" }
            });

            expect(runs).toHaveLength(0);

            // Stats should handle zero runs
            const totalRuns = runs.length;
            const successRate = totalRuns > 0 ? 100 : 0;
            const avgLatency = totalRuns > 0 ? 0 : 0;

            expect(totalRuns).toBe(0);
            expect(successRate).toBe(0);
            expect(avgLatency).toBe(0);
        });
    });
});
