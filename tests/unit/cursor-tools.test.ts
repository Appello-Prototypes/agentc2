import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@repo/database", () => ({
    prisma: {
        integrationConnection: {
            findFirst: vi.fn()
        }
    }
}));

vi.mock("../../packages/agentc2/src/crypto/encryption", () => ({
    decryptJson: vi.fn()
}));

const mockFetch = vi.fn();
const originalFetch = global.fetch;

beforeEach(() => {
    global.fetch = mockFetch as unknown as typeof fetch;
    process.env.CURSOR_API_KEY = "test-cursor-key";
});

afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.CURSOR_API_KEY;
    vi.clearAllMocks();
});

describe("Cursor Tools", () => {
    describe("cursor-launch-agent", () => {
        it("launches a Cursor Cloud Agent and returns agent info", async () => {
            const { cursorLaunchAgentTool } =
                await import("../../packages/agentc2/src/tools/cursor-tools");

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        id: "agent-123",
                        name: "Fix bug",
                        status: "CREATING",
                        target: {
                            branchName: "cursor/fix-bug",
                            url: "https://cursor.com/agent/123"
                        }
                    })
            });

            const result = await cursorLaunchAgentTool.execute({
                repository: "https://github.com/org/repo",
                prompt: "Fix the bug in utils.ts"
            });

            expect(result.agentId).toBe("agent-123");
            expect(result.status).toBe("CREATING");
            expect(result.branchName).toBe("cursor/fix-bug");

            const expectedAuth = `Basic ${Buffer.from("test-cursor-key:").toString("base64")}`;
            expect(mockFetch).toHaveBeenCalledWith(
                "https://api.cursor.com/v0/agents",
                expect.objectContaining({
                    method: "POST",
                    headers: expect.objectContaining({
                        Authorization: expectedAuth
                    })
                })
            );
        });

        it("throws on API error", async () => {
            const { cursorLaunchAgentTool } =
                await import("../../packages/agentc2/src/tools/cursor-tools");

            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                statusText: "Unauthorized",
                text: () => Promise.resolve("Invalid API key")
            });

            await expect(
                cursorLaunchAgentTool.execute({
                    repository: "https://github.com/org/repo",
                    prompt: "Fix bug"
                })
            ).rejects.toThrow("Cursor API error 401");
        });

        it("throws when no API key configured", async () => {
            delete process.env.CURSOR_API_KEY;

            const { cursorLaunchAgentTool } =
                await import("../../packages/agentc2/src/tools/cursor-tools");

            await expect(
                cursorLaunchAgentTool.execute({
                    repository: "https://github.com/org/repo",
                    prompt: "Fix bug"
                })
            ).rejects.toThrow("No Cursor API key found");
        });
    });

    describe("cursor-get-status", () => {
        it("returns agent status", async () => {
            const { cursorGetStatusTool } =
                await import("../../packages/agentc2/src/tools/cursor-tools");

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        id: "agent-123",
                        status: "RUNNING",
                        name: "Fix bug",
                        summary: "Working on fix...",
                        target: { branchName: "cursor/fix-bug" }
                    })
            });

            const result = await cursorGetStatusTool.execute({
                agentId: "agent-123"
            });

            expect(result.status).toBe("RUNNING");
            expect(result.branchName).toBe("cursor/fix-bug");
        });
    });

    describe("cursor-add-followup", () => {
        it("sends followup instructions", async () => {
            const { cursorAddFollowupTool } =
                await import("../../packages/agentc2/src/tools/cursor-tools");

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ success: true })
            });

            const result = await cursorAddFollowupTool.execute({
                agentId: "agent-123",
                prompt: "Also fix the test file"
            });

            expect(result.success).toBe(true);
            expect(mockFetch).toHaveBeenCalledWith(
                "https://api.cursor.com/v0/agents/agent-123/followup",
                expect.objectContaining({ method: "POST" })
            );
        });
    });

    describe("cursor-get-conversation", () => {
        it("returns conversation messages", async () => {
            const { cursorGetConversationTool } =
                await import("../../packages/agentc2/src/tools/cursor-tools");

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        messages: [
                            {
                                role: "user",
                                content: "Fix the bug",
                                timestamp: "2026-01-01T00:00:00Z"
                            },
                            {
                                role: "assistant",
                                content: "I found the issue...",
                                timestamp: "2026-01-01T00:01:00Z"
                            }
                        ]
                    })
            });

            const result = await cursorGetConversationTool.execute({
                agentId: "agent-123"
            });

            expect(result.messages).toHaveLength(2);
            expect(result.messages[0].role).toBe("user");
        });

        it("handles empty conversation", async () => {
            const { cursorGetConversationTool } =
                await import("../../packages/agentc2/src/tools/cursor-tools");

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ messages: [] })
            });

            const result = await cursorGetConversationTool.execute({
                agentId: "agent-123"
            });

            expect(result.messages).toHaveLength(0);
        });
    });

    describe("cursor-poll-until-done", () => {
        it("returns when agent completes", async () => {
            const { cursorPollUntilDoneTool } =
                await import("../../packages/agentc2/src/tools/cursor-tools");

            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            status: "RUNNING",
                            target: { branchName: "cursor/fix" }
                        })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            status: "COMPLETED",
                            summary: "Done!",
                            target: { branchName: "cursor/fix" }
                        })
                });

            const result = await cursorPollUntilDoneTool.execute({
                agentId: "agent-123",
                maxWaitMinutes: 1
            });

            expect(result.status).toBe("COMPLETED");
            expect(result.timedOut).toBe(false);
            expect(result.branchName).toBe("cursor/fix");
        });

        it("returns on FAILED status", async () => {
            const { cursorPollUntilDoneTool } =
                await import("../../packages/agentc2/src/tools/cursor-tools");

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        status: "FAILED",
                        summary: "Build error"
                    })
            });

            const result = await cursorPollUntilDoneTool.execute({
                agentId: "agent-123",
                maxWaitMinutes: 1
            });

            expect(result.status).toBe("FAILED");
            expect(result.timedOut).toBe(false);
        });
    });
});
