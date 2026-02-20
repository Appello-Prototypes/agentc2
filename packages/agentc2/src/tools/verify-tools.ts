/**
 * Verification Tools — Build/test verification for coding pipeline branches
 *
 * Provides tools to:
 * - Run build/lint/type-check against a branch via the sandbox
 * - Poll GitHub Actions check suites until they complete
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const GITHUB_API = "https://api.github.com";
const MAX_CHECK_POLL_MS = 20 * 60_000; // 20 minutes
const CHECK_POLL_INTERVAL_MS = 10_000;

async function resolveGitHubToken(organizationId?: string): Promise<string> {
    if (organizationId) {
        try {
            const { prisma } = await import("@repo/database");
            const { decryptJson } = await import("../crypto/encryption");

            const connection = await prisma.integrationConnection.findFirst({
                where: {
                    isActive: true,
                    provider: { key: "github" },
                    organizationId
                },
                include: { provider: true },
                orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
            });

            if (connection?.credentials) {
                const decrypted = decryptJson(connection.credentials);
                const token =
                    (decrypted?.GITHUB_PERSONAL_ACCESS_TOKEN as string) ||
                    (decrypted?.token as string);
                if (token) return token;
            }
        } catch (err) {
            console.warn("[VerifyTools] Failed to resolve org credentials:", err);
        }
    }

    const envToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    if (envToken) return envToken;

    throw new Error(
        "No GitHub token found. Configure a GitHub integration or set GITHUB_PERSONAL_ACCESS_TOKEN."
    );
}

function parseRepoOwnerName(repository: string): {
    owner: string;
    repo: string;
} {
    const cleaned = repository
        .replace(/^https?:\/\/github\.com\//, "")
        .replace(/\.git$/, "")
        .replace(/\/$/, "");

    const parts = cleaned.split("/");
    if (parts.length < 2) {
        throw new Error(
            `Invalid repository format: "${repository}". Expected "owner/repo" or full GitHub URL.`
        );
    }
    return { owner: parts[0], repo: parts[1] };
}

// ─── verify-branch ───────────────────────────────────────────────────────────

export const verifyBranchTool = createTool({
    id: "verify-branch",
    description:
        "Verify a branch by cloning the repo and running build commands in the sandbox. " +
        "Runs type-check, lint, and build by default. Returns pass/fail with error details. " +
        "For the AgentC2 monorepo, runs: bun run type-check && bun run lint && bun run build.",
    inputSchema: z.object({
        repository: z.string().describe("GitHub repository URL or owner/repo"),
        branch: z.string().describe("Branch name to verify"),
        commands: z
            .array(z.string())
            .optional()
            .describe(
                "Custom verification commands. Defaults to ['bun run type-check', 'bun run lint', 'bun run build']"
            ),
        organizationId: z.string().optional().describe("Organization ID for credential resolution")
    }),
    outputSchema: z.object({
        passed: z.boolean(),
        results: z.array(
            z.object({
                command: z.string(),
                exitCode: z.number(),
                stdout: z.string(),
                stderr: z.string(),
                durationMs: z.number()
            })
        ),
        totalDurationMs: z.number()
    }),
    execute: async ({ repository, branch, commands, organizationId }) => {
        const { getToolByName } = await import("./registry");

        const ghToken = await resolveGitHubToken(organizationId).catch(() => "");
        const { owner, repo } = parseRepoOwnerName(repository);

        const cloneUrl = ghToken
            ? `https://x-access-token:${ghToken}@github.com/${owner}/${repo}.git`
            : `https://github.com/${owner}/${repo}.git`;

        const verifyCommands = commands || ["bun run type-check", "bun run lint", "bun run build"];

        const sandboxTool = getToolByName("execute-code");
        if (!sandboxTool?.execute) {
            throw new Error("execute-code tool not found in registry");
        }

        type SandboxResult = {
            exitCode: number;
            stdout: string;
            stderr: string;
            durationMs: number;
        };

        const execSandbox = async (
            code: string,
            networkAccess: boolean
        ): Promise<SandboxResult> => {
            const res = await (sandboxTool.execute as Function)(
                {
                    language: "bash",
                    code,
                    timeout: 120,
                    agentId: `verify-${owner}-${repo}`,
                    networkAccess
                },
                {}
            );
            return res as SandboxResult;
        };

        const cloneScript = [
            `cd /workspace`,
            `rm -rf repo`,
            `git clone --depth 1 --branch ${branch} "${cloneUrl}" repo`,
            `cd repo`,
            `bun install --frozen-lockfile 2>/dev/null || bun install`
        ].join(" && ");

        const startTime = Date.now();

        const cloneResult = await execSandbox(cloneScript, true);

        if (cloneResult.exitCode !== 0) {
            return {
                passed: false,
                results: [
                    {
                        command: "git clone && bun install",
                        exitCode: cloneResult.exitCode,
                        stdout: cloneResult.stdout,
                        stderr: cloneResult.stderr,
                        durationMs: cloneResult.durationMs
                    }
                ],
                totalDurationMs: Date.now() - startTime
            };
        }

        type CommandResult = SandboxResult & { command: string };
        const results: CommandResult[] = [];
        let allPassed = true;

        for (const cmd of verifyCommands) {
            const result = await execSandbox(`cd /workspace/repo && ${cmd}`, false);

            results.push({
                command: cmd,
                exitCode: result.exitCode,
                stdout: result.stdout,
                stderr: result.stderr,
                durationMs: result.durationMs
            });

            if (result.exitCode !== 0) {
                allPassed = false;
                break;
            }
        }

        return {
            passed: allPassed,
            results,
            totalDurationMs: Date.now() - startTime
        };
    }
});

// ─── wait-for-checks ─────────────────────────────────────────────────────────

export const waitForChecksTool = createTool({
    id: "wait-for-checks",
    description:
        "Poll GitHub Actions check suites for a branch or PR until all checks complete. " +
        "Returns when all checks pass or any check fails. Uses exponential backoff.",
    inputSchema: z.object({
        repository: z.string().describe("GitHub repository URL or owner/repo"),
        ref: z.string().describe("Branch name, tag, or commit SHA to check"),
        maxWaitMinutes: z.number().optional().describe("Maximum minutes to wait (default: 20)"),
        organizationId: z.string().optional().describe("Organization ID for credential resolution")
    }),
    outputSchema: z.object({
        allPassed: z.boolean(),
        timedOut: z.boolean(),
        checks: z.array(
            z.object({
                name: z.string(),
                status: z.string(),
                conclusion: z.string().nullable()
            })
        ),
        durationMs: z.number()
    }),
    execute: async ({ repository, ref, maxWaitMinutes, organizationId }) => {
        const token = await resolveGitHubToken(organizationId);
        const { owner, repo } = parseRepoOwnerName(repository);

        const maxDuration = Math.min((maxWaitMinutes || 20) * 60_000, MAX_CHECK_POLL_MS);
        const startTime = Date.now();
        let interval = CHECK_POLL_INTERVAL_MS;

        while (Date.now() - startTime < maxDuration) {
            const response = await fetch(
                `${GITHUB_API}/repos/${owner}/${repo}/commits/${ref}/check-runs`,
                {
                    headers: {
                        Authorization: `token ${token}`,
                        Accept: "application/vnd.github+json"
                    }
                }
            );

            if (!response.ok) {
                const body = await response.text().catch(() => "");
                throw new Error(`GitHub API error ${response.status}: ${body}`);
            }

            const data = await response.json();
            const checkRuns: Array<{
                name: string;
                status: string;
                conclusion: string | null;
            }> = (data.check_runs || []).map(
                (cr: { name?: string; status?: string; conclusion?: string | null }) => ({
                    name: cr.name || "",
                    status: cr.status || "queued",
                    conclusion: cr.conclusion || null
                })
            );

            if (checkRuns.length === 0) {
                await new Promise((resolve) => setTimeout(resolve, interval));
                interval = Math.min(interval * 1.5, 30_000);
                continue;
            }

            const allCompleted = checkRuns.every((cr) => cr.status === "completed");

            if (allCompleted) {
                const allPassed = checkRuns.every(
                    (cr) =>
                        cr.conclusion === "success" ||
                        cr.conclusion === "skipped" ||
                        cr.conclusion === "neutral"
                );

                return {
                    allPassed,
                    timedOut: false,
                    checks: checkRuns,
                    durationMs: Date.now() - startTime
                };
            }

            const anyFailed = checkRuns.some(
                (cr) => cr.status === "completed" && cr.conclusion === "failure"
            );

            if (anyFailed) {
                return {
                    allPassed: false,
                    timedOut: false,
                    checks: checkRuns,
                    durationMs: Date.now() - startTime
                };
            }

            await new Promise((resolve) => setTimeout(resolve, interval));
            interval = Math.min(interval * 1.5, 30_000);
        }

        return {
            allPassed: false,
            timedOut: true,
            checks: [],
            durationMs: Date.now() - startTime
        };
    }
});
