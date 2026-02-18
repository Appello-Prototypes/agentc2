/**
 * Merge & Deploy Tools (Dark Factory Phase 2)
 *
 * - merge-pull-request: Merges a PR via GitHub REST API (per-org auth)
 * - await-deploy: Polls a GitHub Actions deployment workflow until complete
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const GITHUB_API = "https://api.github.com";
const DEPLOY_POLL_MAX_MS = 30 * 60_000; // 30 minutes
const DEPLOY_POLL_INTERVAL_MS = 15_000;

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
            console.warn("[MergeDeployTools] Failed to resolve org credentials:", err);
        }
    }

    const envToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    if (envToken) return envToken;

    throw new Error(
        "No GitHub token found. Configure a GitHub integration or set GITHUB_PERSONAL_ACCESS_TOKEN."
    );
}

function parseRepoOwnerName(repository: string): { owner: string; repo: string } {
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

// ─── merge-pull-request ──────────────────────────────────────────────────────

export const mergePullRequestTool = createTool({
    id: "merge-pull-request",
    description:
        "Merge a pull request via the GitHub REST API. Supports squash, merge, " +
        "and rebase strategies. Uses per-org GitHub credentials when available.",
    inputSchema: z.object({
        repository: z.string().describe("GitHub repository URL or owner/repo"),
        prNumber: z.number().describe("Pull request number to merge"),
        mergeMethod: z
            .enum(["squash", "merge", "rebase"])
            .optional()
            .describe("Merge strategy (default: squash)"),
        commitTitle: z.string().optional().describe("Custom merge commit title"),
        commitMessage: z.string().optional().describe("Custom merge commit body"),
        organizationId: z.string().optional()
    }),
    outputSchema: z.object({
        success: z.boolean(),
        sha: z.string().nullable(),
        message: z.string()
    }),
    execute: async ({
        repository,
        prNumber,
        mergeMethod,
        commitTitle,
        commitMessage,
        organizationId
    }) => {
        const token = await resolveGitHubToken(organizationId);
        const { owner, repo } = parseRepoOwnerName(repository);

        const mergeBody: Record<string, unknown> = {
            merge_method: mergeMethod || "squash"
        };
        if (commitTitle) mergeBody.commit_title = commitTitle;
        if (commitMessage) mergeBody.commit_message = commitMessage;

        const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}/merge`, {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(mergeBody)
        });

        const data = (await res.json()) as Record<string, unknown>;

        if (!res.ok) {
            return {
                success: false,
                sha: null,
                message: `Merge failed (${res.status}): ${(data.message as string) || "Unknown error"}`
            };
        }

        return {
            success: true,
            sha: (data.sha as string) || null,
            message: (data.message as string) || "Pull request merged successfully"
        };
    }
});

// ─── await-deploy ────────────────────────────────────────────────────────────

export const awaitDeployTool = createTool({
    id: "await-deploy",
    description:
        "Poll a GitHub Actions deployment workflow until it completes. " +
        "Watches for workflow runs triggered on the target branch (typically main) " +
        "after a merge. Returns the final status.",
    inputSchema: z.object({
        repository: z.string().describe("GitHub repository URL or owner/repo"),
        branch: z.string().optional().describe("Branch to watch for deployment (default: main)"),
        workflowFileName: z
            .string()
            .optional()
            .describe(
                "Workflow file name to watch (e.g., 'deploy-do.yml'). If not specified, watches all runs."
            ),
        afterTimestamp: z
            .string()
            .optional()
            .describe("Only consider runs created after this ISO timestamp. Defaults to now."),
        maxWaitMinutes: z.number().optional().describe("Maximum wait time (default: 30)"),
        organizationId: z.string().optional()
    }),
    outputSchema: z.object({
        success: z.boolean(),
        status: z.string(),
        runId: z.number().nullable(),
        runUrl: z.string().nullable(),
        message: z.string()
    }),
    execute: async ({
        repository,
        branch,
        workflowFileName,
        afterTimestamp,
        maxWaitMinutes,
        organizationId
    }) => {
        const token = await resolveGitHubToken(organizationId);
        const { owner, repo } = parseRepoOwnerName(repository);
        const targetBranch = branch || "main";
        const maxMs = (maxWaitMinutes || 30) * 60_000;
        const startedAfter = afterTimestamp || new Date().toISOString();

        const startTime = Date.now();

        while (Date.now() - startTime < maxMs) {
            let url = `${GITHUB_API}/repos/${owner}/${repo}/actions/runs?branch=${targetBranch}&per_page=5`;

            if (workflowFileName) {
                const workflowsRes = await fetch(
                    `${GITHUB_API}/repos/${owner}/${repo}/actions/workflows`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            Accept: "application/vnd.github+json"
                        }
                    }
                );
                const workflowsData = (await workflowsRes.json()) as {
                    workflows?: Array<{ id: number; path: string }>;
                };
                const workflow = workflowsData.workflows?.find((w) =>
                    w.path.endsWith(workflowFileName)
                );
                if (workflow) {
                    url = `${GITHUB_API}/repos/${owner}/${repo}/actions/workflows/${workflow.id}/runs?branch=${targetBranch}&per_page=5`;
                }
            }

            const res = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/vnd.github+json"
                }
            });

            if (res.ok) {
                const data = (await res.json()) as {
                    workflow_runs?: Array<{
                        id: number;
                        status: string;
                        conclusion: string | null;
                        created_at: string;
                        html_url: string;
                    }>;
                };

                const recentRuns = (data.workflow_runs || []).filter(
                    (r) => new Date(r.created_at) >= new Date(startedAfter)
                );

                if (recentRuns.length > 0) {
                    const latest = recentRuns[0];

                    if (latest.status === "completed") {
                        return {
                            success: latest.conclusion === "success",
                            status: latest.conclusion || "unknown",
                            runId: latest.id,
                            runUrl: latest.html_url,
                            message:
                                latest.conclusion === "success"
                                    ? "Deployment completed successfully"
                                    : `Deployment finished with conclusion: ${latest.conclusion}`
                        };
                    }
                }
            }

            await new Promise((resolve) => setTimeout(resolve, DEPLOY_POLL_INTERVAL_MS));
        }

        return {
            success: false,
            status: "timeout",
            runId: null,
            runUrl: null,
            message: `Deployment did not complete within ${maxWaitMinutes || 30} minutes`
        };
    }
});
