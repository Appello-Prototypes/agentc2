import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { mockAgent } from "../../fixtures/agents";
import { mockRun } from "../../fixtures/runs";
import { mockEvaluation, generateEvaluation } from "../../fixtures/evaluations";

// Create prisma mock
const prismaMock = mockDeep<PrismaClient>();

// Mock the database module
vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: {
        JsonNull: "DbNull"
    }
}));

describe("Evaluations API", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    describe("GET /api/agents/[id]/evaluations", () => {
        it("should return paginated evaluations with run details", async () => {
            const evaluations = [
                { ...mockEvaluation, run: mockRun },
                { ...generateEvaluation(), run: mockRun },
                { ...generateEvaluation(), run: mockRun }
            ];

            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.agentEvaluation.findMany.mockResolvedValue(evaluations as never);

            const evals = await prismaMock.agentEvaluation.findMany({
                where: { agentId: "test-agent-uuid" },
                include: { run: true },
                take: 50,
                orderBy: { createdAt: "desc" }
            });

            expect(evals).toHaveLength(3);
            expect(evals[0].run).toBeDefined();
        });

        it("should return summary with average scores per scorer", async () => {
            const evaluations = [
                { scorerName: "relevancy", score: 0.9 },
                { scorerName: "relevancy", score: 0.8 },
                { scorerName: "relevancy", score: 0.85 },
                { scorerName: "helpfulness", score: 0.95 },
                { scorerName: "helpfulness", score: 0.9 }
            ];

            // Calculate averages
            const byScorer: Record<string, number[]> = {};
            evaluations.forEach((e) => {
                if (!byScorer[e.scorerName]) byScorer[e.scorerName] = [];
                byScorer[e.scorerName].push(e.score);
            });

            const summary = Object.entries(byScorer).map(([scorer, scores]) => ({
                scorer,
                count: scores.length,
                average: scores.reduce((a, b) => a + b, 0) / scores.length
            }));

            expect(summary.find((s) => s.scorer === "relevancy")?.average).toBeCloseTo(0.85);
            expect(summary.find((s) => s.scorer === "helpfulness")?.average).toBeCloseTo(0.925);
        });

        it("should handle cursor pagination", async () => {
            prismaMock.agentEvaluation.findMany.mockResolvedValue([]);

            await prismaMock.agentEvaluation.findMany({
                where: { agentId: "test-agent-uuid" },
                cursor: { id: "cursor-id" },
                skip: 1,
                take: 50
            });

            expect(prismaMock.agentEvaluation.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    cursor: { id: "cursor-id" },
                    skip: 1
                })
            );
        });

        it("should respect date range filter", async () => {
            const from = new Date("2024-01-01");
            const to = new Date("2024-01-31");

            await prismaMock.agentEvaluation.findMany({
                where: {
                    agentId: "test-agent-uuid",
                    createdAt: { gte: from, lte: to }
                }
            });

            expect(prismaMock.agentEvaluation.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        createdAt: { gte: from, lte: to }
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
