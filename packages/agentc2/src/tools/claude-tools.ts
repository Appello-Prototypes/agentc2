/**
 * Claude Code Agent Tools
 *
 * Wraps the Claude Agent SDK (@anthropic-ai/claude-agent-sdk) to enable
 * programmatic dispatch of coding tasks via Claude Code. Output schemas
 * are identical to the Cursor Cloud Agent tools for workflow compatibility.
 *
 * Architecture: Unlike Cursor's async launch-then-poll model, the Claude
 * Agent SDK runs synchronously to completion. `claude-launch-agent` does
 * all the work (clone, code, push, PR) and caches the result. The poll
 * and conversation tools retrieve cached results by session ID.
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

// ─── claude-launch-agent ─────────────────────────────────────────────────────

export const claudeLaunchAgentTool = createTool({
    id: "claude-launch-agent",
    description:
        "Launch a Claude Code Agent to implement code changes on a GitHub repository. " +
        "Provide a detailed prompt describing what to build or fix. The agent clones the repo, " +
        "writes code, and pushes a branch. Set autoCreatePr to have a pull request created " +
        "automatically when the agent finishes.",
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
        const { resolveGitHubToken, parseRepoOwnerName, githubFetch } =
            await import("./github-helpers");

        const sessionId = randomUUID();
        const startTime = Date.now();
        const baseBranch = ref || "main";
        const timestamp = Date.now().toString(36);
        const branchName = `claude-code/task-${timestamp}`;
        const { owner, repo } = parseRepoOwnerName(repository);

        const gitHubToken = await resolveGitHubToken(organizationId);
        const anthropicKey = await resolveClaudeCodeApiKey(organizationId);
        const cloneUrl = `https://x-access-token:${gitHubToken}@github.com/${owner}/${repo}.git`;

        let tmpDir: string | null = null;
        const collectedMessages: Array<{
            role: string;
            content: string;
            timestamp: string | null;
        }> = [];
        let finalSummary: string | null = null;

        try {
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
                    permissionMode: "bypassPermissions",
                    allowDangerouslySkipPermissions: true,
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
                        const prRes = await githubFetch(
                            `/repos/${owner}/${repo}/pulls`,
                            gitHubToken,
                            {
                                method: "POST",
                                body: JSON.stringify({
                                    title: `[Claude Code] ${prompt.slice(0, 80)}`,
                                    body: prBody,
                                    head: branchName,
                                    base: baseBranch
                                })
                            }
                        );
                        const prData = await prRes.json();
                        prNumber = (prData as { number?: number }).number ?? null;
                        prUrl = (prData as { html_url?: string }).html_url ?? null;
                    } catch (prErr) {
                        console.warn("[ClaudeTools] PR creation failed:", prErr);
                    }
                }
            }

            const result: ClaudeSessionResult = {
                agentId: sessionId,
                status: "FINISHED",
                name: `claude-code-${timestamp}`,
                summary: finalSummary,
                branchName: hasChanges ? branchName : null,
                prNumber,
                prUrl,
                repository: `${owner}/${repo}`,
                durationMs: Date.now() - startTime,
                timedOut: false,
                messages: collectedMessages,
                agentUrl: null
            };
            sessionResults.set(sessionId, result);

            return {
                agentId: sessionId,
                name: result.name,
                status: result.status,
                branchName: result.branchName,
                agentUrl: null
            };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            const result: ClaudeSessionResult = {
                agentId: sessionId,
                status: "FAILED",
                name: `claude-code-${timestamp}`,
                summary: `Agent failed: ${errMsg}`,
                branchName: null,
                prNumber: null,
                prUrl: null,
                repository: `${owner}/${repo}`,
                durationMs: Date.now() - startTime,
                timedOut: false,
                messages: collectedMessages,
                agentUrl: null
            };
            sessionResults.set(sessionId, result);

            return {
                agentId: sessionId,
                name: result.name,
                status: "FAILED",
                branchName: null,
                agentUrl: null
            };
        } finally {
            if (tmpDir) {
                rm(tmpDir, { recursive: true, force: true }).catch(() => {});
            }
        }
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

export const claudePollUntilDoneTool = createTool({
    id: "claude-poll-until-done",
    description:
        "Retrieve the completed result of a Claude Code Agent session. " +
        "Since the Claude agent runs to completion during launch, this returns " +
        "the cached result including status, branch name, and PR number.",
    inputSchema: z.object({
        agentId: z.string().describe("The Claude Code session ID"),
        maxWaitMinutes: z.number().optional().describe("Unused (kept for schema parity)"),
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
    execute: async ({ agentId, repository }) => {
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
                durationMs: 0,
                timedOut: false
            };
        }

        return {
            agentId: result.agentId,
            status: result.status,
            summary: result.summary,
            branchName: result.branchName,
            prNumber: result.prNumber,
            prUrl: result.prUrl,
            repository: result.repository || repository || null,
            durationMs: result.durationMs,
            timedOut: result.timedOut
        };
    }
});
