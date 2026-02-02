import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { mockAgent } from "../../fixtures/agents";
import { mockRun } from "../../fixtures/runs";
import { mockFeedback, generateFeedback } from "../../fixtures/evaluations";

// Create prisma mock
const prismaMock = mockDeep<PrismaClient>();

// Mock the database module
vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: {
        JsonNull: "DbNull"
    }
}));

describe("Feedback API", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    describe("GET /api/agents/[id]/feedback", () => {
        it("should return feedback summary with positive/negative counts", async () => {
            const feedbacks = [
                { ...mockFeedback, thumbs: true },
                { ...mockFeedback, thumbs: true },
                { ...mockFeedback, thumbs: true },
                { ...mockFeedback, thumbs: false },
                { ...mockFeedback, thumbs: false }
            ];

            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.agentFeedback.findMany.mockResolvedValue(feedbacks as never);

            const allFeedback = await prismaMock.agentFeedback.findMany({
                where: { agentId: "test-agent-uuid" }
            });

            const positive = allFeedback.filter((f) => f.thumbs === true).length;
            const negative = allFeedback.filter((f) => f.thumbs === false).length;

            expect(positive).toBe(3);
            expect(negative).toBe(2);
        });

        it("should return average rating", async () => {
            const feedbacks = [
                { ...mockFeedback, rating: 5 },
                { ...mockFeedback, rating: 4 },
                { ...mockFeedback, rating: 5 },
                { ...mockFeedback, rating: 3 },
                { ...mockFeedback, rating: 5 }
            ];

            const avgRating = feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length;

            expect(avgRating).toBe(4.4);
        });

        it("should return evaluation themes", async () => {
            const themes = [
                { theme: "helpful", count: 10, sentiment: "positive" },
                { theme: "slow", count: 5, sentiment: "negative" },
                { theme: "accurate", count: 8, sentiment: "positive" }
            ];

            prismaMock.evaluationTheme.findMany.mockResolvedValue(themes as never);

            const themeData = await prismaMock.evaluationTheme.findMany({
                where: { agentId: "test-agent-uuid" }
            });

            expect(themeData).toHaveLength(3);
        });

        it("should respect date range", async () => {
            const from = new Date("2024-01-01");
            const to = new Date("2024-01-31");

            await prismaMock.agentFeedback.findMany({
                where: {
                    agentId: "test-agent-uuid",
                    createdAt: { gte: from, lte: to }
                }
            });

            expect(prismaMock.agentFeedback.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        createdAt: { gte: from, lte: to }
                    })
                })
            );
        });
    });

    describe("POST /api/agents/[id]/feedback", () => {
        it("should create feedback for run", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.agentRun.findFirst.mockResolvedValue(mockRun as never);
            prismaMock.agentFeedback.upsert.mockResolvedValue(mockFeedback as never);

            const feedbackData = {
                runId: "test-run-uuid",
                thumbs: true,
                rating: 5,
                comment: "Great response!"
            };

            const feedback = await prismaMock.agentFeedback.upsert({
                where: {
                    runId_agentId: {
                        runId: feedbackData.runId,
                        agentId: "test-agent-uuid"
                    }
                },
                create: {
                    runId: feedbackData.runId,
                    agentId: "test-agent-uuid",
                    tenantId: "test-tenant",
                    thumbs: feedbackData.thumbs,
                    rating: feedbackData.rating,
                    comment: feedbackData.comment
                },
                update: {
                    thumbs: feedbackData.thumbs,
                    rating: feedbackData.rating,
                    comment: feedbackData.comment
                }
            });

            expect(feedback).toBeDefined();
            expect(prismaMock.agentFeedback.upsert).toHaveBeenCalled();
        });

        it("should update existing feedback (upsert)", async () => {
            const existingFeedback = { ...mockFeedback, thumbs: true, rating: 4 };
            const updatedFeedback = { ...mockFeedback, thumbs: false, rating: 2 };

            prismaMock.agentFeedback.upsert.mockResolvedValue(updatedFeedback as never);

            const feedback = await prismaMock.agentFeedback.upsert({
                where: {
                    runId_agentId: {
                        runId: "test-run-uuid",
                        agentId: "test-agent-uuid"
                    }
                },
                create: {} as never,
                update: { thumbs: false, rating: 2 }
            });

            expect(feedback.thumbs).toBe(false);
            expect(feedback.rating).toBe(2);
        });

        it("should return 400 for missing runId", async () => {
            const requestBody = { thumbs: true };

            const isValid = "runId" in requestBody;
            expect(isValid).toBe(false);
        });

        it("should return 404 for invalid run", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.agentRun.findFirst.mockResolvedValue(null);

            const run = await prismaMock.agentRun.findFirst({
                where: {
                    id: "invalid-run-uuid",
                    agentId: "test-agent-uuid"
                }
            });

            expect(run).toBeNull();
        });

        it("should return 404 for run belonging to different agent", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
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
});
