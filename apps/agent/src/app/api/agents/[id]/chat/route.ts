import { createHash } from "crypto";
import { toAISdkV5Messages } from "@mastra/ai-sdk/ui";
import {
    createUIMessageStream,
    createUIMessageStreamResponse,
    generateId,
    hasToolCall,
    stepCountIs,
    type UIMessageStreamWriter
} from "ai";
import {
    agentResolver,
    BudgetExceededError,
    resolveModelOverride,
    type RoutingDecision
} from "@repo/agentc2/agents";

import { prisma } from "@repo/database";
import { NextRequest, NextResponse } from "next/server";
import {
    startConversationRun,
    continueTurn,
    type RunSource,
    type RunRecorderHandle,
    type TurnHandle,
    type ToolCallData
} from "@/lib/run-recorder";
import { calculateCost, calculateCostDetailed } from "@/lib/cost-calculator";
import { createTriggerEventRecord } from "@/lib/trigger-events";
import { getUserOrganizationId, getDefaultWorkspaceIdForUser } from "@/lib/organization";
import { orgScopedResourceId, orgScopedThreadId } from "@repo/agentc2/tenant-scope";
import { requireAgentAccess, requireAuth } from "@/lib/authz";
import { authenticateRequest } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit-policy";
import { enforceCsrf } from "@/lib/security/http-security";

let prewarmed = false;

function formatToolResultPreview(result: unknown, maxLength = 500): string {
    if (typeof result === "string") {
        return result.slice(0, maxLength);
    }

    try {
        const json = JSON.stringify(result, null, 2);
        if (json === undefined) {
            return String(result).slice(0, maxLength);
        }
        return json.slice(0, maxLength);
    } catch {
        return String(result).slice(0, maxLength);
    }
}

type StreamChunk = {
    type?: string;
    payload?: Record<string, unknown>;
    toolName?: string;
    name?: string;
    toolCallId?: string;
    id?: string;
    args?: Record<string, unknown>;
    result?: unknown;
    error?: string;
    textDelta?: string;
    text?: string;
    delta?: string;
    content?: string;
    value?: unknown;
    reason?: unknown;
    source?: unknown;
    sourceType?: string;
    url?: string;
    title?: string;
    file?: unknown;
    argsTextDelta?: string;
    usage?: Record<string, unknown>;
    finishReason?: string;
    providerMetadata?: unknown;
    input?: unknown;
};

type UsageLike = {
    promptTokens?: number;
    inputTokens?: number;
    completionTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    reasoningTokens?: number;
    cachedTokens?: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
};

type StreamResult = {
    fullStream?: AsyncIterable<unknown>;
    textStream: AsyncIterable<string>;
    usage?: Promise<Record<string, unknown>>;
};

const normalizeChunk = (chunk: unknown): StreamChunk => {
    if (chunk && typeof chunk === "object") {
        return chunk as StreamChunk;
    }
    return {};
};

/**
 * POST /api/agents/[id]/chat
 * Handles streaming chat messages for a specific agent
 *
 * Uses AgentResolver for ALL agents (database-first with fallback to code-defined).
 * This ensures test mode behaves exactly like production channels (Slack, WhatsApp, Voice).
 * MCP-enabled agents automatically receive all MCP tools via the resolver.
 *
 * NOW RECORDS ALL RUNS TO THE DATABASE via RunRecorder for full observability.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const t0 = performance.now();
    const timing: Record<string, number> = {};
    try {
        const csrf = enforceCsrf(request);
        if (csrf.response) {
            return csrf.response;
        }
        const authResult = await requireAuth(request);
        if (authResult.response) {
            return authResult.response;
        }
        // System agents (e.g. sidekick) are code-defined and not in the database,
        // so skip the DB-level access check for them.
        const SYSTEM_AGENT_SLUGS = new Set(["sidekick"]);
        if (!SYSTEM_AGENT_SLUGS.has(id)) {
            const accessResult = await requireAgentAccess(authResult.context.organizationId, id);
            if (accessResult.response) {
                return accessResult.response;
            }
        }

        const rate = await checkRateLimit(
            `chat:${authResult.context.organizationId}:${authResult.context.userId}:${id}`,
            RATE_LIMIT_POLICIES.chat
        );
        if (!rate.allowed) {
            return NextResponse.json(
                { success: false, error: "Rate limit exceeded" },
                { status: 429 }
            );
        }
        timing.auth = Math.round(performance.now() - t0);

        const body = await request.json();
        if (!body || typeof body !== "object" || !Array.isArray(body.messages)) {
            return NextResponse.json(
                { success: false, error: "Invalid payload: messages[] is required" },
                { status: 400 }
            );
        }
        const {
            threadId,
            requestContext,
            messages,
            modelOverride,
            thinkingOverride,
            runId: existingRunId
        } = body;

        const mode = requestContext?.mode || "test";
        const runSource: RunSource = mode === "live" ? "api" : "test";

        const rawUserId = authResult.context.userId;
        let resolvedOrgId: string | null = null;
        let enrichedRequestContext = requestContext;
        const tOrg = performance.now();
        if (rawUserId && !rawUserId.startsWith("anon-")) {
            const [orgId, workspaceId] = await Promise.all([
                getUserOrganizationId(rawUserId),
                getDefaultWorkspaceIdForUser(rawUserId)
            ]);
            resolvedOrgId = orgId;
            if (orgId || workspaceId) {
                enrichedRequestContext = {
                    ...requestContext,
                    ...(orgId ? { tenantId: orgId } : {}),
                    ...(workspaceId ? { workspaceId } : {})
                };
            }
        }

        // Org-scoped memory identifiers to prevent cross-tenant leakage
        const resourceId = orgScopedResourceId(resolvedOrgId || "", rawUserId);
        const userThreadId = threadId
            ? resolvedOrgId
                ? `${resolvedOrgId}:${threadId}`
                : threadId
            : orgScopedThreadId(resolvedOrgId || "", runSource, id, String(Date.now()));
        timing.orgResolve = Math.round(performance.now() - tOrg);

        // ── Model Routing (pre-resolve) ─────────────────────────────────────
        let routingDecision: RoutingDecision | null = null;
        let modelOverrideForResolve: { provider: string; name: string } | undefined;

        if (modelOverride && modelOverride.provider && modelOverride.name) {
            modelOverrideForResolve = {
                provider: modelOverride.provider,
                name: modelOverride.name
            };
            console.log(
                `[Agent Chat] Explicit model override: ${modelOverride.provider}/${modelOverride.name}`
            );
        } else {
            const routingResult = await resolveModelOverride(id, messages || [], {
                userId: resourceId !== "test-user" ? resourceId : undefined,
                organizationId: resolvedOrgId || undefined
            });
            routingDecision = routingResult.routingDecision;
            modelOverrideForResolve = routingResult.modelOverride;
        }

        // Lazy pre-warm: on the very first chat request, pre-warm the hydration cache
        if (!prewarmed) {
            prewarmed = true;
            agentResolver.prewarm().catch(() => {});
        }

        // Resolve agent via AgentResolver (database-first, fallback to code-defined)
        // This is the same path used by production channels (Slack, WhatsApp, Voice)
        const tResolve = performance.now();
        // eslint-disable-next-line prefer-const
        let { agent, record, source, activeSkills, toolOriginMap, toolHealth, resolvedToolNames } =
            await agentResolver.resolve({
                slug: id,
                requestContext: enrichedRequestContext,
                threadId: userThreadId,
                modelOverride: modelOverrideForResolve
            });
        timing.agentResolve = Math.round(performance.now() - tResolve);

        console.log(
            `[Agent Chat] Received slug param: '${id}', resolved agent: '${record?.slug || id}' (${record?.name || "fallback"}) from ${source} (mode: ${runSource})`
        );

        // Extract the last user message with all content parts (text + files/images)
        interface UserMessagePart {
            type: string;
            text?: string;
            url?: string;
            mediaType?: string;
            filename?: string;
        }
        const lastUserMsg = messages?.filter((m: { role: string }) => m.role === "user").pop() as
            | { content?: string; parts?: UserMessagePart[] }
            | undefined;

        let lastUserMessage = "";
        const imageParts: Array<{ type: "image"; image: string }> = [];

        if (lastUserMsg?.parts && Array.isArray(lastUserMsg.parts)) {
            for (const part of lastUserMsg.parts) {
                if (part.type === "text" && part.text) {
                    lastUserMessage = part.text;
                } else if (part.type === "file" && part.url) {
                    if (part.mediaType?.startsWith("image/") && part.url.startsWith("data:")) {
                        imageParts.push({ type: "image", image: part.url });
                    } else if (part.filename) {
                        lastUserMessage += `\n[Attached file: ${part.filename}]`;
                    }
                }
            }
        } else if (lastUserMsg?.content) {
            lastUserMessage = lastUserMsg.content;
        }

        if (!lastUserMessage && imageParts.length === 0) {
            return NextResponse.json(
                { success: false, error: "No user message provided" },
                { status: 400 }
            );
        }

        // Get agent ID for recording - prefer database record ID
        // Fallback agents (code-defined, no DB record) cannot be recorded due to FK constraints
        const agentId = record?.id || null;

        // Compute instructions hash for tracing
        const mergedInstructions = record?.instructions || "";
        const instructionsHash = mergedInstructions
            ? createHash("sha256").update(mergedInstructions).digest("hex")
            : undefined;

        // Start or continue conversation-level run recording.
        // First message: no existingRunId -> startConversationRun()
        // Subsequent messages: existingRunId present -> continueTurn()
        let run: RunRecorderHandle | null = null;
        let turnHandle: TurnHandle | null = null;
        let runReady: Promise<void> | null = null;
        if (agentId) {
            if (existingRunId) {
                // Subsequent message in an existing conversation
                runReady = continueTurn({
                    runId: existingRunId,
                    input: lastUserMessage,
                    agentId,
                    agentSlug: id,
                    toolOriginMap:
                        Object.keys(toolOriginMap).length > 0 ? toolOriginMap : undefined,
                    tenantId: record?.tenantId || undefined
                })
                    .then((handle) => {
                        turnHandle = handle;
                        // Create a legacy-compatible run handle for downstream code
                        run = {
                            runId: handle.runId,
                            traceId: handle.traceId,
                            complete: handle.completeTurn,
                            fail: handle.failTurn,
                            addToolCall: handle.addToolCall
                        };
                        console.log(
                            `[Agent Chat] Continued run ${handle.runId} with turn ${handle.turnIndex} for agent ${id}`
                        );

                        // Record trigger event (non-blocking, best-effort)
                        createTriggerEventRecord({
                            agentId,
                            workspaceId: record?.workspaceId || null,
                            runId: handle.runId,
                            sourceType: "chat",
                            eventName: "chat.message",
                            entityType: "agent",
                            payload: { input: lastUserMessage },
                            metadata: {
                                threadId: userThreadId,
                                resourceId,
                                mode,
                                turnIndex: handle.turnIndex
                            }
                        }).catch((e) => {
                            console.warn("[Agent Chat] Failed to record trigger event:", e);
                        });
                    })
                    .catch((e) => {
                        console.warn("[Agent Chat] Failed to continue turn:", e);
                    });
            } else {
                // First message in a new conversation
                runReady = startConversationRun({
                    agentId,
                    agentSlug: id,
                    input: lastUserMessage,
                    source: runSource,
                    userId: resourceId,
                    threadId: userThreadId,
                    skillsJson: activeSkills.length > 0 ? activeSkills : undefined,
                    toolOriginMap:
                        Object.keys(toolOriginMap).length > 0 ? toolOriginMap : undefined,
                    instructionsHash,
                    instructionsSnapshot: mergedInstructions || undefined,
                    tenantId: record?.tenantId || undefined,
                    metadata:
                        toolHealth.missingTools.length > 0
                            ? {
                                  toolHealth: {
                                      expectedCount: toolHealth.expectedCount,
                                      loadedCount: toolHealth.loadedCount,
                                      missingTools: toolHealth.missingTools,
                                      filteredTools: toolHealth.filteredTools
                                  }
                              }
                            : undefined
                })
                    .then((handle) => {
                        turnHandle = handle;
                        // Create a legacy-compatible run handle for downstream code
                        run = {
                            runId: handle.runId,
                            traceId: handle.traceId,
                            complete: handle.completeTurn,
                            fail: handle.failTurn,
                            addToolCall: handle.addToolCall
                        };
                        console.log(
                            `[Agent Chat] Started conversation run ${handle.runId} (turn 0) for agent ${id}`
                        );

                        // Record trigger event (non-blocking, best-effort)
                        createTriggerEventRecord({
                            agentId,
                            workspaceId: record?.workspaceId || null,
                            runId: handle.runId,
                            sourceType: "chat",
                            eventName: "chat.message",
                            entityType: "agent",
                            payload: { input: lastUserMessage },
                            metadata: {
                                threadId: userThreadId,
                                resourceId,
                                mode,
                                turnIndex: 0
                            }
                        }).catch((e) => {
                            console.warn("[Agent Chat] Failed to record trigger event:", e);
                        });
                    })
                    .catch((e) => {
                        console.warn("[Agent Chat] Failed to start conversation run:", e);
                    });
            }
        } else {
            console.log(
                `[Agent Chat] Skipping run recording for fallback agent '${id}' (no DB record)`
            );
        }

        // Use maxSteps from database record or default to 5 (matches production)
        const maxSteps = record?.maxSteps ?? 5;

        // Enforce input guardrails before starting the stream
        const tGuardrails = performance.now();
        if (agentId && lastUserMessage) {
            const { enforceInputGuardrails } = await import("@repo/agentc2/guardrails");
            const inputCheck = await enforceInputGuardrails(agentId, lastUserMessage, {
                tenantId: record?.tenantId || undefined
            });
            if (inputCheck.blocked) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "Input blocked by guardrail policy",
                        violations: inputCheck.violations
                    },
                    { status: 403 }
                );
            }
        }
        timing.guardrails = Math.round(performance.now() - tGuardrails);

        // Collect output and tool calls for recording
        let fullOutput = "";
        const toolCalls: ToolCallData[] = [];

        // Accumulate per-step token counts as a fallback for when .usage promise fails
        let accumulatedInputTokens = 0;
        let accumulatedOutputTokens = 0;
        let accumulatedCostUsd = 0;
        const PER_TURN_COST_CAP_USD = record?.maxSpendUsd ? record.maxSpendUsd / 300 : 0.5;

        // Build execution steps for time-travel debugging
        type ExecutionStep = {
            step: number;
            type: "thinking" | "tool_call" | "tool_result" | "response" | "step_usage";
            content: string;
            timestamp: string;
            durationMs?: number;
        };
        const executionSteps: ExecutionStep[] = [];
        let stepCounter = 0;

        // Track tool calls by their ID for matching with results
        const toolCallMap = new Map<
            string,
            { toolName: string; args: Record<string, unknown>; startTime: number }
        >();

        // Capture turn-complete metadata when the finish-tool pattern is active
        let turnCompleteMetadata: {
            reason?: string;
            nextAction?: string;
            summary?: string;
        } | null = null;

        // Build stream input -- multimodal (text + images) when image parts present
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let streamInput: any = lastUserMessage;
        if (imageParts.length > 0) {
            streamInput = [
                {
                    role: "user" as const,
                    content: [
                        ...(lastUserMessage
                            ? [{ type: "text" as const, text: lastUserMessage }]
                            : []),
                        ...imageParts
                    ]
                }
            ];
        }

        // Inject user context into stream input for tools that need userId/organizationId
        if (resolvedOrgId && resourceId && resourceId !== "test-user") {
            const contextPrefix = `[System context - do not repeat to user] Current user ID: ${resourceId}, Organization ID: ${resolvedOrgId}. Use these values when calling support ticket tools (submit-support-ticket, list-my-tickets, view-ticket-details, comment-on-ticket).`;
            if (typeof streamInput === "string") {
                streamInput = contextPrefix + "\n\n" + streamInput;
            } else if (Array.isArray(streamInput)) {
                streamInput = [
                    {
                        role: "system" as const,
                        content: contextPrefix
                    },
                    ...streamInput
                ];
            }
        }

        // Stream the response using the resolved agent
        const MAX_EMPTY_RETRIES = 2;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const streamOptions: Record<string, any> = {
            maxSteps,
            memory: {
                thread: userThreadId,
                resource: resourceId
            }
        };

        // Finish-tool pattern: when agent has turn-complete, force explicit termination
        const hasTurnComplete = resolvedToolNames?.includes("turn-complete");
        if (hasTurnComplete) {
            // Anthropic rejects toolChoice:"required" when thinking is enabled.
            // Detect thinking from the agent's modelConfig and fall back to "auto".
            const mc = record?.modelConfig as Record<string, unknown> | null;
            const anthCfg = (mc?.anthropic ?? {}) as Record<string, unknown>;
            const thinkingCfg = (anthCfg.thinking ?? mc?.thinking ?? null) as {
                type?: string;
            } | null;
            const thinkingEnabled =
                thinkingCfg?.type === "enabled" || thinkingCfg?.type === "adaptive";

            if (thinkingEnabled) {
                // toolChoice "auto" is the only value compatible with Anthropic thinking
                streamOptions.toolChoice = "auto";
            } else {
                streamOptions.toolChoice = "required";
            }

            streamOptions.stopWhen = [
                hasToolCall("turn-complete"),
                hasToolCall("ask_questions"),
                stepCountIs(maxSteps)
            ];

            if (!thinkingEnabled) {
                streamOptions.prepareStep = ({ steps }: { steps: unknown[] }) => {
                    const currentStep = steps.length + 1;
                    if (currentStep >= maxSteps) {
                        return {
                            toolChoice: {
                                type: "tool" as const,
                                toolName: "turn-complete"
                            }
                        };
                    }
                    return undefined;
                };
            }

            console.log(
                `[Agent Chat] Finish-tool pattern enabled for "${id}" (maxSteps=${maxSteps}, thinking=${thinkingEnabled ? "on→auto" : "off→required"})`
            );
        }

        // Memory diagnostic: log thread/resource used and whether agent has memory
        const hasMemory = Boolean(
            agent && "memory" in agent && (agent as Record<string, unknown>).memory
        );
        console.log(
            `[Agent Chat] Memory context: thread=${userThreadId}, resource=${resourceId}, agentHasMemory=${hasMemory}, agent=${id}`
        );

        // Ensure provider options (e.g. Anthropic prompt caching) from the agent's
        // defaultOptions are passed through to every stream call, rather than relying
        // on Mastra's internal merge which may not forward providerOptions.
        try {
            const agentDefaultOpts = await agent.getDefaultOptions();
            if (agentDefaultOpts?.providerOptions) {
                streamOptions.providerOptions = {
                    ...agentDefaultOpts.providerOptions,
                    ...streamOptions.providerOptions
                };
            }
        } catch {
            // Non-fatal: if getDefaultOptions fails, proceed without provider options
        }

        // Wire request abort signal to agent stream so client cancellation
        // stops token consumption immediately at the LLM API level
        const abortController = new AbortController();
        request.signal.addEventListener("abort", () => abortController.abort());
        streamOptions.abortSignal = abortController.signal;

        const tStream = performance.now();
        let responseStream;
        try {
            responseStream = await agent.stream(streamInput, streamOptions);
        } catch (streamInitError) {
            console.error(
                `[Agent Chat] agent.stream() INIT FAILED:`,
                streamInitError instanceof Error ? streamInitError.stack : streamInitError
            );
            throw streamInitError;
        }
        timing.streamStart = Math.round(performance.now() - tStream);
        timing.total = Math.round(performance.now() - t0);
        console.log(`[Agent Chat] ⏱ Timing (ms): ${JSON.stringify(timing)}`);

        // Create a UI message stream compatible with useChat
        const stream = createUIMessageStream({
            execute: async ({ writer }: { writer: UIMessageStreamWriter }) => {
                // Don't block on runReady here -- let the run handle resolve in the
                // background while we start streaming text to the client immediately.
                // The run handle is only needed for post-stream bookkeeping (fire-and-forget).

                // Generate a unique message ID for this response
                const messageId = generateId();
                const textState = { currentId: null as string | null };

                try {
                    // Start the first text block
                    writer.write({
                        type: "text-start",
                        id: messageId
                    });
                    textState.currentId = messageId;

                    // Send run metadata when the DB write resolves — don't block text streaming.
                    if (runReady) {
                        runReady
                            .then(() => {
                                if (run) {
                                    writer.write({
                                        type: "data-run-metadata",
                                        data: {
                                            runId: run.runId,
                                            turnId: turnHandle?.turnId,
                                            turnIndex: turnHandle?.turnIndex,
                                            messageId
                                        }
                                    });
                                }
                            })
                            .catch(() => {});
                    }

                    // Use fullStream to capture ALL events including tool calls
                    const streamResult = responseStream as unknown as StreamResult;
                    const fullStream = streamResult.fullStream;
                    const textStream = streamResult.textStream;
                    const writeTraceStepLive = (step: {
                        step: number;
                        type: string;
                        content: string;
                        durationMs?: number;
                    }) => {
                        if (!run) return;
                        prisma.agentTraceStep
                            .create({
                                data: {
                                    traceId: run.traceId,
                                    stepNumber: step.step,
                                    type: step.type,
                                    content: step.content,
                                    durationMs: step.durationMs ?? null
                                }
                            })
                            .catch(() => {});
                    };

                    const writeToolCallLive = (tc: ToolCallData) => {
                        if (!run) return;
                        run.addToolCall(tc).catch(() => {});
                    };

                    const handleToolChunk = (c: StreamChunk) => {
                        // Handle tool calls
                        if (c.type === "tool-call") {
                            const payload =
                                c.payload &&
                                typeof c.payload === "object" &&
                                !Array.isArray(c.payload)
                                    ? (c.payload as Record<string, unknown>)
                                    : {};
                            const toolName =
                                (typeof payload.toolName === "string" && payload.toolName) ||
                                (typeof payload.name === "string" && payload.name) ||
                                (typeof c.toolName === "string" && c.toolName) ||
                                (typeof c.name === "string" && c.name) ||
                                "unknown";
                            const toolCallId =
                                (typeof payload.toolCallId === "string" && payload.toolCallId) ||
                                (typeof payload.id === "string" && payload.id) ||
                                (typeof c.toolCallId === "string" && c.toolCallId) ||
                                (typeof c.id === "string" && c.id) ||
                                `tool-${Date.now()}`;
                            const args =
                                (payload.args as Record<string, unknown> | undefined) ||
                                (c.args as Record<string, unknown> | undefined) ||
                                {};
                            toolCallMap.set(toolCallId, {
                                toolName,
                                args,
                                startTime: Date.now()
                            });

                            // Extract turn-complete metadata for run recording
                            if (toolName === "turn-complete") {
                                turnCompleteMetadata = {
                                    reason: args.reason as string | undefined,
                                    nextAction: args.nextAction as string | undefined,
                                    summary: args.summary as string | undefined
                                };
                            }

                            // Close current text block before tool invocation
                            if (textState.currentId) {
                                writer.write({ type: "text-end", id: textState.currentId });
                                textState.currentId = null;
                            }
                            writer.write({ type: "start-step" });

                            writer.write({
                                type: "tool-input-available",
                                toolCallId,
                                toolName,
                                input: args
                            });

                            stepCounter++;
                            const toolCallStep = {
                                step: stepCounter,
                                type: "tool_call" as const,
                                content: `Calling tool: ${toolName}\nArgs: ${JSON.stringify(args, null, 2)}`,
                                timestamp: new Date().toISOString()
                            };
                            executionSteps.push(toolCallStep);
                            writeTraceStepLive(toolCallStep);
                            return;
                        }

                        // Handle tool results
                        if (c.type === "tool-result") {
                            const payload =
                                c.payload &&
                                typeof c.payload === "object" &&
                                !Array.isArray(c.payload)
                                    ? (c.payload as Record<string, unknown>)
                                    : {};
                            const toolCallId =
                                (typeof payload.toolCallId === "string" && payload.toolCallId) ||
                                (typeof payload.id === "string" && payload.id) ||
                                (typeof c.toolCallId === "string" && c.toolCallId) ||
                                c.id ||
                                "";
                            const toolName =
                                (typeof payload.toolName === "string" && payload.toolName) ||
                                (typeof c.toolName === "string" && c.toolName) ||
                                "unknown";
                            const result = payload.result ?? c.result;
                            const error = (payload.error as string | undefined) ?? c.error;
                            const call = toolCallMap.get(toolCallId);
                            let durationMs: number | undefined;
                            if (call) {
                                durationMs = Date.now() - call.startTime;
                                toolCalls.push({
                                    toolKey: call.toolName,
                                    input: call.args,
                                    output: result,
                                    success: !error,
                                    error: error,
                                    durationMs
                                });
                            } else {
                                toolCalls.push({
                                    toolKey: toolName,
                                    input: {},
                                    output: result,
                                    success: !error,
                                    error: error
                                });
                            }

                            if (error) {
                                writer.write({
                                    type: "tool-output-error",
                                    toolCallId,
                                    errorText: error
                                });
                            } else {
                                writer.write({
                                    type: "tool-output-available",
                                    toolCallId,
                                    output: result
                                });
                            }

                            // Close step and open next text block for post-tool text
                            writer.write({ type: "finish-step" });
                            const nextTextId = generateId();
                            writer.write({ type: "text-start", id: nextTextId });
                            textState.currentId = nextTextId;

                            stepCounter++;
                            const resultPreview = formatToolResultPreview(result, 500);
                            const toolResultStep = {
                                step: stepCounter,
                                type: "tool_result" as const,
                                content: error
                                    ? `Tool ${call?.toolName || toolName} failed: ${error}`
                                    : `Tool ${call?.toolName || toolName} result:\n${resultPreview}${resultPreview.length >= 500 ? "..." : ""}`,
                                timestamp: new Date().toISOString(),
                                durationMs
                            };
                            executionSteps.push(toolResultStep);
                            writeTraceStepLive(toolResultStep);
                            writeToolCallLive(toolCalls[toolCalls.length - 1]!);
                        }

                        if (c.type === "tool-error") {
                            const payload =
                                c.payload &&
                                typeof c.payload === "object" &&
                                !Array.isArray(c.payload)
                                    ? (c.payload as Record<string, unknown>)
                                    : {};
                            const toolCallId =
                                (typeof payload.toolCallId === "string" && payload.toolCallId) ||
                                (typeof payload.id === "string" && payload.id) ||
                                (typeof c.toolCallId === "string" && c.toolCallId) ||
                                c.id ||
                                "";
                            const toolName =
                                (typeof payload.toolName === "string" && payload.toolName) ||
                                (typeof c.toolName === "string" && c.toolName) ||
                                "unknown";
                            const errorObj = payload.error ?? c.error;
                            const errorMessage =
                                typeof errorObj === "string"
                                    ? errorObj
                                    : errorObj &&
                                        typeof errorObj === "object" &&
                                        "message" in (errorObj as Record<string, unknown>)
                                      ? String((errorObj as Record<string, unknown>).message)
                                      : "Tool execution error";
                            const call = toolCallMap.get(toolCallId);
                            let durationMs: number | undefined;

                            if (call) {
                                durationMs = Date.now() - call.startTime;
                                toolCalls.push({
                                    toolKey: call.toolName,
                                    input: call.args,
                                    output: undefined,
                                    success: false,
                                    error: errorMessage,
                                    durationMs
                                });
                            } else {
                                toolCalls.push({
                                    toolKey: toolName,
                                    input: {},
                                    output: undefined,
                                    success: false,
                                    error: errorMessage
                                });
                            }

                            console.warn(
                                `[Agent Chat] tool-error for ${call?.toolName || toolName} (callId=${toolCallId}): ${errorMessage}`
                            );

                            writer.write({
                                type: "tool-output-error",
                                toolCallId,
                                errorText: errorMessage
                            });

                            writer.write({ type: "finish-step" });
                            const nextTextId = generateId();
                            writer.write({ type: "text-start", id: nextTextId });
                            textState.currentId = nextTextId;

                            stepCounter++;
                            const toolErrorStep = {
                                step: stepCounter,
                                type: "tool_result" as const,
                                content: `Tool ${call?.toolName || toolName} failed: ${errorMessage}`,
                                timestamp: new Date().toISOString(),
                                durationMs
                            };
                            executionSteps.push(toolErrorStep);
                            writeTraceStepLive(toolErrorStep);
                            writeToolCallLive(toolCalls[toolCalls.length - 1]!);
                        }
                    };

                    // ── Stream consumption with retry on empty response ──
                    // Consumes the fullStream/textStream and writes to the UIMessageStreamWriter.
                    // If the stream produces zero content, retries up to MAX_EMPTY_RETRIES times
                    // with backoff. If all attempts fail, writes a recovery message so the user
                    // never sees a blank response.

                    const IDLE_TIMEOUT_MS = 10_000;
                    const GLOBAL_STREAM_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes max per stream
                    const CHUNK_IDLE_TIMEOUT_MS = 45_000; // 45s max between chunks
                    let hasReceivedContent = false;
                    let streamAttempt = 0;
                    let activeStreamResult = streamResult;
                    const allStreamResults: StreamResult[] = [
                        streamResult as unknown as StreamResult
                    ];
                    let activeResponseStream = responseStream;

                    const consumeFullStream = async (
                        sr: StreamResult,
                        w: UIMessageStreamWriter,
                        ts: { currentId: string | null }
                    ): Promise<boolean> => {
                        const fs = sr.fullStream;
                        const txs = sr.textStream;
                        let gotContent = false;
                        let reasoningBuffer = "";
                        let reasoningId: string | null = null;

                        if (fs) {
                            const fsIterator = (
                                fs as AsyncIterable<unknown> & {
                                    [Symbol.asyncIterator](): AsyncIterator<unknown>;
                                }
                            )[Symbol.asyncIterator]();

                            let finishSeen = false;
                            const streamStartTime = Date.now();
                            let lastChunkTime = Date.now();

                            while (true) {
                                const now = Date.now();
                                if (now - streamStartTime > GLOBAL_STREAM_TIMEOUT_MS) {
                                    console.warn(
                                        `[Agent Chat] Global stream timeout (${GLOBAL_STREAM_TIMEOUT_MS}ms) reached for agent "${id}". Ending stream.`
                                    );
                                    break;
                                }

                                const chunkTimeout = finishSeen
                                    ? IDLE_TIMEOUT_MS
                                    : CHUNK_IDLE_TIMEOUT_MS;
                                const raceTargets: Promise<
                                    | IteratorResult<unknown, unknown>
                                    | { done: true; value: undefined }
                                >[] = [
                                    fsIterator.next(),
                                    new Promise((resolve) =>
                                        setTimeout(
                                            () => resolve({ done: true, value: undefined }),
                                            chunkTimeout
                                        )
                                    )
                                ];

                                const result = await Promise.race(raceTargets);
                                if (result.done) {
                                    if (
                                        !finishSeen &&
                                        now - lastChunkTime >= CHUNK_IDLE_TIMEOUT_MS
                                    ) {
                                        console.warn(
                                            `[Agent Chat] Chunk idle timeout (${CHUNK_IDLE_TIMEOUT_MS}ms) reached for agent "${id}". Stream appears hung.`
                                        );
                                    }
                                    break;
                                }
                                lastChunkTime = Date.now();

                                const c = normalizeChunk(result.value);

                                if (c.type === "error") {
                                    const errPayload = c.payload ?? (c as Record<string, unknown>);
                                    const errObj = errPayload.error;
                                    const errMsg =
                                        errObj &&
                                        typeof errObj === "object" &&
                                        "message" in (errObj as Record<string, unknown>)
                                            ? String((errObj as Record<string, unknown>).message)
                                            : typeof errObj === "string"
                                              ? errObj
                                              : JSON.stringify(errObj ?? c).substring(0, 500);
                                    console.error(
                                        `[Agent Chat] Stream error chunk for agent "${id}":`,
                                        errMsg
                                    );
                                    if (ts.currentId) {
                                        w.write({
                                            type: "text-delta",
                                            id: ts.currentId,
                                            delta: `Error: ${errMsg}`
                                        });
                                        gotContent = true;
                                    }
                                    finishSeen = true;
                                } else if (c.type === "text-delta") {
                                    const text =
                                        (typeof c.payload?.text === "string" && c.payload.text) ||
                                        (typeof c.textDelta === "string" && c.textDelta) ||
                                        (typeof c.text === "string" && c.text) ||
                                        (typeof c.delta === "string" && c.delta) ||
                                        (typeof c.content === "string" && c.content) ||
                                        (typeof c.value === "string" ? c.value : "") ||
                                        "";
                                    if (text && ts.currentId) {
                                        gotContent = true;
                                        fullOutput += text;
                                        w.write({
                                            type: "text-delta",
                                            id: ts.currentId,
                                            delta: text
                                        });
                                    }
                                    finishSeen = false;
                                } else if (
                                    c.type === "reasoning-delta" ||
                                    c.type === "reasoning-start" ||
                                    c.type === "reasoning-end"
                                ) {
                                    gotContent = true;
                                    finishSeen = false;

                                    if (c.type === "reasoning-start") {
                                        if (textState.currentId) {
                                            w.write({ type: "text-end", id: textState.currentId });
                                            textState.currentId = null;
                                        }
                                        reasoningId = generateId();
                                        w.write({ type: "reasoning-start", id: reasoningId });
                                    }

                                    if (
                                        c.type === "reasoning-delta" &&
                                        typeof (c as Record<string, unknown>).text === "string"
                                    ) {
                                        const text = (c as Record<string, unknown>).text as string;
                                        reasoningBuffer += text;
                                        if (reasoningId) {
                                            w.write({
                                                type: "reasoning-delta",
                                                id: reasoningId,
                                                delta: text
                                            });
                                        }
                                    }

                                    if (c.type === "reasoning-end") {
                                        if (reasoningId) {
                                            w.write({ type: "reasoning-end", id: reasoningId });
                                            reasoningId = null;
                                        }
                                        if (reasoningBuffer) {
                                            stepCounter++;
                                            const thinkingStep = {
                                                step: stepCounter,
                                                type: "thinking" as const,
                                                content: reasoningBuffer.substring(0, 2000),
                                                timestamp: new Date().toISOString()
                                            };
                                            executionSteps.push(thinkingStep);
                                            writeTraceStepLive(thinkingStep);
                                            reasoningBuffer = "";
                                        }
                                        if (!ts.currentId) {
                                            const nextTextId = generateId();
                                            w.write({ type: "text-start", id: nextTextId });
                                            ts.currentId = nextTextId;
                                        }
                                    }
                                } else if (c.type === "reasoning-part-finish") {
                                    gotContent = true;
                                    finishSeen = false;
                                } else if (c.type === "abort") {
                                    console.warn(
                                        `[Agent Chat] Stream aborted for agent "${id}":`,
                                        c.reason ?? "no reason"
                                    );
                                    finishSeen = true;
                                } else if (c.type === "source") {
                                    gotContent = true;
                                    finishSeen = false;
                                } else if (c.type === "file") {
                                    gotContent = true;
                                    finishSeen = false;
                                } else if (
                                    c.type === "tool-call-streaming-start" ||
                                    c.type === "tool-call-delta"
                                ) {
                                    gotContent = true;
                                    finishSeen = false;
                                } else if (c.type === "finish-step") {
                                    const stepUsage =
                                        c.usage ??
                                        (c.payload as Record<string, unknown> | undefined)?.usage;
                                    if (stepUsage && typeof stepUsage === "object") {
                                        const u = stepUsage as Record<string, unknown>;
                                        const inTok =
                                            (u.inputTokens as number) ??
                                            (u.promptTokens as number) ??
                                            0;
                                        const outTok =
                                            (u.outputTokens as number) ??
                                            (u.completionTokens as number) ??
                                            0;
                                        accumulatedInputTokens += inTok;
                                        accumulatedOutputTokens += outTok;
                                        stepCounter++;

                                        const stepCost = calculateCostDetailed(
                                            record?.modelName || "unknown",
                                            record?.modelProvider || "unknown",
                                            { promptTokens: inTok, completionTokens: outTok }
                                        );
                                        accumulatedCostUsd += stepCost;

                                        w.write({
                                            type: "data-step-cost",
                                            data: {
                                                step: stepCounter,
                                                inputTokens: inTok,
                                                outputTokens: outTok,
                                                costUsd: stepCost,
                                                cumulativeCostUsd: accumulatedCostUsd
                                            }
                                        });

                                        const usageStep = {
                                            step: stepCounter,
                                            type: "step_usage" as const,
                                            content: `Tokens: ${u.totalTokens ?? inTok + outTok} (in: ${inTok}, out: ${outTok}) | Cost: $${stepCost.toFixed(4)} (cumulative: $${accumulatedCostUsd.toFixed(4)})`,
                                            timestamp: new Date().toISOString()
                                        };
                                        executionSteps.push(usageStep);
                                        writeTraceStepLive(usageStep);

                                        if (accumulatedCostUsd > PER_TURN_COST_CAP_USD) {
                                            console.warn(
                                                `[Agent Chat] Per-turn cost cap exceeded for "${id}": ` +
                                                    `$${accumulatedCostUsd.toFixed(4)} > $${PER_TURN_COST_CAP_USD}. ` +
                                                    `Accumulated: ${accumulatedInputTokens} in + ${accumulatedOutputTokens} out.`
                                            );
                                            w.write({
                                                type: "data-cost-warning",
                                                data: {
                                                    runningCost: accumulatedCostUsd,
                                                    cap: PER_TURN_COST_CAP_USD,
                                                    message: "Turn cost cap reached"
                                                }
                                            });
                                        }
                                    }
                                    finishSeen = false;
                                } else if (
                                    c.type === "start" ||
                                    c.type === "start-step" ||
                                    c.type === "text-start" ||
                                    c.type === "text-end" ||
                                    c.type === "tool-input-start" ||
                                    c.type === "tool-input-delta" ||
                                    c.type === "tool-input-end"
                                ) {
                                    if (
                                        c.type === "tool-input-start" ||
                                        c.type === "tool-input-delta" ||
                                        c.type === "tool-input-end"
                                    ) {
                                        gotContent = true;
                                    }
                                    finishSeen = false;
                                } else if (c.type === "finish") {
                                    finishSeen = true;
                                } else {
                                    if (c.type === "tool-call" || c.type === "tool-result") {
                                        gotContent = true;
                                        finishSeen = false;
                                    }
                                    handleToolChunk(c);
                                }
                            }
                        } else if (txs) {
                            const textIterator = (
                                txs as AsyncIterable<string> & {
                                    [Symbol.asyncIterator](): AsyncIterator<string>;
                                }
                            )[Symbol.asyncIterator]();
                            let textDone = false;
                            while (!textDone) {
                                const result = await Promise.race([
                                    textIterator.next(),
                                    new Promise<{ done: true; value: undefined }>((_, reject) =>
                                        setTimeout(
                                            () =>
                                                reject(new Error("Text stream chunk idle timeout")),
                                            CHUNK_IDLE_TIMEOUT_MS
                                        )
                                    )
                                ]).catch((err) => {
                                    console.warn(
                                        `[Agent Chat] textStream timeout for agent "${id}":`,
                                        err.message
                                    );
                                    return { done: true as const, value: undefined };
                                });
                                if (result.done) {
                                    textDone = true;
                                    break;
                                }
                                const chunk = result.value;
                                if (chunk && ts.currentId) {
                                    gotContent = true;
                                    fullOutput += chunk;
                                    w.write({ type: "text-delta", id: ts.currentId, delta: chunk });
                                }
                            }
                        }

                        return gotContent;
                    };

                    // Attempt 0: consume the already-initialized stream
                    hasReceivedContent = await consumeFullStream(
                        activeStreamResult,
                        writer,
                        textState
                    );

                    // ── Orphaned-tool-call recovery ──
                    // If the stream produced content but some tool calls never received
                    // results (e.g., skill tools called before activation took effect),
                    // re-resolve the agent and continue so the LLM can retry.
                    const MAX_ORPHAN_RETRIES = 1;
                    if (hasReceivedContent) {
                        const orphanedCalls: Array<{
                            callId: string;
                            toolName: string;
                            args: Record<string, unknown>;
                        }> = [];
                        const resolvedToolNames = new Set(toolCalls.map((tc) => tc.toolKey));
                        for (const [callId, entry] of toolCallMap.entries()) {
                            if (!resolvedToolNames.has(entry.toolName)) {
                                orphanedCalls.push({
                                    callId,
                                    toolName: entry.toolName,
                                    args: entry.args
                                });
                            }
                        }

                        if (orphanedCalls.length > 0) {
                            const orphanedNames = orphanedCalls.map((o) => o.toolName).join(", ");
                            console.warn(
                                `[Agent Chat] ${orphanedCalls.length} orphaned tool call(s) detected (${orphanedNames}). ` +
                                    `Re-resolving agent and continuing…`
                            );

                            const skillActivated = toolCalls.some(
                                (tc) => tc.toolKey === "activate-skill" && tc.success
                            );

                            let continuationAgent = agent;
                            if (skillActivated) {
                                const activatedSlugs = toolCalls
                                    .filter((tc) => tc.toolKey === "activate-skill" && tc.success)
                                    .flatMap((tc) => {
                                        const input = tc.input as { skillSlugs?: string[] };
                                        return input?.skillSlugs || [];
                                    });
                                try {
                                    const reResolved = await agentResolver.resolve({
                                        slug: id,
                                        requestContext: enrichedRequestContext,
                                        threadId: userThreadId,
                                        modelOverride: modelOverrideForResolve,
                                        justActivatedSlugs: activatedSlugs
                                    });
                                    continuationAgent = reResolved.agent;
                                    console.log(
                                        `[Agent Chat] Agent re-resolved with newly activated skills`
                                    );
                                } catch (reErr) {
                                    console.error(
                                        `[Agent Chat] Re-resolve failed, using original agent:`,
                                        reErr
                                    );
                                }
                            }

                            const retryPrompt =
                                `[System: Your previous tool calls for ${orphanedNames} did not execute. ` +
                                `The tools are now available. Please retry those calls to complete the user's request. ` +
                                `Do NOT repeat information you already told the user.]`;

                            for (
                                let orphanRetry = 0;
                                orphanRetry < MAX_ORPHAN_RETRIES;
                                orphanRetry++
                            ) {
                                try {
                                    const contStream = await continuationAgent.stream(
                                        retryPrompt,
                                        streamOptions
                                    );
                                    const contResult = contStream as unknown as StreamResult;
                                    activeStreamResult = contResult;
                                    allStreamResults.push(contResult);
                                    activeResponseStream = contStream;

                                    const contGotContent = await consumeFullStream(
                                        contResult,
                                        writer,
                                        textState
                                    );
                                    if (contGotContent) {
                                        hasReceivedContent = true;
                                    }
                                    break;
                                } catch (contErr) {
                                    console.error(
                                        `[Agent Chat] Continuation stream failed:`,
                                        contErr instanceof Error ? contErr.message : contErr
                                    );
                                }
                            }
                        }
                    }

                    // Retry loop: if the stream was empty, retry with backoff
                    while (!hasReceivedContent && streamAttempt < MAX_EMPTY_RETRIES) {
                        streamAttempt++;
                        const delay = streamAttempt * 750;
                        console.warn(
                            `[Agent Chat] Empty stream detected for agent "${id}" — ` +
                                `retry ${streamAttempt}/${MAX_EMPTY_RETRIES} after ${delay}ms`
                        );
                        await new Promise((r) => setTimeout(r, delay));

                        try {
                            activeResponseStream = await agent.stream(streamInput, streamOptions);
                            activeStreamResult = activeResponseStream as unknown as StreamResult;
                            allStreamResults.push(activeStreamResult);
                            hasReceivedContent = await consumeFullStream(
                                activeStreamResult,
                                writer,
                                textState
                            );
                        } catch (retryError) {
                            console.error(
                                `[Agent Chat] Retry ${streamAttempt} stream init failed:`,
                                retryError instanceof Error ? retryError.message : retryError
                            );
                            break;
                        }
                    }

                    // Graceful degradation: if all retries exhausted and still empty,
                    // send a recovery message so the user never sees a blank response
                    if (!hasReceivedContent && toolCalls.length === 0) {
                        const recoveryMsg =
                            "I wasn't able to generate a response to your message. " +
                            "This can happen with very short inputs \u2014 could you rephrase " +
                            "or provide more context? If the issue persists, please try again.";

                        if (textState.currentId) {
                            writer.write({
                                type: "text-delta",
                                id: textState.currentId,
                                delta: recoveryMsg
                            });
                        }
                        fullOutput = recoveryMsg;
                        console.warn(
                            `[Agent Chat] All ${MAX_EMPTY_RETRIES + 1} attempts produced ` +
                                `empty response for agent "${id}" — sent recovery message`
                        );
                    }

                    // ── Auto-continuation loop ──
                    // When turn-complete signals "work_complete" with a nextAction,
                    // automatically continue execution without requiring human input.
                    const MAX_AUTO_CONTINUATIONS = 3;
                    const MAX_SESSION_COST_USD = 2.0;
                    const MAX_CONTINUATION_LOOP_MS = 120_000; // 2 min total for all continuations
                    const CONTINUATION_MAX_STEPS = 10;
                    let continuationCount = 0;
                    const contLoopStart = Date.now();

                    while (
                        turnCompleteMetadata?.reason === "work_complete" &&
                        turnCompleteMetadata?.nextAction &&
                        continuationCount < MAX_AUTO_CONTINUATIONS &&
                        accumulatedCostUsd < MAX_SESSION_COST_USD &&
                        hasReceivedContent &&
                        Date.now() - contLoopStart < MAX_CONTINUATION_LOOP_MS
                    ) {
                        continuationCount++;
                        console.log(
                            `[Agent Chat] Auto-continuation ${continuationCount}/${MAX_AUTO_CONTINUATIONS} ` +
                                `for "${id}" (cost: $${accumulatedCostUsd.toFixed(4)}): ${turnCompleteMetadata.nextAction}`
                        );

                        writer.write({
                            type: "data-continuation",
                            data: {
                                count: continuationCount,
                                maxCount: MAX_AUTO_CONTINUATIONS,
                                costSoFar: accumulatedCostUsd,
                                costCap: MAX_SESSION_COST_USD,
                                nextAction: turnCompleteMetadata.nextAction
                            }
                        });

                        const prevNextAction = turnCompleteMetadata.nextAction;
                        turnCompleteMetadata = null;

                        if (textState.currentId) {
                            writer.write({ type: "text-end", id: textState.currentId });
                            textState.currentId = null;
                        }
                        writer.write({ type: "finish-step" });
                        writer.write({ type: "start-step" });
                        const contTextId = generateId();
                        writer.write({ type: "text-start", id: contTextId });
                        textState.currentId = contTextId;

                        try {
                            const contPrompt = `[System: Continue execution. Your previous turn completed with nextAction: "${prevNextAction}". Execute it now. Finish within ${CONTINUATION_MAX_STEPS} steps.]`;
                            const contStreamOpts = {
                                ...streamOptions,
                                maxSteps: CONTINUATION_MAX_STEPS
                            };
                            const contStream = await agent.stream(contPrompt, contStreamOpts);
                            const contResult = contStream as unknown as StreamResult;
                            activeStreamResult = contResult;
                            allStreamResults.push(contResult);

                            const contGotContent = await consumeFullStream(
                                contResult,
                                writer,
                                textState
                            );
                            if (contGotContent) {
                                hasReceivedContent = true;
                            }
                        } catch (contErr) {
                            console.error(
                                `[Agent Chat] Auto-continuation ${continuationCount} failed:`,
                                contErr instanceof Error ? contErr.message : contErr
                            );
                            break;
                        }
                    }

                    if (continuationCount > 0) {
                        console.log(
                            `[Agent Chat] Auto-continuation complete: ${continuationCount} additional turns, ` +
                                `total cost: $${accumulatedCostUsd.toFixed(4)}`
                        );
                    }

                    // Close any remaining open text block
                    if (textState.currentId) {
                        writer.write({ type: "text-end", id: textState.currentId });
                        textState.currentId = null;
                    }

                    // Snapshot values needed by post-stream work (closures)
                    const capturedRun = run;
                    const capturedStreamResult = activeStreamResult;
                    const capturedAllStreamResults = [...allStreamResults];
                    const capturedToolCalls = [...toolCalls];
                    const capturedToolCallMap = new Map(toolCallMap);
                    const capturedFullOutput = fullOutput;
                    const capturedExecutionSteps = [...executionSteps];
                    const capturedStepCounter = stepCounter;
                    const capturedHasReceivedContent = hasReceivedContent;
                    const capturedStreamAttempt = streamAttempt;
                    const capturedAccumulatedInput = accumulatedInputTokens;
                    const capturedAccumulatedOutput = accumulatedOutputTokens;

                    // Fire-and-forget: run recording, usage tracking, evaluations
                    // This does NOT block the stream from closing.
                    void (async () => {
                        try {
                            // Aggregate usage data from ALL stream results (original + orphan recovery + continuations)
                            let usage: UsageLike | null = null;
                            try {
                                const aggregated: UsageLike = {
                                    promptTokens: 0,
                                    completionTokens: 0,
                                    totalTokens: 0,
                                    inputTokens: 0,
                                    outputTokens: 0,
                                    reasoningTokens: 0,
                                    cachedTokens: 0,
                                    cacheReadTokens: 0
                                };
                                let anyResolved = false;
                                let streamsWithoutUsage = 0;

                                for (const sr of capturedAllStreamResults) {
                                    if (!sr?.usage) {
                                        streamsWithoutUsage++;
                                        continue;
                                    }
                                    try {
                                        const resolved = await Promise.race([
                                            sr.usage,
                                            new Promise<null>((resolve) =>
                                                setTimeout(() => resolve(null), 15_000)
                                            )
                                        ]);
                                        if (resolved && typeof resolved === "object") {
                                            const u = resolved as UsageLike;
                                            aggregated.promptTokens! +=
                                                u.promptTokens ?? u.inputTokens ?? 0;
                                            aggregated.completionTokens! +=
                                                u.completionTokens ?? u.outputTokens ?? 0;
                                            aggregated.totalTokens! += u.totalTokens ?? 0;
                                            aggregated.reasoningTokens! += u.reasoningTokens ?? 0;
                                            aggregated.cachedTokens! +=
                                                u.cachedTokens ?? u.cacheReadTokens ?? 0;
                                            anyResolved = true;
                                        }
                                    } catch (usageErr) {
                                        console.warn(
                                            `[Agent Chat] Stream usage resolution failed for run ${capturedRun?.runId}:`,
                                            usageErr instanceof Error ? usageErr.message : usageErr
                                        );
                                    }
                                }

                                if (streamsWithoutUsage > 0) {
                                    console.warn(
                                        `[Agent Chat] ${streamsWithoutUsage}/${capturedAllStreamResults.length} stream(s) lacked .usage property for run ${capturedRun?.runId}`
                                    );
                                }

                                if (anyResolved) {
                                    usage = aggregated;
                                    if (capturedAllStreamResults.length > 1) {
                                        console.log(
                                            `[Agent Chat] Aggregated usage from ${capturedAllStreamResults.length} streams for run ${capturedRun?.runId}: ` +
                                                `in=${aggregated.promptTokens}, out=${aggregated.completionTokens}`
                                        );
                                    }
                                } else {
                                    console.warn(
                                        `[Agent Chat] No usage data resolved from ${capturedAllStreamResults.length} stream(s) for run ${capturedRun?.runId}`
                                    );
                                }
                            } catch (e) {
                                console.warn(
                                    `[Agent Chat] Usage data extraction failed for run ${capturedRun?.runId}:`,
                                    e
                                );
                            }

                            if (capturedToolCalls.length > 0) {
                                console.log(
                                    `[Agent Chat] Captured ${capturedToolCalls.length} tool calls:`,
                                    capturedToolCalls.map((tc) => tc.toolKey).join(", ")
                                );
                            }

                            // Detect tool calls that were initiated but never received a result
                            if (capturedToolCallMap.size > 0) {
                                const resolvedToolCallIds = new Set(
                                    capturedToolCalls.map((tc) => {
                                        for (const [
                                            callId,
                                            entry
                                        ] of capturedToolCallMap.entries()) {
                                            if (entry.toolName === tc.toolKey) return callId;
                                        }
                                        return null;
                                    })
                                );
                                for (const [callId, entry] of capturedToolCallMap.entries()) {
                                    if (!resolvedToolCallIds.has(callId)) {
                                        console.error(
                                            `[Agent Chat] ORPHANED TOOL CALL for run ${capturedRun?.runId}: ` +
                                                `tool="${entry.toolName}" callId="${callId}" was called but never received a tool-result or tool-error chunk. ` +
                                                `Stream used: ${capturedStreamResult?.fullStream ? "fullStream" : "textStream"}. ` +
                                                `Total captured results: ${capturedToolCalls.length}/${capturedToolCallMap.size}`
                                        );
                                    }
                                }
                            }

                            // Tool calls are already recorded to the DB during
                            // streaming (for live observability), so we skip
                            // duplicate recording here.

                            // Extract token counts: prefer .usage promise, fall back to
                            // per-step accumulated counts from finish-step events
                            let promptTokens = usage?.promptTokens ?? usage?.inputTokens ?? 0;
                            let completionTokens =
                                usage?.completionTokens ?? usage?.outputTokens ?? 0;
                            let totalTokens = usage?.totalTokens ?? 0;

                            if (totalTokens > 0 && promptTokens === 0 && completionTokens === 0) {
                                promptTokens = Math.round(totalTokens * 0.7);
                                completionTokens = totalTokens - promptTokens;
                            }

                            // Fallback: use per-step accumulated counts if .usage resolved empty
                            if (
                                promptTokens === 0 &&
                                completionTokens === 0 &&
                                (capturedAccumulatedInput > 0 || capturedAccumulatedOutput > 0)
                            ) {
                                console.log(
                                    `[Agent Chat] Using per-step accumulated tokens for run ${capturedRun?.runId}: ` +
                                        `in=${capturedAccumulatedInput}, out=${capturedAccumulatedOutput} ` +
                                        `(usage promise resolved: ${!!usage})`
                                );
                                promptTokens = capturedAccumulatedInput;
                                completionTokens = capturedAccumulatedOutput;
                                totalTokens = capturedAccumulatedInput + capturedAccumulatedOutput;
                            }

                            // Extract thinking and cached tokens for accurate cost calculation
                            const thinkingTokens = usage?.reasoningTokens ?? 0;
                            const cachedTokens = usage?.cachedTokens ?? usage?.cacheReadTokens ?? 0;
                            const cacheCreation = usage?.cacheCreationTokens ?? 0;

                            if (cacheCreation > 0 || cachedTokens > 0) {
                                console.log(
                                    `[Agent Chat] Cache stats for run ${capturedRun?.runId}: ` +
                                        `created=${cacheCreation}, read=${cachedTokens}, ` +
                                        `total_prompt=${promptTokens}, ` +
                                        `cache_rate=${((cachedTokens / Math.max(promptTokens, 1)) * 100).toFixed(1)}%`
                                );
                            }

                            const costUsd = calculateCostDetailed(
                                record?.modelName || "unknown",
                                record?.modelProvider || "unknown",
                                {
                                    promptTokens,
                                    completionTokens,
                                    thinkingTokens,
                                    cachedTokens,
                                    cacheCreationTokens: cacheCreation
                                }
                            );

                            // Post-stream output guardrail check (flag only -- tokens already sent)
                            if (agentId && capturedFullOutput) {
                                try {
                                    const { enforceOutputGuardrails } =
                                        await import("@repo/agentc2/guardrails");
                                    const guardrailResult = await enforceOutputGuardrails(
                                        agentId,
                                        capturedFullOutput,
                                        {
                                            runId: capturedRun?.runId,
                                            tenantId: record?.tenantId || undefined
                                        }
                                    );
                                    if (guardrailResult.blocked && capturedRun?.runId) {
                                        const secretViolation = guardrailResult.violations.find(
                                            (v) => v.guardrailKey === "output.secretLeakage"
                                        );
                                        if (secretViolation) {
                                            console.warn(
                                                `[Agent Chat] CREDENTIAL_LEAK detected on run ${capturedRun.runId}: ${secretViolation.message}`
                                            );
                                        }
                                    }
                                } catch (e) {
                                    console.warn("[Agent Chat] Output guardrail check failed:", e);
                                }
                            }

                            // Add final response step for time travel
                            capturedExecutionSteps.push({
                                step: capturedStepCounter + 1,
                                type: "response",
                                content:
                                    capturedFullOutput.slice(0, 2000) +
                                    (capturedFullOutput.length > 2000 ? "..." : ""),
                                timestamp: new Date().toISOString()
                            });

                            // Log turn-complete metadata if the finish-tool pattern was used
                            if (turnCompleteMetadata) {
                                console.log(
                                    `[Agent Chat] Turn completed via turn-complete tool:`,
                                    JSON.stringify(turnCompleteMetadata)
                                );
                            }

                            // Complete or fail the run
                            if (capturedRun) {
                                const actualModelProvider = routingDecision
                                    ? routingDecision.model.provider
                                    : modelOverride?.provider || record?.modelProvider || "unknown";
                                const actualModelName = routingDecision
                                    ? routingDecision.model.name
                                    : modelOverride?.name || record?.modelName || "unknown";

                                if (
                                    !capturedHasReceivedContent &&
                                    capturedToolCalls.length === 0 &&
                                    promptTokens === 0 &&
                                    completionTokens === 0
                                ) {
                                    // Enhanced diagnostics for zero-token failures
                                    console.error(
                                        `[Agent Chat] ZERO-TOKEN FAILURE for run ${capturedRun.runId}:`,
                                        JSON.stringify({
                                            agentSlug: id,
                                            model: `${actualModelProvider}/${actualModelName}`,
                                            threadId: userThreadId,
                                            inputLength: lastUserMessage?.length ?? 0,
                                            instructionsLength: mergedInstructions?.length ?? 0,
                                            instructionsHash: instructionsHash ?? "n/a",
                                            versionId: record?.version ?? "n/a",
                                            hasFullStream: !!capturedStreamResult?.fullStream,
                                            hasTextStream: !!capturedStreamResult?.textStream,
                                            usageResolved: !!usage,
                                            stepsCount: capturedExecutionSteps.length,
                                            retryAttempts: capturedStreamAttempt,
                                            memoryEnabled: record?.memoryEnabled ?? false,
                                            toolCount: toolCalls.length,
                                            modelConfig: record?.modelConfig ?? null,
                                            recoveryMessageSent: !!capturedFullOutput,
                                            readinessIssues: toolHealth?.readinessIssues ?? []
                                        })
                                    );

                                    // If recovery message was sent, record as completed (user got a response)
                                    if (capturedFullOutput) {
                                        await capturedRun.complete({
                                            output: capturedFullOutput,
                                            modelProvider: actualModelProvider,
                                            modelName: actualModelName,
                                            promptTokens,
                                            completionTokens,
                                            costUsd: 0,
                                            steps: [
                                                ...capturedExecutionSteps,
                                                {
                                                    step: capturedStepCounter + 2,
                                                    type: "response" as const,
                                                    content: `[Recovery] Empty response after ${capturedStreamAttempt + 1} attempt(s). Sent recovery message.`,
                                                    timestamp: new Date().toISOString()
                                                }
                                            ]
                                        });
                                    } else {
                                        await capturedRun.fail(
                                            "Empty response: agent produced no output, no tool calls, and zero tokens"
                                        );
                                    }
                                } else {
                                    console.log(
                                        `[Agent Chat] Usage summary for run ${capturedRun.runId}: ` +
                                            `streams=${capturedAllStreamResults.length}, ` +
                                            `prompt=${promptTokens}, completion=${completionTokens}, ` +
                                            `cached=${cachedTokens}, cost=$${costUsd.toFixed(4)}, ` +
                                            `model=${actualModelName}`
                                    );

                                    await capturedRun.complete({
                                        output: capturedFullOutput,
                                        modelProvider: actualModelProvider,
                                        modelName: actualModelName,
                                        promptTokens,
                                        completionTokens,
                                        costUsd,
                                        steps: capturedExecutionSteps,
                                        ...(routingDecision
                                            ? {
                                                  routingTier: routingDecision.tier,
                                                  routingReason: routingDecision.reason
                                              }
                                            : {})
                                    });

                                    console.log(`[Agent Chat] Completed run ${capturedRun.runId}`);
                                }
                            }
                        } catch (postStreamError) {
                            console.error(
                                "[Agent Chat] Post-stream bookkeeping error:",
                                postStreamError
                            );
                        }
                    })();
                } catch (streamError) {
                    const errorMsg =
                        streamError instanceof Error ? streamError.message : String(streamError);
                    const isToolNotFound =
                        /tool\s+\S+\s+not found/i.test(errorMsg) ||
                        /tool.*not found/i.test(errorMsg);

                    if (isToolNotFound) {
                        // Tool-not-found: write a helpful response instead of a hard failure.
                        // The user should see an explanation, not an opaque error.
                        console.warn(`[Agent Chat] Tool not found (recoverable): ${errorMsg}`);
                        const toolMatch = errorMsg.match(/tool\s+(\S+)/i);
                        const toolName = toolMatch?.[1] || "unknown";
                        const recoveryText =
                            `I attempted to use the tool "${toolName}" but it's currently unavailable ` +
                            `(the underlying service may be temporarily down). ` +
                            `Please try again in a moment, or let me know if there's an alternative ` +
                            `way I can help you.`;

                        if (!textState.currentId) {
                            const recoveryId = generateId();
                            writer.write({ type: "text-start", id: recoveryId });
                            textState.currentId = recoveryId;
                        }
                        writer.write({
                            type: "text-delta",
                            id: textState.currentId,
                            delta: recoveryText
                        });
                        writer.write({ type: "text-end", id: textState.currentId });
                        textState.currentId = null;
                        fullOutput = recoveryText;

                        // Record as COMPLETED with a note, not FAILED — the user got a response
                        if (run) {
                            await run.complete({
                                output: recoveryText,
                                steps: [
                                    ...executionSteps,
                                    {
                                        step: stepCounter + 1,
                                        type: "tool_result" as const,
                                        content: `[Recovery] Tool not found: ${errorMsg}. Returned graceful response.`,
                                        timestamp: new Date().toISOString()
                                    }
                                ]
                            });
                        }
                    } else {
                        console.error("[Agent Chat] Stream error:", streamError);

                        // Record the failure
                        if (run) {
                            await run.fail(
                                streamError instanceof Error ? streamError : String(streamError)
                            );
                        }

                        // Close any open text block before emitting error
                        if (textState.currentId) {
                            writer.write({ type: "text-end", id: textState.currentId });
                            textState.currentId = null;
                        }
                        writer.write({
                            type: "error",
                            errorText: errorMsg
                        });
                    }
                }
            },
            onError: (error: unknown) => {
                console.error(
                    "[Agent Chat] UIMessageStream error:",
                    error instanceof Error ? error.message : "[non-Error]"
                );
                // Record the failure
                if (run) {
                    run.fail(error instanceof Error ? error : String(error)).catch(console.error);
                }
                return error instanceof Error ? error.message : "Stream failed";
            }
        });

        return createUIMessageStreamResponse({ stream });
    } catch (error) {
        // Budget exceeded: return a valid stream with an inline upgrade prompt
        // instead of a 500 error. This is a key SaaS revenue touchpoint.
        // Use both instanceof AND property check (.code) as fallback since
        // instanceof can fail across Next.js chunk boundaries.
        const isBudgetError =
            error instanceof BudgetExceededError ||
            (error instanceof Error &&
                typeof (error as { code?: string }).code === "string" &&
                (error as { code?: string }).code === "BUDGET_EXCEEDED") ||
            (error instanceof Error && error.message.startsWith("Agent budget exceeded:"));

        if (isBudgetError) {
            // Extract budget data — try structured properties first, then parse from message
            let budgetData: {
                code: string;
                agentId: string;
                currentSpendUsd: number;
                monthlyLimitUsd: number;
                periodStart: string;
                periodEnd: string;
            };

            const typed = error as Partial<BudgetExceededError>;
            if (typeof typed.toJSON === "function") {
                budgetData = typed.toJSON();
            } else if (typed.agentId && typed.currentSpendUsd != null) {
                budgetData = {
                    code: "BUDGET_EXCEEDED",
                    agentId: typed.agentId,
                    currentSpendUsd: typed.currentSpendUsd,
                    monthlyLimitUsd: typed.monthlyLimitUsd ?? 0,
                    periodStart: typed.periodStart ?? new Date().toISOString(),
                    periodEnd: typed.periodEnd ?? new Date().toISOString()
                };
            } else {
                // Last resort: parse from error message "Agent budget exceeded: $109.94 / $100 monthly limit"
                const msg = (error as Error).message || "";
                const match = msg.match(
                    /Agent budget exceeded: \$([0-9.]+) \/ \$([0-9.]+) monthly limit/
                );
                budgetData = {
                    code: "BUDGET_EXCEEDED",
                    agentId: id,
                    currentSpendUsd: match ? parseFloat(match[1]) : 0,
                    monthlyLimitUsd: match ? parseFloat(match[2]) : 0,
                    periodStart: new Date().toISOString(),
                    periodEnd: new Date().toISOString()
                };
            }

            console.log(
                `[Agent Chat] Budget exceeded for agent ${budgetData.agentId}: $${budgetData.currentSpendUsd} / $${budgetData.monthlyLimitUsd}`
            );
            const budgetStream = createUIMessageStream({
                execute: async ({ writer }: { writer: UIMessageStreamWriter }) => {
                    const messageId = generateId();
                    writer.write({ type: "text-start", id: messageId });
                    writer.write({
                        type: "data-budget-exceeded",
                        data: budgetData
                    });
                    writer.write({ type: "text-end", id: messageId });
                }
            });
            return createUIMessageStreamResponse({ stream: budgetStream });
        }

        console.error(
            "[Agent Chat] Error:",
            error instanceof Error ? error.message : "[non-Error]"
        );
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to process chat request"
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/agents/[id]/chat
 * Retrieves message history for a specific agent's test thread
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const threadId = searchParams.get("threadId");

        if (!threadId) {
            return NextResponse.json([]);
        }

        const { agent } = await agentResolver.resolve({ slug: id });
        const memory = await agent?.getMemory();

        if (!memory) {
            return NextResponse.json([]);
        }

        const rawUserId2 = authContext.userId;
        const historyOrgId = authContext.organizationId || null;
        const historyResourceId = orgScopedResourceId(historyOrgId || "", rawUserId2);

        const result = await memory.recall({
            threadId,
            resourceId: historyResourceId
        });

        if (!result.messages || result.messages.length === 0) {
            return NextResponse.json([]);
        }

        const uiMessages = toAISdkV5Messages(result.messages);

        return NextResponse.json(uiMessages);
    } catch (error) {
        console.error("[Agent Chat History] Error:", error);
        return NextResponse.json([]);
    }
}
