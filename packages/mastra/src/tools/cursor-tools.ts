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

const CURSOR_API_BASE = "https://api.cursor.com/v1";
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
    const response = await fetch(url, {
        ...options,
        headers: {
            Authorization: `Bearer ${apiKey}`,
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
        "writes code, and pushes a branch. Returns the agent ID and branch name for tracking.",
    inputSchema: z.object({
        repository: z
            .string()
            .describe("GitHub repository URL (e.g., 'https://github.com/org/repo')"),
        prompt: z.string().describe("Detailed implementation instructions for the coding agent"),
        ref: z.string().optional().describe("Base branch or ref to work from (default: 'main')"),
        organizationId: z.string().optional().describe("Organization ID for credential resolution")
    }),
    outputSchema: z.object({
        agentId: z.string(),
        name: z.string(),
        status: z.string(),
        branchName: z.string().nullable(),
        agentUrl: z.string().nullable()
    }),
    execute: async ({ repository, prompt, ref, organizationId }) => {
        const apiKey = await resolveCursorApiKey(organizationId);

        const response = await cursorFetch("/background-agents", apiKey, {
            method: "POST",
            body: JSON.stringify({
                prompt: { text: prompt },
                source: {
                    repository,
                    ref: ref || "main"
                }
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
        "Statuses: CREATING, RUNNING, COMPLETED, FAILED. " +
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

        const response = await cursorFetch(`/background-agents/${agentId}`, apiKey);
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

        await cursorFetch(`/background-agents/${agentId}/followup`, apiKey, {
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

        const response = await cursorFetch(`/background-agents/${agentId}/conversation`, apiKey);
        const data = await response.json();

        const messages = Array.isArray(data.messages)
            ? data.messages.map((m: { role?: string; content?: string; timestamp?: string }) => ({
                  role: m.role || "unknown",
                  content: m.content || "",
                  timestamp: m.timestamp || null
              }))
            : [];

        return { agentId, messages };
    }
});

// ─── cursor-poll-until-done ──────────────────────────────────────────────────

export const cursorPollUntilDoneTool = createTool({
    id: "cursor-poll-until-done",
    description:
        "Poll a Cursor Cloud Agent until it reaches a terminal state (COMPLETED or FAILED). " +
        "Implements exponential backoff. Returns the final status and branch name.",
    inputSchema: z.object({
        agentId: z.string().describe("The Cursor Cloud Agent ID"),
        maxWaitMinutes: z.number().optional().describe("Maximum minutes to wait (default: 30)"),
        organizationId: z.string().optional().describe("Organization ID for credential resolution")
    }),
    outputSchema: z.object({
        agentId: z.string(),
        status: z.string(),
        summary: z.string().nullable(),
        branchName: z.string().nullable(),
        durationMs: z.number(),
        timedOut: z.boolean()
    }),
    execute: async ({ agentId, maxWaitMinutes, organizationId }) => {
        const apiKey = await resolveCursorApiKey(organizationId);
        const maxDuration = Math.min((maxWaitMinutes || 30) * 60_000, MAX_POLL_DURATION_MS);
        const startTime = Date.now();
        let interval = DEFAULT_POLL_INTERVAL_MS;

        const terminalStatuses = new Set(["COMPLETED", "FAILED", "CANCELLED", "ERROR"]);

        while (Date.now() - startTime < maxDuration) {
            const response = await cursorFetch(`/background-agents/${agentId}`, apiKey);
            const data = await response.json();
            const status = data.status || "UNKNOWN";

            if (terminalStatuses.has(status)) {
                return {
                    agentId,
                    status,
                    summary: data.summary || null,
                    branchName: data.target?.branchName || null,
                    durationMs: Date.now() - startTime,
                    timedOut: false
                };
            }

            await new Promise((resolve) => setTimeout(resolve, interval));
            interval = Math.min(interval * 1.5, 30_000);
        }

        return {
            agentId,
            status: "TIMEOUT",
            summary: null,
            branchName: null,
            durationMs: Date.now() - startTime,
            timedOut: true
        };
    }
});
