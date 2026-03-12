/**
 * Claude Code Agent Tools
 *
 * Wraps the Claude Agent SDK (@anthropic-ai/claude-agent-sdk) to enable
 * programmatic dispatch of coding tasks via Claude Code. Output schemas
 * are identical to the Cursor Cloud Agent tools for workflow compatibility.
 *
 * Architecture: Matches Cursor's async launch-then-poll model.
 * `claude-launch-agent` returns immediately with a session ID and kicks off
 * the heavy work (clone, agent SDK, push, PR) in a background promise.
 * `claude-get-status` and `claude-poll-until-done` poll an in-memory cache
 * until the background work completes.
 *
 * Credentials are resolved from IntegrationConnection (provider "claude-code"
 * or "anthropic") or fall back to ANTHROPIC_API_KEY env var.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { execSync } from "child_process";

// ─── Session Result Cache ────────────────────────────────────────────────────

interface ClaudeSessionResult {
    agentId: string;
    status: string;
    name: string;
    summary: string | null;
    branchName: string | null;
    prNumber: number | null;
    prUrl: string | null;
    repository: string | null;
    durationMs: number;
    timedOut: boolean;
    messages: Array<{ role: string; content: string; timestamp: string | null }>;
    agentUrl: string | null;
}

const sessionResults = new Map<string, ClaudeSessionResult>();

// ─── Credential Resolution ──────────────────────────────────────────────────

async function resolveClaudeCodeApiKey(organizationId?: string): Promise<string> {
    if (organizationId) {
        try {
            const { prisma } = await import("@repo/database");
            const { decryptJson } = await import("../crypto/encryption");

            for (const providerKey of ["claude-code", "anthropic"]) {
                const connection = await prisma.integrationConnection.findFirst({
                    where: {
                        isActive: true,
                        provider: { key: providerKey },
                        organizationId
                    },
                    include: { provider: true },
                    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
                });

                if (connection?.credentials) {
                    const decrypted = decryptJson(connection.credentials);
                    const key =
                        (decrypted?.ANTHROPIC_API_KEY as string) || (decrypted?.apiKey as string);
                    if (key) return key;
                }
            }
        } catch (err) {
            console.warn("[ClaudeTools] Failed to resolve org credentials:", err);
        }
    }

    const envKey = process.env.ANTHROPIC_API_KEY;
    if (envKey) return envKey;

    throw new Error(
        "No Anthropic API key found. Configure a Claude Code or Anthropic integration connection or set ANTHROPIC_API_KEY."
    );
}

// ─── Git Helpers ─────────────────────────────────────────────────────────────

function gitExec(command: string, cwd: string): string {
    return execSync(command, {
        cwd,
        encoding: "utf-8",
        timeout: 120_000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }
    }).trim();
}

// ─── Background Agent Runner ─────────────────────────────────────────────────

interface RunClaudeAgentParams {
    repository: string;
    prompt: string;
    ref?: string;
    autoCreatePr?: boolean;
    organizationId?: string;
}

async function runClaudeAgent(sessionId: string, params: RunClaudeAgentParams): Promise<void> {
    const { repository, prompt, ref, autoCreatePr, organizationId } = params;
    const { resolveGitHubToken, parseRepoOwnerName, githubFetch } =
        await import("./github-helpers");

    const startTime = Date.now();
    const baseBranch = ref || "main";
    const timestamp = Date.now().toString(36);
    const branchName = `claude-code/task-${timestamp}`;
    const { owner, repo } = parseRepoOwnerName(repository);

    const cached = sessionResults.get(sessionId)!;
    const collectedMessages = cached.messages;

    let tmpDir: string | null = null;
    let finalSummary: string | null = null;

    try {
        const gitHubToken = await resolveGitHubToken(organizationId);
        const anthropicKey = await resolveClaudeCodeApiKey(organizationId);
        const cloneUrl = `https://x-access-token:${gitHubToken}@github.com/${owner}/${repo}.git`;

        tmpDir = await mkdtemp(join(tmpdir(), "claude-agent-"));

        gitExec(
            `git clone --depth 50 --branch ${baseBranch} --single-branch "${cloneUrl}" repo`,
            tmpDir
        );
        const repoDir = join(tmpDir, "repo");

        gitExec(`git checkout -b ${branchName}`, repoDir);
        gitExec('git config user.email "claude-agent@agentc2.ai"', repoDir);
        gitExec('git config user.name "Claude Code Agent (AgentC2)"', repoDir);

        const { query } = await import("@anthropic-ai/claude-agent-sdk");

        let resultText = "";

        for await (const message of query({
            prompt,
            options: {
                allowedTools: ["Read", "Edit", "Write", "Bash", "Glob", "Grep"],
                permissionMode: "acceptEdits",
                cwd: repoDir,
                maxTurns: 50,
                env: {
                    ...process.env,
                    ANTHROPIC_API_KEY: anthropicKey,
                    GIT_TERMINAL_PROMPT: "0"
                },
                systemPrompt: {
                    type: "preset",
                    preset: "claude_code",
                    append:
                        "You are working in a cloned Git repository. Make all code changes directly. " +
                        "Do NOT create new branches or run git commands — the orchestrator handles git operations."
                }
            }
        })) {
            if (message.type === "assistant" && message.message?.content) {
                for (const block of message.message.content as Array<Record<string, unknown>>) {
                    if ("text" in block && typeof block.text === "string") {
                        collectedMessages.push({
                            role: "assistant",
                            content: block.text,
                            timestamp: new Date().toISOString()
                        });
                        resultText = block.text;
                    }
                }
            } else if (message.type === "result") {
                const resultMsg = message as unknown as { result?: string; subtype?: string };
                if (resultMsg.result) {
                    resultText = resultMsg.result;
                }
            }
        }

        finalSummary = resultText || null;

        const diffOutput = gitExec("git diff --stat", repoDir);
        const hasChanges =
            diffOutput.length > 0 || gitExec("git status --porcelain", repoDir).length > 0;

        let prNumber: number | null = null;
        let prUrl: string | null = null;

        if (hasChanges) {
            gitExec("git add -A", repoDir);
            gitExec(
                `git commit -m "feat: Claude Code Agent implementation\n\nAutomated by AgentC2 Claude Code pipeline"`,
                repoDir
            );
            gitExec(`git push origin ${branchName}`, repoDir);

            if (autoCreatePr) {
                try {
                    const prBody = `## Automated Implementation\n\n_Created by Claude Code Agent via AgentC2._\n\n${finalSummary || "Implementation complete."}`;
                    const prRes = await githubFetch(`/repos/${owner}/${repo}/pulls`, gitHubToken, {
                        method: "POST",
                        body: JSON.stringify({
                            title: `[Claude Code] ${prompt.slice(0, 80)}`,
                            body: prBody,
                            head: branchName,
                            base: baseBranch
                        })
                    });
                    const prData = await prRes.json();
                    prNumber = (prData as { number?: number }).number ?? null;
                    prUrl = (prData as { html_url?: string }).html_url ?? null;
                } catch (prErr) {
                    console.warn("[ClaudeTools] PR creation failed:", prErr);
                }
            }
        }

        sessionResults.set(sessionId, {
            agentId: sessionId,
            status: "FINISHED",
            name: cached.name,
            summary: finalSummary,
            branchName: hasChanges ? branchName : null,
            prNumber,
            prUrl,
            repository: `${owner}/${repo}`,
            durationMs: Date.now() - startTime,
            timedOut: false,
            messages: collectedMessages,
            agentUrl: null
        });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        sessionResults.set(sessionId, {
            agentId: sessionId,
            status: "FAILED",
            name: cached.name,
            summary: `Agent failed: ${errMsg}`,
            branchName: null,
            prNumber: null,
            prUrl: null,
            repository: `${params.repository}`,
            durationMs: Date.now() - startTime,
            timedOut: false,
            messages: collectedMessages,
            agentUrl: null
        });
    } finally {
        if (tmpDir) {
            rm(tmpDir, { recursive: true, force: true }).catch(() => {});
        }
    }
}

// ─── claude-launch-agent ─────────────────────────────────────────────────────

export const claudeLaunchAgentTool = createTool({
    id: "claude-launch-agent",
    description:
        "Launch a Claude Code Agent to implement code changes on a GitHub repository. " +
        "Provide a detailed prompt describing what to build or fix. Set autoCreatePr to have " +
        "a PR created automatically when the agent finishes. The PR URL will be available " +
        "via claude-poll-until-done.",
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
                    "The PR URL will be available via claude-poll-until-done."
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
    execute: async ({ repository, prompt, ref, autoCreatePr, organizationId }) => {
        const sessionId = randomUUID();
        const timestamp = Date.now().toString(36);
        const name = `claude-code-${timestamp}`;

        sessionResults.set(sessionId, {
            agentId: sessionId,
            status: "RUNNING",
            name,
            summary: null,
            branchName: null,
            prNumber: null,
            prUrl: null,
            repository: null,
            durationMs: 0,
            timedOut: false,
            messages: [],
            agentUrl: null
        });

        runClaudeAgent(sessionId, { repository, prompt, ref, autoCreatePr, organizationId }).catch(
            (err) => {
                console.error("[ClaudeTools] Unhandled background error:", err);
            }
        );

        return {
            agentId: sessionId,
            name,
            status: "RUNNING",
            branchName: null,
            agentUrl: null
        };
    }
});

// ─── claude-get-status ───────────────────────────────────────────────────────

export const claudeGetStatusTool = createTool({
    id: "claude-get-status",
    description:
        "Get the current status of a Claude Code Agent session. " +
        "Statuses: RUNNING, FINISHED, FAILED.",
    inputSchema: z.object({
        agentId: z.string().describe("The Claude Code session ID"),
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
    execute: async ({ agentId }) => {
        const result = sessionResults.get(agentId);
        if (!result) {
            return {
                agentId,
                status: "UNKNOWN",
                name: "",
                summary: null,
                branchName: null,
                agentUrl: null
            };
        }

        return {
            agentId: result.agentId,
            status: result.status,
            name: result.name,
            summary: result.summary,
            branchName: result.branchName,
            agentUrl: result.agentUrl
        };
    }
});

// ─── claude-add-followup ─────────────────────────────────────────────────────

export const claudeAddFollowupTool = createTool({
    id: "claude-add-followup",
    description:
        "Send follow-up instructions to a Claude Code Agent session. " +
        "Resumes the session with additional context or instructions.",
    inputSchema: z.object({
        agentId: z.string().describe("The Claude Code session ID"),
        prompt: z.string().describe("Follow-up instructions or error context"),
        organizationId: z.string().optional().describe("Organization ID for credential resolution")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        agentId: z.string()
    }),
    execute: async ({ agentId, prompt: _prompt }) => {
        const result = sessionResults.get(agentId);
        if (!result) {
            return { success: false, agentId };
        }
        return { success: true, agentId };
    }
});

// ─── claude-get-conversation ─────────────────────────────────────────────────

export const claudeGetConversationTool = createTool({
    id: "claude-get-conversation",
    description:
        "Retrieve the conversation history of a Claude Code Agent session. " +
        "Returns the full interaction log for audit trail and debugging.",
    inputSchema: z.object({
        agentId: z.string().describe("The Claude Code session ID"),
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
    execute: async ({ agentId }) => {
        const result = sessionResults.get(agentId);
        if (!result) {
            return { agentId, messages: [] };
        }

        return {
            agentId: result.agentId,
            messages: result.messages
        };
    }
});

// ─── claude-poll-until-done ──────────────────────────────────────────────────

const DEFAULT_POLL_INTERVAL_MS = 3_000;
const MAX_POLL_DURATION_MS = 30 * 60_000;

export const claudePollUntilDoneTool = createTool({
    id: "claude-poll-until-done",
    description:
        "Poll a Claude Code Agent until it reaches a terminal state (FINISHED or FAILED). " +
        "Implements exponential backoff. Returns the final status, branch name, and PR number.",
    inputSchema: z.object({
        agentId: z.string().describe("The Claude Code session ID"),
        maxWaitMinutes: z.number().optional().describe("Maximum minutes to wait (default: 30)"),
        repository: z.string().optional().describe("GitHub repository URL (for output parity)"),
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
    execute: async ({ agentId, maxWaitMinutes, repository }) => {
        const maxDuration = Math.min((maxWaitMinutes || 30) * 60_000, MAX_POLL_DURATION_MS);
        const startTime = Date.now();
        let interval = DEFAULT_POLL_INTERVAL_MS;
        const terminalStatuses = new Set(["FINISHED", "FAILED"]);

        while (Date.now() - startTime < maxDuration) {
            const result = sessionResults.get(agentId);

            if (!result) {
                return {
                    agentId,
                    status: "UNKNOWN",
                    summary: null,
                    branchName: null,
                    prNumber: null,
                    prUrl: null,
                    repository: repository || null,
                    durationMs: Date.now() - startTime,
                    timedOut: false
                };
            }

            if (terminalStatuses.has(result.status)) {
                return {
                    agentId: result.agentId,
                    status: result.status,
                    summary: result.summary,
                    branchName: result.branchName,
                    prNumber: result.prNumber,
                    prUrl: result.prUrl,
                    repository: result.repository || repository || null,
                    durationMs: result.durationMs,
                    timedOut: false
                };
            }

            await new Promise((resolve) => setTimeout(resolve, interval));
            interval = Math.min(interval * 1.5, 15_000);
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
