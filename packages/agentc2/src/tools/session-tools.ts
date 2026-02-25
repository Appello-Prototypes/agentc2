import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
    createSession,
    getSession,
    readScratchpad,
    writeScratchpad,
    recordPeerCall,
    recordParticipantInvocation
} from "../sessions";
import { evaluateCommunicationPolicy } from "../governance";

const getInternalBaseUrl = () =>
    process.env.MASTRA_API_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

const buildHeaders = () => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const apiKey = process.env.MASTRA_API_KEY || process.env.MCP_API_KEY;
    if (apiKey) headers["X-API-Key"] = apiKey;
    const orgSlug = process.env.MASTRA_ORGANIZATION_SLUG || process.env.MCP_API_ORGANIZATION_SLUG;
    if (orgSlug) headers["X-Organization-Slug"] = orgSlug;
    return headers;
};

// ── session-create ──

export const sessionCreateTool = createTool({
    id: "session-create",
    description:
        "Create a collaborative multi-agent session with shared memory. All participating agents can read and write to a shared scratchpad and invoke each other as peers. Use this to orchestrate complex tasks that require multiple agents to collaborate.",
    inputSchema: z.object({
        name: z.string().describe("Short name for the session"),
        agentSlugs: z
            .array(z.string())
            .min(2)
            .describe("Agent slugs to participate in this session (minimum 2)"),
        task: z.string().describe("The task description to initialize the scratchpad with"),
        orchestratorSlug: z
            .string()
            .optional()
            .describe("Agent slug of the orchestrator (defaults to the calling agent)"),
        scratchpadTemplate: z
            .string()
            .optional()
            .describe("Custom scratchpad template (markdown). Defaults to a standard template."),
        maxPeerCalls: z
            .number()
            .optional()
            .describe("Maximum peer-to-peer invocations in this session (default: 20)"),
        maxDepth: z.number().optional().describe("Maximum invocation depth (default: 5)")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        sessionId: z.string().optional(),
        memoryResourceId: z.string().optional(),
        memoryThreadId: z.string().optional(),
        participants: z.array(z.object({ agentSlug: z.string(), role: z.string() })).optional(),
        error: z.string().optional()
    }),
    execute: async ({
        name,
        agentSlugs,
        task,
        orchestratorSlug,
        scratchpadTemplate,
        maxPeerCalls,
        maxDepth
    }) => {
        try {
            const template =
                scratchpadTemplate ||
                `# Session Scratchpad
- **Task**: ${task}
- **Status**: active
- **Findings**:
- **Decisions**:
- **Open Questions**:`;

            const session = await createSession({
                initiatorType: "agent",
                initiatorId: orchestratorSlug || agentSlugs[0],
                agentSlugs,
                orchestratorSlug,
                name,
                scratchpadTemplate: template,
                maxPeerCalls,
                maxDepth
            });

            return {
                success: true,
                sessionId: session.id,
                memoryResourceId: session.memoryResourceId,
                memoryThreadId: session.memoryThreadId,
                participants: session.participants.map((p) => ({
                    agentSlug: p.agentSlug,
                    role: p.role
                }))
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Failed to create session"
            };
        }
    }
});

// ── session-invoke-peer ──

const MAX_INVOCATION_DEPTH = 5;

export const sessionInvokePeerTool = createTool({
    id: "session-invoke-peer",
    description:
        "Invoke a peer agent within a collaborative session. The target agent shares the session's memory and scratchpad, enabling it to see contributions from all other participants. Communication policies are enforced automatically.",
    inputSchema: z.object({
        sessionId: z.string().describe("The session ID to invoke within"),
        targetAgentSlug: z.string().describe("Slug of the peer agent to invoke"),
        message: z.string().describe("The message or task to send to the peer"),
        context: z
            .record(z.unknown())
            .optional()
            .describe("Optional additional context for the peer"),
        _invocationDepth: z
            .number()
            .optional()
            .describe("Internal: current invocation depth (auto-managed)"),
        _sourceAgent: z.string().optional().describe("Internal: slug of the calling agent")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        targetAgentSlug: z.string(),
        output: z.string().optional(),
        run_id: z.string().optional(),
        duration_ms: z.number().optional(),
        error: z.string().optional()
    }),
    execute: async ({
        sessionId,
        targetAgentSlug,
        message,
        context,
        _invocationDepth,
        _sourceAgent
    }) => {
        const depth = _invocationDepth ?? 0;
        const sourceAgent = _sourceAgent || "unknown";

        if (depth >= MAX_INVOCATION_DEPTH) {
            return {
                success: false,
                targetAgentSlug,
                error: `Maximum invocation depth (${MAX_INVOCATION_DEPTH}) exceeded`
            };
        }

        // Load session
        const session = await getSession(sessionId);
        if (!session) {
            return { success: false, targetAgentSlug, error: `Session "${sessionId}" not found` };
        }
        if (session.status !== "active") {
            return {
                success: false,
                targetAgentSlug,
                error: `Session is ${session.status}, not active`
            };
        }

        // Verify target is a participant
        const isParticipant = session.participants.some((p) => p.agentSlug === targetAgentSlug);
        if (!isParticipant) {
            return {
                success: false,
                targetAgentSlug,
                error: `Agent "${targetAgentSlug}" is not a participant in session "${sessionId}"`
            };
        }

        // Evaluate communication policy
        const policyDecision = await evaluateCommunicationPolicy({
            fromAgentSlug: sourceAgent,
            toAgentSlug: targetAgentSlug,
            sessionId,
            currentDepth: depth,
            currentPeerCalls: session.peerCallCount
        });

        if (!policyDecision.allowed) {
            return {
                success: false,
                targetAgentSlug,
                error: `Communication denied: ${policyDecision.reason}`
            };
        }

        // Record peer call budget
        const budget = await recordPeerCall(sessionId);
        if (!budget.allowed) {
            return {
                success: false,
                targetAgentSlug,
                error: `Session peer call limit (${budget.limit}) exceeded (current: ${budget.count})`
            };
        }

        try {
            const startMs = Date.now();
            const url = new URL(`/api/agents/${targetAgentSlug}/invoke`, getInternalBaseUrl());
            const response = await fetch(url.toString(), {
                method: "POST",
                headers: buildHeaders(),
                body: JSON.stringify({
                    input: message,
                    context: {
                        ...(context || {}),
                        _invocationDepth: depth + 1,
                        _sourceAgent: sourceAgent,
                        _sessionId: sessionId,
                        threadId: session.memoryThreadId,
                        resource: { userId: session.memoryResourceId }
                    },
                    mode: "sync"
                })
            });

            const result = await response.json();
            const durationMs = Date.now() - startMs;

            if (!response.ok || result?.success === false) {
                return {
                    success: false,
                    targetAgentSlug,
                    error: result?.error || `Peer invocation failed (${response.status})`
                };
            }

            // Track participant stats
            await recordParticipantInvocation(
                sessionId,
                targetAgentSlug,
                result.usage?.totalTokens
            );

            return {
                success: true,
                targetAgentSlug,
                output: result.output,
                run_id: result.run_id,
                duration_ms: result.duration_ms ?? durationMs
            };
        } catch (error) {
            return {
                success: false,
                targetAgentSlug,
                error: error instanceof Error ? error.message : "Peer invocation failed"
            };
        }
    }
});

// ── session-read-scratchpad ──

export const sessionReadScratchpadTool = createTool({
    id: "session-read-scratchpad",
    description:
        "Read the shared scratchpad for a collaborative session. The scratchpad contains contributions from all participating agents — findings, decisions, and open questions.",
    inputSchema: z.object({
        sessionId: z.string().describe("The session ID")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        scratchpad: z.string().optional(),
        participants: z
            .array(
                z.object({ agentSlug: z.string(), role: z.string(), invocationCount: z.number() })
            )
            .optional(),
        peerCallsUsed: z.number().optional(),
        peerCallsLimit: z.number().optional(),
        error: z.string().optional()
    }),
    execute: async ({ sessionId }) => {
        try {
            const session = await getSession(sessionId);
            if (!session) {
                return { success: false, error: `Session "${sessionId}" not found` };
            }

            const scratchpad = await readScratchpad(sessionId);

            return {
                success: true,
                scratchpad: scratchpad || session.name || "(empty scratchpad)",
                participants: session.participants,
                peerCallsUsed: session.peerCallCount,
                peerCallsLimit: session.maxPeerCalls
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Failed to read scratchpad"
            };
        }
    }
});

// ── session-write-scratchpad ──

export const sessionWriteScratchpadTool = createTool({
    id: "session-write-scratchpad",
    description:
        "Write to the shared session scratchpad. Use 'append' mode to add your findings without overwriting others, or 'replace' to set the entire scratchpad content.",
    inputSchema: z.object({
        sessionId: z.string().describe("The session ID"),
        content: z.string().describe("Content to write to the scratchpad"),
        mode: z
            .enum(["append", "replace"])
            .optional()
            .default("append")
            .describe(
                "'append' adds a timestamped entry; 'replace' overwrites entirely (default: append)"
            )
    }),
    outputSchema: z.object({
        success: z.boolean(),
        error: z.string().optional()
    }),
    execute: async ({ sessionId, content, mode }) => {
        try {
            const session = await getSession(sessionId);
            if (!session) {
                return { success: false, error: `Session "${sessionId}" not found` };
            }
            if (session.status !== "active") {
                return { success: false, error: `Session is ${session.status}, not active` };
            }

            await writeScratchpad(sessionId, content, mode || "append");
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Failed to write scratchpad"
            };
        }
    }
});
