import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockPrisma = {
    supportTicket: {
        findUnique: vi.fn(),
        update: vi.fn()
    },
    backlogTask: {
        findUnique: vi.fn(),
        update: vi.fn()
    },
    codingPipelineRun: {
        create: vi.fn(),
        update: vi.fn()
    },
    workflow: {
        findFirst: vi.fn()
    },
    workflowRun: {
        create: vi.fn()
    }
};

vi.mock("@repo/database", () => ({
    prisma: mockPrisma
}));

beforeEach(() => {
    vi.clearAllMocks();
});

describe("Coding Pipeline Tools", () => {
    describe("ingest-ticket", () => {
        it("normalizes a SupportTicket", async () => {
            const { ingestTicketTool } =
                await import("../../packages/agentc2/src/tools/coding-pipeline-tools");

            mockPrisma.supportTicket.findUnique.mockResolvedValueOnce({
                id: "ticket-1",
                title: "Button not working",
                description: "The submit button is broken",
                type: "BUG",
                priority: "HIGH",
                metadata: { page: "/settings" }
            });

            const result = await ingestTicketTool.execute({
                sourceType: "support_ticket",
                sourceId: "ticket-1",
                repository: "https://github.com/org/repo"
            });

            expect(result.sourceType).toBe("support_ticket");
            expect(result.title).toBe("Button not working");
            expect(result.priority).toBe("HIGH");
            expect(result.repository).toBe("https://github.com/org/repo");
        });

        it("normalizes a BacklogTask", async () => {
            const { ingestTicketTool } =
                await import("../../packages/agentc2/src/tools/coding-pipeline-tools");

            mockPrisma.backlogTask.findUnique.mockResolvedValueOnce({
                id: "task-1",
                title: "Add dark mode",
                description: "Implement dark mode toggle",
                priority: 7,
                contextJson: { component: "settings" }
            });

            const result = await ingestTicketTool.execute({
                sourceType: "backlog_task",
                sourceId: "task-1"
            });

            expect(result.sourceType).toBe("backlog_task");
            expect(result.title).toBe("Add dark mode");
            expect(result.priority).toBe("7");
            expect(result.repository).toBeNull();
        });

        it("normalizes a GitHub Issue", async () => {
            const { ingestTicketTool } =
                await import("../../packages/agentc2/src/tools/coding-pipeline-tools");

            const result = await ingestTicketTool.execute({
                sourceType: "github_issue",
                sourceId: "42",
                repository: "https://github.com/org/repo"
            });

            expect(result.sourceType).toBe("github_issue");
            expect(result.title).toBe("GitHub Issue #42");
            expect(result.repository).toBe("https://github.com/org/repo");
        });

        it("throws for missing SupportTicket", async () => {
            const { ingestTicketTool } =
                await import("../../packages/agentc2/src/tools/coding-pipeline-tools");

            mockPrisma.supportTicket.findUnique.mockResolvedValueOnce(null);

            await expect(
                ingestTicketTool.execute({
                    sourceType: "support_ticket",
                    sourceId: "nonexistent"
                })
            ).rejects.toThrow("SupportTicket not found");
        });

        it("throws for missing BacklogTask", async () => {
            const { ingestTicketTool } =
                await import("../../packages/agentc2/src/tools/coding-pipeline-tools");

            mockPrisma.backlogTask.findUnique.mockResolvedValueOnce(null);

            await expect(
                ingestTicketTool.execute({
                    sourceType: "backlog_task",
                    sourceId: "nonexistent"
                })
            ).rejects.toThrow("BacklogTask not found");
        });
    });

    describe("update-pipeline-status", () => {
        it("updates pipeline run status", async () => {
            const { updatePipelineStatusTool } =
                await import("../../packages/agentc2/src/tools/coding-pipeline-tools");

            mockPrisma.codingPipelineRun.update.mockResolvedValueOnce({});

            const result = await updatePipelineStatusTool.execute({
                pipelineRunId: "run-1",
                status: "coding",
                cursorAgentId: "agent-123",
                targetBranch: "cursor/fix-bug"
            });

            expect(result.success).toBe(true);
            expect(mockPrisma.codingPipelineRun.update).toHaveBeenCalledWith({
                where: { id: "run-1" },
                data: expect.objectContaining({
                    status: "coding",
                    cursorAgentId: "agent-123",
                    targetBranch: "cursor/fix-bug"
                })
            });
        });

        it("updates with PR details", async () => {
            const { updatePipelineStatusTool } =
                await import("../../packages/agentc2/src/tools/coding-pipeline-tools");

            mockPrisma.codingPipelineRun.update.mockResolvedValueOnce({});

            const result = await updatePipelineStatusTool.execute({
                pipelineRunId: "run-1",
                status: "awaiting_pr_review",
                prNumber: 42,
                prUrl: "https://github.com/org/repo/pull/42",
                riskLevel: "medium"
            });

            expect(result.success).toBe(true);
        });
    });
});
