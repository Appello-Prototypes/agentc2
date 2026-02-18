import { createHash } from "crypto";
import { toAISdkV5Messages } from "@mastra/ai-sdk/ui";
import {
    createUIMessageStream,
    createUIMessageStreamResponse,
    generateId,
    type UIMessageStreamWriter
} from "ai";
import {
    agentResolver,
    BudgetExceededError,
    resolveRoutingDecision,
    type RoutingConfig,
    type RoutingDecision
} from "@repo/mastra/agents";
import { getScorersByNames } from "@repo/mastra/scorers/registry";
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
import { calculateCost } from "@/lib/cost-calculator";
import { createTriggerEventRecord } from "@/lib/trigger-events";
import { getUserOrganizationId, getDefaultWorkspaceIdForUser } from "@/lib/organization";
import { requireAgentAccess, requireAuth } from "@/lib/authz";
import { checkRateLimit } from "@/lib/rate-limit";
import { RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit-policy";
import { enforceCsrf } from "@/lib/security/http-security";

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

type ScorerRunner = {
    run?: (options: {
        input: { inputMessages: Array<{ role: string; content: string }> };
        output: Array<{ role: string; content: string }>;
    }) => Promise<{ score?: number; reason?: string }>;
};

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
};

type UsageLike = {
    promptTokens?: number;
    inputTokens?: number;
    completionTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
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
 * Run evaluations asynchronously after chat completes
 * This doesn't block the response to the user
 *
 * Mastra scorers expect:
 * - input: { inputMessages: [{ role: "user", content: string }] }
 * - output: [{ role: "assistant", content: string }]
 */
async function runEvaluationsAsync(
    runId: string,
    agentId: string,
    scorerNames: string[],
    inputText: string,
    outputText: string
): Promise<void> {
    try {
        if (scorerNames.length === 0) {
            console.log(`[Agent Chat] No scorers configured for run ${runId}`);
            return;
        }

        console.log(`[Agent Chat] Running ${scorerNames.length} evaluations for run ${runId}`);

        const scorers = getScorersByNames(scorerNames);
        const scores: Record<string, number> = {};

        // Format input/output as Mastra expects (message arrays)
        const input = {
            inputMessages: [{ role: "user", content: inputText }]
        };
        const output = [{ role: "assistant", content: outputText }];

        // Run each scorer - Mastra scorers use .run() method
        for (const [name, config] of Object.entries(scorers)) {
            try {
                const scorer = config.scorer as unknown as ScorerRunner;

                // Mastra scorers have a .run() method
                if (scorer && typeof scorer.run === "function") {
                    const result = await scorer.run({ input, output });
                    scores[name] = result.score ?? 0;
                    console.log(
                        `[Agent Chat] Scorer ${name}: ${scores[name].toFixed(2)} - ${result.reason?.slice(0, 100) || ""}`
                    );
                }
            } catch (scorerError) {
                console.error(`[Agent Chat] Scorer ${name} failed:`, scorerError);
            }
        }

        // Only upsert if we have valid scores
        if (Object.keys(scores).length > 0) {
            await prisma.agentEvaluation.upsert({
                where: { runId },
                create: {
                    runId,
                    agentId,
                    scoresJson: scores
                },
                update: {
                    scoresJson: scores
                }
            });

            console.log(`[Agent Chat] Evaluations complete for run ${runId}:`, scores);
        } else {
            console.log(`[Agent Chat] No valid evaluation scores for run ${runId}`);
        }
    } catch (error) {
        console.error(`[Agent Chat] Evaluation failed for run ${runId}:`, error);
    }
}

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
        const accessResult = await requireAgentAccess(authResult.context.organizationId, id);
        if (accessResult.response) {
            return accessResult.response;
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
            runId: existingRunId,
            interactionMode
        } = body;

        // Determine source based on mode parameter in requestContext
        // "live" mode = production run (PROD), otherwise test run (TEST)
        const mode = requestContext?.mode || "test";
        const runSource: RunSource = mode === "live" ? "api" : "test";

        // Create a thread ID for this session
        const userThreadId = threadId || `${runSource}-${id}-${Date.now()}`;
        const resourceId = requestContext?.userId || "test-user";

        // Resolve organization and workspace context for the user
        let resolvedOrgId: string | null = null;
        let enrichedRequestContext = requestContext;
        const tOrg = performance.now();
        if (resourceId && resourceId !== "test-user" && resourceId !== "chat-user") {
            const [orgId, workspaceId] = await Promise.all([
                getUserOrganizationId(resourceId),
                getDefaultWorkspaceIdForUser(resourceId)
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
        timing.orgResolve = Math.round(performance.now() - tOrg);

        // Resolve agent via AgentResolver (database-first, fallback to code-defined)
        // This is the same path used by production channels (Slack, WhatsApp, Voice)
        const tResolve = performance.now();
        // eslint-disable-next-line prefer-const
        let { agent, record, source, activeSkills, toolOriginMap, toolHealth } =
            await agentResolver.resolve({
                slug: id,
                requestContext: enrichedRequestContext,
                threadId: userThreadId
            });
        timing.agentResolve = Math.round(performance.now() - tResolve);

        console.log(
            `[Agent Chat] Received slug param: '${id}', resolved agent: '${record?.slug || id}' (${record?.name || "fallback"}) from ${source} (mode: ${runSource})`
        );

        // ── Model Routing ───────────────────────────────────────────────────
        // Note: Model routing and interaction mode previously tried to reconstruct
        // the Agent via `new AgentClass(...)`, but Mastra's Agent doesn't expose its
        // internal config. Reconstructing loses tools, memory, and skills.
        // Instead, we log the routing decision and use the resolved agent as-is.
        // The resolved agent from agentResolver already has the correct model.
        let routingDecision: RoutingDecision | null = null;

        if (modelOverride && modelOverride.provider && modelOverride.name) {
            console.log(
                `[Agent Chat] Model override requested: ${modelOverride.provider}/${modelOverride.name} (using resolved agent's model instead — override requires agent rebuild)`
            );
        } else if (record) {
            const routingConfig = record.routingConfig as RoutingConfig | null;
            if (routingConfig?.mode === "auto") {
                const lastMsg = messages
                    ?.filter((m: { role: string }) => m.role === "user")
                    .pop() as
                    | { content?: string; parts?: Array<{ type: string; text?: string }> }
                    | undefined;
                let inputForRouting = "";
                if (lastMsg?.parts && Array.isArray(lastMsg.parts)) {
                    for (const part of lastMsg.parts) {
                        if (part.type === "text" && part.text) inputForRouting = part.text;
                    }
                } else if (lastMsg?.content) {
                    inputForRouting = lastMsg.content;
                }

                if (inputForRouting) {
                    routingDecision = resolveRoutingDecision(
                        routingConfig,
                        { provider: record.modelProvider, name: record.modelName },
                        inputForRouting
                    );
                    console.log(
                        `[Agent Chat] Model routing decision: ${routingDecision?.tier || "PRIMARY"} (${routingDecision?.reason || "default"})`
                    );
                }
            }
        }

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
            const { enforceInputGuardrails } = await import("@repo/mastra/guardrails");
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

        // Build execution steps for time-travel debugging
        type ExecutionStep = {
            step: number;
            type: "thinking" | "tool_call" | "tool_result" | "response";
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
        const tStream = performance.now();
        let responseStream;
        try {
            responseStream = await agent.stream(streamInput, {
                maxSteps,
                memory: {
                    thread: userThreadId,
                    resource: resourceId
                }
            });
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

                try {
                    // Start the text message immediately
                    writer.write({
                        type: "text-start",
                        id: messageId
                    });

                    // Send run metadata once the handle resolves (non-blocking for text streaming).
                    // We wait briefly for the run handle, but don't block if it's not ready yet.
                    if (runReady) {
                        await runReady;
                    }
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

                    // Use fullStream to capture ALL events including tool calls
                    const streamResult = responseStream as unknown as StreamResult;
                    const fullStream = streamResult.fullStream;
                    const textStream = streamResult.textStream;
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

                            // Stream tool invocation to frontend
                            writer.write({
                                type: "tool-input-available",
                                toolCallId,
                                toolName,
                                input: args
                            });

                            stepCounter++;
                            executionSteps.push({
                                step: stepCounter,
                                type: "tool_call",
                                content: `Calling tool: ${toolName}\nArgs: ${JSON.stringify(args, null, 2)}`,
                                timestamp: new Date().toISOString()
                            });
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

                            // Stream tool result to frontend
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

                            stepCounter++;
                            const resultPreview = formatToolResultPreview(result, 500);
                            executionSteps.push({
                                step: stepCounter,
                                type: "tool_result",
                                content: error
                                    ? `Tool ${call?.toolName || toolName} failed: ${error}`
                                    : `Tool ${call?.toolName || toolName} result:\n${resultPreview}${resultPreview.length >= 500 ? "..." : ""}`,
                                timestamp: new Date().toISOString(),
                                durationMs
                            });
                        }
                    };

                    if (fullStream && textStream) {
                        // Drain tool events from fullStream in the background.
                        // Tool calls complete before the final text chunk, so they'll
                        // be captured before we snapshot. Remaining fullStream events
                        // (usage stats, finish reasons) should NOT block the response.
                        void (async () => {
                            try {
                                for await (const chunk of fullStream) {
                                    const c = normalizeChunk(chunk);
                                    handleToolChunk(c);
                                }
                            } catch (e) {
                                console.error("[Agent Chat] fullStream background drain error:", e);
                            }
                        })();

                        for await (const chunk of textStream) {
                            fullOutput += chunk;
                            writer.write({
                                type: "text-delta",
                                id: messageId,
                                delta: chunk
                            });
                        }
                    } else if (fullStream) {
                        for await (const chunk of fullStream) {
                            const c = normalizeChunk(chunk);

                            if (c.type === "text-delta") {
                                const text =
                                    (typeof c.payload?.text === "string" && c.payload.text) ||
                                    (typeof c.textDelta === "string" && c.textDelta) ||
                                    (typeof c.text === "string" && c.text) ||
                                    (typeof c.delta === "string" && c.delta) ||
                                    (typeof c.content === "string" && c.content) ||
                                    (typeof c.value === "string" ? c.value : "") ||
                                    "";
                                if (text) {
                                    fullOutput += text;
                                    writer.write({
                                        type: "text-delta",
                                        id: messageId,
                                        delta: text
                                    });
                                }
                            } else {
                                handleToolChunk(c);
                            }
                        }
                    } else {
                        for await (const chunk of textStream) {
                            fullOutput += chunk;
                            writer.write({
                                type: "text-delta",
                                id: messageId,
                                delta: chunk
                            });
                        }
                    }

                    // End the text message -- this is the last thing the client needs.
                    // All post-stream bookkeeping (usage, run recording, evals) runs
                    // fire-and-forget so the stream closes immediately and the UI unlocks.
                    writer.write({
                        type: "text-end",
                        id: messageId
                    });

                    // Snapshot values needed by post-stream work (closures)
                    const capturedRun = run;
                    const capturedStreamResult = streamResult;
                    const capturedToolCalls = [...toolCalls];
                    const capturedFullOutput = fullOutput;
                    const capturedExecutionSteps = [...executionSteps];
                    const capturedStepCounter = stepCounter;

                    // Fire-and-forget: run recording, usage tracking, evaluations
                    // This does NOT block the stream from closing.
                    void (async () => {
                        try {
                            // Get usage data
                            let usage: UsageLike | null = null;
                            try {
                                if (capturedStreamResult?.usage) {
                                    const resolvedUsage = await capturedStreamResult.usage;
                                    usage =
                                        resolvedUsage && typeof resolvedUsage === "object"
                                            ? (resolvedUsage as UsageLike)
                                            : null;
                                }
                            } catch (e) {
                                console.log(`[Agent Chat] Could not get usage data: ${e}`);
                            }

                            if (capturedToolCalls.length > 0) {
                                console.log(
                                    `[Agent Chat] Captured ${capturedToolCalls.length} tool calls:`,
                                    capturedToolCalls.map((tc) => tc.toolKey).join(", ")
                                );
                            }

                            // Record tool calls
                            if (capturedRun) {
                                for (const tc of capturedToolCalls) {
                                    await capturedRun.addToolCall(tc);
                                }
                            }

                            // Extract token counts
                            let promptTokens = usage?.promptTokens || usage?.inputTokens || 0;
                            let completionTokens =
                                usage?.completionTokens || usage?.outputTokens || 0;
                            const totalTokens = usage?.totalTokens || 0;

                            if (totalTokens > 0 && promptTokens === 0 && completionTokens === 0) {
                                promptTokens = Math.round(totalTokens * 0.7);
                                completionTokens = totalTokens - promptTokens;
                            }

                            const costUsd = calculateCost(
                                record?.modelName || "unknown",
                                record?.modelProvider || "unknown",
                                promptTokens,
                                completionTokens
                            );

                            // Post-stream output guardrail check (flag only -- tokens already sent)
                            if (agentId && capturedFullOutput) {
                                try {
                                    const { enforceOutputGuardrails } =
                                        await import("@repo/mastra/guardrails");
                                    await enforceOutputGuardrails(agentId, capturedFullOutput, {
                                        runId: capturedRun?.runId,
                                        tenantId: record?.tenantId || undefined
                                    });
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

                            // Complete the run
                            if (capturedRun) {
                                const actualModelProvider = routingDecision
                                    ? routingDecision.model.provider
                                    : modelOverride?.provider || record?.modelProvider || "unknown";
                                const actualModelName = routingDecision
                                    ? routingDecision.model.name
                                    : modelOverride?.name || record?.modelName || "unknown";

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

                            // Run evaluations
                            if (capturedRun && agentId) {
                                const scorerNames = record?.scorers || [];
                                if (scorerNames.length > 0) {
                                    runEvaluationsAsync(
                                        capturedRun.runId,
                                        agentId,
                                        scorerNames,
                                        lastUserMessage,
                                        capturedFullOutput
                                    ).catch(console.error);
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

                        writer.write({
                            type: "text-delta",
                            id: messageId,
                            delta: recoveryText
                        });
                        writer.write({ type: "text-end", id: messageId });
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

                        writer.write({
                            type: "error",
                            errorText: errorMsg
                        });
                    }
                }
            },
            onError: (error: unknown) => {
                console.error("[Agent Chat] UIMessageStream error:", error);
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

        console.error("[Agent Chat] Error:", error);
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
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const threadId = searchParams.get("threadId");

        if (!threadId) {
            return NextResponse.json([]);
        }

        // Resolve the agent using AgentResolver
        const { agent } = await agentResolver.resolve({ slug: id });
        const memory = await agent?.getMemory();

        if (!memory) {
            return NextResponse.json([]);
        }

        const resourceId = searchParams.get("userId") || "test-user";

        // Get messages from the thread using recall
        const result = await memory.recall({
            threadId,
            resourceId
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
