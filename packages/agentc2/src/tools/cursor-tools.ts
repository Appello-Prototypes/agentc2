/**
 * Cursor Cloud Agent Tools
 *
 * Wraps the Cursor Background Agent API to enable programmatic dispatch
 * of coding tasks to Cursor Cloud Agents. Agents can:
 * - Launch a cloud coding agent on a GitHub repository
 * - Monitor agent status and progress
 * - Send follow-up instructions to refine work
 * - Retrieve conversation history for audit trail
 *
 * Credentials are resolved from IntegrationConnection (org-scoped) or
 * fall back to CURSOR_API_KEY environment variable.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const CURSOR_API_BASE = "https://api.cursor.com/v0";
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const MAX_POLL_DURATION_MS = 30 * 60_000; // 30 minutes

async function resolveCursorApiKey(organizationId?: string): Promise<string> {
    if (organizationId) {
        try {
            const { prisma } = await import("@repo/database");
            const { decryptJson } = await import("../crypto/encryption");

            const connection = await prisma.integrationConnection.findFirst({
                where: {
                    isActive: true,
                    provider: { key: "cursor" },
                    organizationId
                },
                include: { provider: true },
                orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
            });

            if (connection?.credentials) {
                const decrypted = decryptJson(connection.credentials);
                const key = (decrypted?.CURSOR_API_KEY as string) || (decrypted?.apiKey as string);
                if (key) return key;
            }
        } catch (err) {
            console.warn("[CursorTools] Failed to resolve org credentials:", err);
        }
    }

    const envKey = process.env.CURSOR_API_KEY;
    if (envKey) return envKey;

    throw new Error(
        "No Cursor API key found. Configure a Cursor integration connection or set CURSOR_API_KEY."
    );
}

async function cursorFetch(
    path: string,
    apiKey: string,
    options: RequestInit = {}
): Promise<Response> {
    const url = `${CURSOR_API_BASE}${path}`;
    const basicAuth = Buffer.from(`${apiKey}:`).toString("base64");
    const response = await fetch(url, {
        ...options,
        signal: options.signal ?? AbortSignal.timeout(30_000),
        headers: {
            Authorization: `Basic ${basicAuth}`,
            "Content-Type": "application/json",
            ...options.headers
        }
    });

    if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Cursor API error ${response.status}: ${response.statusText}. ${body}`);
    }

    return response;
}

// ─── cursor-launch-agent ─────────────────────────────────────────────────────

export const cursorLaunchAgentTool = createTool({
    id: "cursor-launch-agent",
    description:
        "Launch a Cursor Cloud Agent to implement code changes on a GitHub repository. " +
        "Provide a detailed prompt describing what to build or fix. The agent clones the repo, " +
        "writes code, and pushes a branch. Set autoCreatePr to have Cursor automatically " +
        "open a pull request when the agent finishes.",
    inputSchema: z.object({
        repository: z
            .string()
            .describe("GitHub repository URL (e.g., 'https://github.com/org/repo')"),
        prompt: z.string().describe("Detailed implementation instructions for the coding agent"),
        ref: z.string().optional().describe("Base branch or ref to work from (default: 'main')"),
        autoCreatePr: z
            .boolean()
            .optional()
            .describe(
                "Automatically create a PR when the agent finishes. " +
                    "The PR URL will be available on the agent response at target.prUrl."
            ),
        openAsCursorGithubApp: z
            .boolean()
            .optional()
            .describe(
                "Open the PR as the Cursor GitHub App instead of as the user. " +
                    "Only applies when autoCreatePr is true."
            ),
        organizationId: z.string().optional().describe("Organization ID for credential resolution")
    }),
    outputSchema: z.object({
        agentId: z.string(),
        name: z.string(),
        status: z.string(),
        branchName: z.string().nullable(),
        agentUrl: z.string().nullable()
    }),
    execute: async ({
        repository,
        prompt,
        ref,
        autoCreatePr,
        openAsCursorGithubApp,
        organizationId
    }) => {
        const apiKey = await resolveCursorApiKey(organizationId);

        const target: Record<string, unknown> = {};
        if (autoCreatePr) target.autoCreatePr = true;
        if (openAsCursorGithubApp) target.openAsCursorGithubApp = true;

        const response = await cursorFetch("/agents", apiKey, {
            method: "POST",
            body: JSON.stringify({
                prompt: { text: prompt },
                source: {
                    repository,
                    ref: ref || "main"
                },
                ...(Object.keys(target).length > 0 ? { target } : {})
            })
        });

        const data = await response.json();

        return {
            agentId: data.id || data.agentId,
            name: data.name || "",
            status: data.status || "CREATING",
            branchName: data.target?.branchName || null,
            agentUrl: data.target?.url || null
        };
    }
});

// ─── cursor-get-status ───────────────────────────────────────────────────────

export const cursorGetStatusTool = createTool({
    id: "cursor-get-status",
    description:
        "Get the current status of a Cursor Cloud Agent. " +
        "Statuses: CREATING, RUNNING, FINISHED, FAILED. " +
        "Use this to poll until the agent finishes its coding task.",
    inputSchema: z.object({
        agentId: z.string().describe("The Cursor Cloud Agent ID"),
        organizationId: z.string().optional().describe("Organization ID for credential resolution")
    }),
    outputSchema: z.object({
        agentId: z.string(),
        status: z.string(),
        name: z.string(),
        summary: z.string().nullable(),
        branchName: z.string().nullable(),
        agentUrl: z.string().nullable()
    }),
    execute: async ({ agentId, organizationId }) => {
        const apiKey = await resolveCursorApiKey(organizationId);

        const response = await cursorFetch(`/agents/${agentId}`, apiKey);
        const data = await response.json();

        return {
            agentId: data.id || agentId,
            status: data.status || "UNKNOWN",
            name: data.name || "",
            summary: data.summary || null,
            branchName: data.target?.branchName || null,
            agentUrl: data.target?.url || null
        };
    }
});

// ─── cursor-add-followup ─────────────────────────────────────────────────────

export const cursorAddFollowupTool = createTool({
    id: "cursor-add-followup",
    description:
        "Send follow-up instructions to a running Cursor Cloud Agent. " +
        "Use this to refine the agent's work, provide error context from " +
        "failed builds, or request additional changes.",
    inputSchema: z.object({
        agentId: z.string().describe("The Cursor Cloud Agent ID"),
        prompt: z.string().describe("Follow-up instructions or error context"),
        organizationId: z.string().optional().describe("Organization ID for credential resolution")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        agentId: z.string()
    }),
    execute: async ({ agentId, prompt, organizationId }) => {
        const apiKey = await resolveCursorApiKey(organizationId);

        await cursorFetch(`/agents/${agentId}/followup`, apiKey, {
            method: "POST",
            body: JSON.stringify({
                prompt: { text: prompt }
            })
        });

        return { success: true, agentId };
    }
});

// ─── cursor-get-conversation ─────────────────────────────────────────────────

export const cursorGetConversationTool = createTool({
    id: "cursor-get-conversation",
    description:
        "Retrieve the conversation history of a Cursor Cloud Agent. " +
        "Returns the full interaction log for audit trail and debugging.",
    inputSchema: z.object({
        agentId: z.string().describe("The Cursor Cloud Agent ID"),
        organizationId: z.string().optional().describe("Organization ID for credential resolution")
    }),
    outputSchema: z.object({
        agentId: z.string(),
        messages: z.array(
            z.object({
                role: z.string(),
                content: z.string(),
                timestamp: z.string().nullable()
            })
        )
    }),
    execute: async ({ agentId, organizationId }) => {
        const apiKey = await resolveCursorApiKey(organizationId);

        const response = await cursorFetch(`/agents/${agentId}/conversation`, apiKey);
        const data = await response.json();

        const messages = Array.isArray(data.messages)
            ? data.messages.map(
                  (m: { type?: string; text?: string; role?: string; content?: string }) => ({
                      role: m.type || m.role || "unknown",
                      content: m.text || m.content || "",
                      timestamp: null
                  })
              )
            : [];

        return { agentId, messages };
    }
});

// ─── cursor-poll-until-done ──────────────────────────────────────────────────

async function detectPrFromBranch(
    repository: string,
    branchName: string,
    organizationId?: string
): Promise<{ prNumber: number; prUrl: string } | null> {
    try {
        const { resolveGitHubToken, parseRepoOwnerName, githubFetch } =
            await import("./github-helpers");
        const token = await resolveGitHubToken(organizationId);
        const { owner, repo } = parseRepoOwnerName(repository);

        const res = await githubFetch(
            `/repos/${owner}/${repo}/pulls?head=${owner}:${branchName}&state=open`,
            token
        );
        const pulls = await res.json();

        if (Array.isArray(pulls) && pulls.length > 0) {
            return {
                prNumber: pulls[0].number as number,
                prUrl: (pulls[0].html_url as string) || ""
            };
        }
    } catch (err) {
        console.warn("[CursorTools] PR detection failed:", err);
    }
    return null;
}

export const cursorPollUntilDoneTool = createTool({
    id: "cursor-poll-until-done",
    description:
        "Poll a Cursor Cloud Agent until it reaches a terminal state (FINISHED or FAILED). " +
        "Implements exponential backoff. Returns the final status, branch name, and PR number.",
    inputSchema: z.object({
        agentId: z.string().describe("The Cursor Cloud Agent ID"),
        maxWaitMinutes: z.number().optional().describe("Maximum minutes to wait (default: 30)"),
        repository: z.string().optional().describe("GitHub repository URL for PR detection"),
        organizationId: z.string().optional().describe("Organization ID for credential resolution")
    }),
    outputSchema: z.object({
        agentId: z.string(),
        status: z.string(),
        summary: z.string().nullable(),
        branchName: z.string().nullable(),
        prNumber: z.number().nullable(),
        prUrl: z.string().nullable(),
        repository: z.string().nullable(),
        durationMs: z.number(),
        timedOut: z.boolean()
    }),
    execute: async ({ agentId, maxWaitMinutes, repository, organizationId }) => {
        const apiKey = await resolveCursorApiKey(organizationId);
        const maxDuration = Math.min((maxWaitMinutes || 30) * 60_000, MAX_POLL_DURATION_MS);
        const startTime = Date.now();
        let interval = DEFAULT_POLL_INTERVAL_MS;

        const terminalStatuses = new Set(["FINISHED", "COMPLETED", "FAILED", "CANCELLED", "ERROR"]);

        const loopAbort = new AbortController();
        const loopTimer = setTimeout(() => loopAbort.abort(), maxDuration);

        try {
            while (Date.now() - startTime < maxDuration) {
                const response = await cursorFetch(`/agents/${agentId}`, apiKey, {
                    signal: loopAbort.signal
                });
                const data = await response.json();
                const status = data.status || "UNKNOWN";

                if (terminalStatuses.has(status)) {
                    let summary = data.summary || null;

                    if (!summary) {
                        try {
                            const convResp = await cursorFetch(
                                `/agents/${agentId}/conversation`,
                                apiKey
                            );
                            const convData = await convResp.json();
                            const assistantMessages = (convData.messages || [])
                                .filter((m: { type?: string }) => m.type === "assistant_message")
                                .map((m: { text?: string }) => m.text || "");

                            if (assistantMessages.length > 0) {
                                summary = assistantMessages[assistantMessages.length - 1];
                            }
                        } catch {
                            // Conversation fetch failed; leave summary null
                        }
                    }

                    const branchName = data.target?.branchName || null;
                    let prNumber: number | null = null;
                    let prUrl: string | null = data.target?.prUrl || null;

                    if (prUrl) {
                        const match = prUrl.match(/\/pull\/(\d+)/);
                        if (match) prNumber = Number(match[1]);
                    }

                    if (!prNumber && branchName && repository) {
                        const detected = await detectPrFromBranch(
                            repository,
                            branchName,
                            organizationId
                        );
                        if (detected) {
                            prNumber = detected.prNumber;
                            prUrl = detected.prUrl;
                        }
                    }

                    return {
                        agentId,
                        status,
                        summary,
                        branchName,
                        prNumber,
                        prUrl,
                        repository: repository || null,
                        durationMs: Date.now() - startTime,
                        timedOut: false
                    };
                }

                await new Promise((resolve) => setTimeout(resolve, interval));
                interval = Math.min(interval * 1.5, 30_000);
            }
        } catch (err) {
            if (loopAbort.signal.aborted) {
                // Preemptive timeout fired -- fall through to TIMEOUT return
            } else {
                throw err;
            }
        } finally {
            clearTimeout(loopTimer);
        }

        return {
            agentId,
            status: "TIMEOUT",
            summary: null,
            branchName: null,
            prNumber: null,
            prUrl: null,
            repository: repository || null,
            durationMs: Date.now() - startTime,
            timedOut: true
        };
    }
});
