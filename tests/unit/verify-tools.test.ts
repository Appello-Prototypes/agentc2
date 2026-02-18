import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@repo/database", () => ({
    prisma: {
        integrationConnection: {
            findFirst: vi.fn()
        }
    }
}));

vi.mock("../../packages/mastra/src/crypto/encryption", () => ({
    decryptJson: vi.fn()
}));

const mockFetch = vi.fn();
const originalFetch = global.fetch;

beforeEach(() => {
    global.fetch = mockFetch as unknown as typeof fetch;
    process.env.GITHUB_PERSONAL_ACCESS_TOKEN = "test-gh-token";
});

afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    vi.clearAllMocks();
});

describe("Verify Tools", () => {
    describe("wait-for-checks", () => {
        it("returns allPassed when all checks succeed", async () => {
            const { waitForChecksTool } =
                await import("../../packages/mastra/src/tools/verify-tools");

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        check_runs: [
                            {
                                name: "build",
                                status: "completed",
                                conclusion: "success"
                            },
                            {
                                name: "test",
                                status: "completed",
                                conclusion: "success"
                            }
                        ]
                    })
            });

            const result = await waitForChecksTool.execute({
                repository: "https://github.com/org/repo",
                ref: "feature-branch",
                maxWaitMinutes: 1
            });

            expect(result.allPassed).toBe(true);
            expect(result.timedOut).toBe(false);
            expect(result.checks).toHaveLength(2);
        });

        it("returns failure when a check fails", async () => {
            const { waitForChecksTool } =
                await import("../../packages/mastra/src/tools/verify-tools");

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        check_runs: [
                            {
                                name: "build",
                                status: "completed",
                                conclusion: "success"
                            },
                            {
                                name: "lint",
                                status: "completed",
                                conclusion: "failure"
                            }
                        ]
                    })
            });

            const result = await waitForChecksTool.execute({
                repository: "org/repo",
                ref: "feature-branch",
                maxWaitMinutes: 1
            });

            expect(result.allPassed).toBe(false);
            expect(result.timedOut).toBe(false);
        });

        it("handles skipped and neutral conclusions as passing", async () => {
            const { waitForChecksTool } =
                await import("../../packages/mastra/src/tools/verify-tools");

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        check_runs: [
                            {
                                name: "build",
                                status: "completed",
                                conclusion: "success"
                            },
                            {
                                name: "optional",
                                status: "completed",
                                conclusion: "skipped"
                            },
                            {
                                name: "info",
                                status: "completed",
                                conclusion: "neutral"
                            }
                        ]
                    })
            });

            const result = await waitForChecksTool.execute({
                repository: "org/repo",
                ref: "main"
            });

            expect(result.allPassed).toBe(true);
        });

        it("throws on GitHub API error", async () => {
            const { waitForChecksTool } =
                await import("../../packages/mastra/src/tools/verify-tools");

            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                text: () => Promise.resolve("Not found")
            });

            await expect(
                waitForChecksTool.execute({
                    repository: "org/repo",
                    ref: "nonexistent"
                })
            ).rejects.toThrow("GitHub API error 404");
        });

        it("throws when no GitHub token configured", async () => {
            delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

            const { waitForChecksTool } =
                await import("../../packages/mastra/src/tools/verify-tools");

            await expect(
                waitForChecksTool.execute({
                    repository: "org/repo",
                    ref: "main"
                })
            ).rejects.toThrow("No GitHub token found");
        });

        it("parses repo from full URL", async () => {
            const { waitForChecksTool } =
                await import("../../packages/mastra/src/tools/verify-tools");

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        check_runs: [
                            {
                                name: "ci",
                                status: "completed",
                                conclusion: "success"
                            }
                        ]
                    })
            });

            await waitForChecksTool.execute({
                repository: "https://github.com/my-org/my-repo.git",
                ref: "main"
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining("/repos/my-org/my-repo/"),
                expect.any(Object)
            );
        });
    });
});
