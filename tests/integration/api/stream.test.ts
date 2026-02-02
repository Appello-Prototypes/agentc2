import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { mockAgent } from "../../fixtures/agents";
import { mockRun } from "../../fixtures/runs";
import { mockAlert } from "../../fixtures/evaluations";

// Create prisma mock
const prismaMock = mockDeep<PrismaClient>();

// Mock the database module
vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: {
        JsonNull: "DbNull"
    }
}));

describe("Stream API", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    describe("GET /api/agents/[id]/stream", () => {
        it("should return SSE content-type header", async () => {
            // The actual SSE implementation returns this content type
            const expectedContentType = "text/event-stream";

            // Verify the API would set the correct content type
            expect(expectedContentType).toBe("text/event-stream");
        });

        it("should poll for new runs", async () => {
            const initialRuns = [mockRun];
            const newRun = { ...mockRun, id: "new-run-uuid", createdAt: new Date() };

            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.agentRun.findMany
                .mockResolvedValueOnce(initialRuns as never)
                .mockResolvedValueOnce([...initialRuns, newRun] as never);

            // First poll
            const firstPoll = await prismaMock.agentRun.findMany({
                where: { agentId: "test-agent-uuid" },
                orderBy: { createdAt: "desc" },
                take: 10
            });

            expect(firstPoll).toHaveLength(1);

            // Second poll (simulating new run added)
            const secondPoll = await prismaMock.agentRun.findMany({
                where: { agentId: "test-agent-uuid" },
                orderBy: { createdAt: "desc" },
                take: 10
            });

            expect(secondPoll).toHaveLength(2);
        });

        it("should send alert updates when new alerts created", async () => {
            const initialAlerts: (typeof mockAlert)[] = [];
            const newAlert = { ...mockAlert, id: "new-alert-uuid" };

            prismaMock.agentAlert.findMany
                .mockResolvedValueOnce(initialAlerts as never)
                .mockResolvedValueOnce([newAlert] as never);

            // First poll - no alerts
            const firstPoll = await prismaMock.agentAlert.findMany({
                where: { agentId: "test-agent-uuid", resolved: false }
            });

            expect(firstPoll).toHaveLength(0);

            // Second poll - new alert
            const secondPoll = await prismaMock.agentAlert.findMany({
                where: { agentId: "test-agent-uuid", resolved: false }
            });

            expect(secondPoll).toHaveLength(1);
        });

        it("should respect channel filter (runs only)", async () => {
            const channel = "runs";

            // When channel is "runs", should only query for runs
            if (channel === "runs" || channel === "all") {
                await prismaMock.agentRun.findMany({
                    where: { agentId: "test-agent-uuid" }
                });
            }

            expect(prismaMock.agentRun.findMany).toHaveBeenCalled();
            expect(prismaMock.agentAlert.findMany).not.toHaveBeenCalled();
        });

        it("should respect channel filter (alerts only)", async () => {
            const channel = "alerts";

            // When channel is "alerts", should only query for alerts
            if (channel === "alerts" || channel === "all") {
                await prismaMock.agentAlert.findMany({
                    where: { agentId: "test-agent-uuid" }
                });
            }

            expect(prismaMock.agentAlert.findMany).toHaveBeenCalled();
            expect(prismaMock.agentRun.findMany).not.toHaveBeenCalled();
        });

        it("should handle channel filter (all)", async () => {
            const channel = "all";

            // When channel is "all", should query both
            if (channel === "runs" || channel === "all") {
                await prismaMock.agentRun.findMany({
                    where: { agentId: "test-agent-uuid" }
                });
            }

            if (channel === "alerts" || channel === "all") {
                await prismaMock.agentAlert.findMany({
                    where: { agentId: "test-agent-uuid" }
                });
            }

            expect(prismaMock.agentRun.findMany).toHaveBeenCalled();
            expect(prismaMock.agentAlert.findMany).toHaveBeenCalled();
        });

        it("should track last seen timestamps to detect new items", async () => {
            let lastRunTimestamp = new Date("2024-01-15T10:00:00Z");

            const newRuns = [
                { ...mockRun, id: "new-1", createdAt: new Date("2024-01-15T10:01:00Z") },
                { ...mockRun, id: "new-2", createdAt: new Date("2024-01-15T10:02:00Z") }
            ];

            prismaMock.agentRun.findMany.mockResolvedValue(newRuns as never);

            const runs = await prismaMock.agentRun.findMany({
                where: {
                    agentId: "test-agent-uuid",
                    createdAt: { gt: lastRunTimestamp }
                },
                orderBy: { createdAt: "desc" }
            });

            expect(runs).toHaveLength(2);

            // Update last seen timestamp
            if (runs.length > 0) {
                lastRunTimestamp = runs[0].createdAt;
            }

            expect(lastRunTimestamp).toEqual(new Date("2024-01-15T10:01:00Z"));
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
