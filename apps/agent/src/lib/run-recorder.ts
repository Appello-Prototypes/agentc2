/**
 * Run Recorder Service
 *
 * Centralized service for recording agent runs from all production channels.
 * Creates AgentRun, AgentTrace, and AgentToolCall records for full observability.
 *
 * Usage:
 * ```typescript
 * const run = await startRun({
 *   agentId: "...",
 *   agentSlug: "mcp-agent",
 *   input: "User's question",
 *   source: "slack",
 *   threadId: "slack-thread-123"
 * });
 *
 * // After agent.generate() completes:
 * await run.complete({
 *   output: response.text,
 *   modelProvider: "anthropic",
 *   modelName: "claude-sonnet-4-20250514",
 *   promptTokens: 1000,
 *   completionTokens: 200,
 *   costUsd: 0.05
 * });
 *
 * // Or if it fails:
 * await run.fail(error);
 * ```
 */

import { prisma, Prisma, RunStatus, RunTriggerType } from "@repo/database";
import { inngest } from "./inngest";
import { recordActivity, inputPreview } from "@repo/mastra/activity/service";

/**
 * Source of the agent run (which production channel)
 */
export type RunSource =
    | "slack"
    | "whatsapp"
    | "voice"
    | "telegram"
    | "elevenlabs"
    | "api"
    | "webhook"
    | "test"
    | "simulation"
    | "embed"
    | "event"
    | "mcp"
    | "manual"
    | "schedule";

/**
 * Options for starting a new run
 */
export interface StartRunOptions {
    /** Agent database ID */
    agentId: string;
    /** Agent slug for logging */
    agentSlug: string;
    /** User input/question */
    input: string;
    /** Source channel */
    source: RunSource;
    /** Optional agent version ID */
    versionId?: string;
    /** Optional user ID */
    userId?: string;
    /** Optional thread/conversation ID for grouping */
    threadId?: string;
    /** Optional session ID for channel sessions */
    sessionId?: string;
    /** Optional tenant ID for multi-tenancy */
    tenantId?: string;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
    triggerType?: RunTriggerType;
    triggerId?: string;
    initialStatus?: RunStatus;
    /** Active skills at run time [{skillId, skillSlug, skillVersion}] */
    skillsJson?: unknown;
    /** Tool origin map for attribution (toolKey -> "registry" | "mcp:server" | "skill:slug") */
    toolOriginMap?: Record<string, string>;
    /** SHA-256 hash of merged instructions (base + skills) */
    instructionsHash?: string;
    /** Full merged instructions text for audit */
    instructionsSnapshot?: string;
}

/**
 * Options for completing a run
 */
export interface CompleteRunOptions {
    /** Agent's output/response */
    output: string;
    /** Model provider used */
    modelProvider?: string;
    /** Model name used */
    modelName?: string;
    /** Prompt tokens consumed */
    promptTokens?: number;
    /** Completion tokens generated */
    completionTokens?: number;
    /** Total cost in USD */
    costUsd?: number;
    /** Execution steps for trace */
    steps?: ExecutionStep[];
    /** Scores from evaluations */
    scores?: Record<string, number>;
    /** Model routing tier (FAST | PRIMARY | ESCALATION) */
    routingTier?: string;
    /** Reason for routing decision */
    routingReason?: string;
}

/**
 * Tool call data for recording
 */
export interface ToolCallData {
    /** Tool name/key */
    toolKey: string;
    /** MCP server ID if applicable */
    mcpServerId?: string;
    /** Input parameters */
    input?: Record<string, unknown>;
    /** Output result */
    output?: unknown;
    /** Whether the call succeeded */
    success: boolean;
    /** Error message if failed */
    error?: string;
    /** Execution time in ms */
    durationMs?: number;
}

/**
 * Execution step for tracing
 */
export interface ExecutionStep {
    /** Step number */
    step: number;
    /** Step type */
    type: "thinking" | "tool_call" | "tool_result" | "response";
    /** Content/description */
    content: string;
    /** Timestamp */
    timestamp: string;
    /** Tool call details if applicable */
    toolCall?: ToolCallData;
}

/**
 * Result from startRun with methods to complete/fail the run
 */
export interface RunRecorderHandle {
    /** The run ID */
    runId: string;
    /** The trace ID */
    traceId: string;
    /** Complete the run with output */
    complete: (options: CompleteRunOptions) => Promise<void>;
    /** Mark the run as failed */
    fail: (error: Error | string) => Promise<void>;
    /** Add a tool call record */
    addToolCall: (toolCall: ToolCallData) => Promise<void>;
}

// ─── Conversation-level run types ────────────────────────────────────────────

/**
 * Handle for a conversation-level turn within a run.
 * Returned by startConversationRun() and addTurn().
 */
export interface TurnHandle {
    /** The run ID (conversation) */
    runId: string;
    /** The turn ID */
    turnId: string;
    /** The turn index (0-based) */
    turnIndex: number;
    /** The trace ID */
    traceId: string;
    /** Complete this turn with output and metrics */
    completeTurn: (options: CompleteRunOptions) => Promise<void>;
    /** Mark this turn as failed */
    failTurn: (error: Error | string) => Promise<void>;
    /** Add a tool call record for this turn */
    addToolCall: (toolCall: ToolCallData) => Promise<void>;
}

/**
 * Handle for a conversation-level run.
 * Returned by startConversationRun().
 */
export interface ConversationRunHandle extends TurnHandle {
    /** Add a new turn to the conversation (subsequent messages) */
    addTurn: (input: string) => Promise<TurnHandle>;
    /** Finalize the conversation run (sets COMPLETED, fires run/completed) */
    finalizeRun: () => Promise<void>;
}

/**
 * Options for continuing a conversation run with addTurn.
 */
export interface ContinueTurnOptions {
    /** Existing run ID from a previous startConversationRun() */
    runId: string;
    /** User input for this turn */
    input: string;
    /** Agent ID for lookups */
    agentId: string;
    /** Agent slug for logging */
    agentSlug: string;
    /** Tool origin map */
    toolOriginMap?: Record<string, string>;
    /** Tenant ID */
    tenantId?: string;
}

/**
 * Start recording a new agent run
 *
 * Creates AgentRun and AgentTrace records in RUNNING status.
 * Returns a handle with methods to complete, fail, or add tool calls.
 */
export async function startRun(options: StartRunOptions): Promise<RunRecorderHandle> {
    const startTime = Date.now();

    // Create the run and trace in a transaction
    const { run, trace } = await prisma.$transaction(async (tx) => {
        const resolvedVersionId =
            options.versionId ||
            (await (async () => {
                const agent = await tx.agent.findUnique({
                    where: { id: options.agentId },
                    select: { version: true }
                });
                if (!agent) return null;
                const version = await tx.agentVersion.findFirst({
                    where: { agentId: options.agentId, version: agent.version },
                    select: { id: true }
                });
                return version?.id || null;
            })());

        // Create AgentRun with RUNNING status
        const agentRun = await tx.agentRun.create({
            data: {
                agentId: options.agentId,
                tenantId: options.tenantId,
                runType: options.source === "test" ? "TEST" : "PROD",
                status: options.initialStatus ?? RunStatus.RUNNING,
                inputText: options.input,
                startedAt: new Date(),
                userId: options.userId,
                versionId: resolvedVersionId,
                // New fields for source tracking
                source: options.source,
                triggerType: options.triggerType,
                triggerId: options.triggerId,
                sessionId: options.sessionId,
                threadId: options.threadId,
                // Skills active at run time
                skillsJson: options.skillsJson ?? undefined
            }
        });

        // Create linked AgentTrace
        const agentTrace = await tx.agentTrace.create({
            data: {
                runId: agentRun.id,
                agentId: options.agentId,
                tenantId: options.tenantId,
                status: "RUNNING",
                inputText: options.input,
                stepsJson: [],
                modelJson: {},
                tokensJson: {},
                instructionsHash: options.instructionsHash,
                instructionsSnapshot: options.instructionsSnapshot
            }
        });

        return { run: agentRun, trace: agentTrace };
    });

    console.log(
        `[RunRecorder] Started run ${run.id} for agent ${options.agentSlug} from ${options.source}`
    );

    // Record to Activity Feed
    recordActivity({
        type: "RUN_STARTED",
        agentId: options.agentId,
        agentSlug: options.agentSlug,
        summary: `${options.agentSlug} started: ${inputPreview(options.input)}`,
        status: "info",
        source: options.source || "api",
        runId: run.id,
        tenantId: options.tenantId
    });

    // Track tool calls in memory for step synthesis
    const recordedToolCalls: ToolCallData[] = [];

    // Return handle with completion methods
    return {
        runId: run.id,
        traceId: trace.id,

        /**
         * Complete the run with output and metrics
         */
        async complete(completeOptions: CompleteRunOptions): Promise<void> {
            const durationMs = Date.now() - startTime;
            const totalTokens =
                (completeOptions.promptTokens || 0) + (completeOptions.completionTokens || 0);

            // Auto-synthesize steps from recorded tool calls if no explicit steps provided
            const steps = completeOptions.steps ? [...completeOptions.steps] : [];
            if (steps.length === 0 && recordedToolCalls.length > 0) {
                let stepNum = 1;
                for (const tc of recordedToolCalls) {
                    steps.push({
                        step: stepNum++,
                        type: "tool_call",
                        content: `Called tool: ${tc.toolKey}${tc.input ? ` with ${JSON.stringify(tc.input).slice(0, 200)}` : ""}`,
                        timestamp: new Date().toISOString()
                    });
                    steps.push({
                        step: stepNum++,
                        type: "tool_result",
                        content: tc.success
                            ? `Tool ${tc.toolKey} succeeded${tc.output ? `: ${JSON.stringify(tc.output).slice(0, 200)}` : ""}`
                            : `Tool ${tc.toolKey} failed: ${tc.error || "Unknown error"}`,
                        timestamp: new Date().toISOString()
                    });
                }
                if (completeOptions.output) {
                    steps.push({
                        step: stepNum++,
                        type: "response",
                        content: completeOptions.output.slice(0, 500),
                        timestamp: new Date().toISOString()
                    });
                }
            }

            await prisma.$transaction(async (tx) => {
                // Update AgentRun
                await tx.agentRun.update({
                    where: { id: run.id },
                    data: {
                        status: "COMPLETED",
                        outputText: completeOptions.output,
                        durationMs,
                        completedAt: new Date(),
                        modelProvider: completeOptions.modelProvider,
                        modelName: completeOptions.modelName,
                        promptTokens: completeOptions.promptTokens,
                        completionTokens: completeOptions.completionTokens,
                        totalTokens,
                        costUsd: completeOptions.costUsd
                    }
                });

                // Update AgentTrace
                await tx.agentTrace.update({
                    where: { id: trace.id },
                    data: {
                        status: "COMPLETED",
                        outputText: completeOptions.output,
                        durationMs,
                        stepsJson: (steps || []) as unknown as Prisma.JsonArray,
                        modelJson: {
                            provider: completeOptions.modelProvider,
                            name: completeOptions.modelName,
                            ...(completeOptions.routingTier
                                ? {
                                      routingTier: completeOptions.routingTier,
                                      routingReason: completeOptions.routingReason
                                  }
                                : {})
                        },
                        tokensJson: {
                            prompt: completeOptions.promptTokens || 0,
                            completion: completeOptions.completionTokens || 0,
                            total: totalTokens
                        },
                        scoresJson: completeOptions.scores || {}
                    }
                });

                // Create CostEvent if cost is tracked
                if (
                    completeOptions.costUsd &&
                    completeOptions.modelProvider &&
                    completeOptions.modelName
                ) {
                    await tx.costEvent.create({
                        data: {
                            runId: run.id,
                            agentId: options.agentId,
                            tenantId: options.tenantId,
                            provider: completeOptions.modelProvider,
                            modelName: completeOptions.modelName,
                            promptTokens: completeOptions.promptTokens,
                            completionTokens: completeOptions.completionTokens,
                            totalTokens,
                            costUsd: completeOptions.costUsd
                        }
                    });
                }

                // Create evaluation record if scores provided
                if (completeOptions.scores && Object.keys(completeOptions.scores).length > 0) {
                    await tx.agentEvaluation.create({
                        data: {
                            runId: run.id,
                            agentId: options.agentId,
                            tenantId: options.tenantId,
                            scoresJson: completeOptions.scores
                        }
                    });
                }
            });

            // Emit run/completed event to trigger full pipeline (evaluations, learning, etc.)
            try {
                await inngest.send({
                    name: "run/completed",
                    data: {
                        runId: run.id,
                        agentId: options.agentId,
                        status: "COMPLETED",
                        durationMs,
                        totalTokens,
                        costUsd: completeOptions.costUsd
                    }
                });
            } catch (inngestError) {
                // Log but don't fail the run if Inngest is unavailable
                console.warn(`[RunRecorder] Failed to emit run/completed event: ${inngestError}`);
            }

            console.log(
                `[RunRecorder] Completed run ${run.id} in ${durationMs}ms (${totalTokens} tokens)`
            );

            // Record to Activity Feed
            recordActivity({
                type: "RUN_COMPLETED",
                agentId: options.agentId,
                agentSlug: options.agentSlug,
                summary: `${options.agentSlug} completed: ${inputPreview(options.input)}`,
                detail: completeOptions.output,
                status: "success",
                source: options.source,
                runId: run.id,
                costUsd: completeOptions.costUsd,
                durationMs,
                tokenCount: totalTokens,
                tenantId: options.tenantId
            });
        },

        /**
         * Mark the run as failed
         */
        async fail(error: Error | string): Promise<void> {
            const durationMs = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : error;

            await prisma.$transaction(async (tx) => {
                await tx.agentRun.update({
                    where: { id: run.id },
                    data: {
                        status: "FAILED",
                        outputText: `Error: ${errorMessage}`,
                        durationMs,
                        completedAt: new Date()
                    }
                });

                await tx.agentTrace.update({
                    where: { id: trace.id },
                    data: {
                        status: "FAILED",
                        outputText: `Error: ${errorMessage}`,
                        durationMs
                    }
                });
            });

            console.error(`[RunRecorder] Run ${run.id} failed: ${errorMessage}`);

            // Record to Activity Feed
            recordActivity({
                type: "RUN_FAILED",
                agentId: options.agentId,
                agentSlug: options.agentSlug,
                summary: `${options.agentSlug} failed: ${inputPreview(errorMessage, 120)}`,
                detail: errorMessage,
                status: "failure",
                source: options.source,
                runId: run.id,
                durationMs,
                tenantId: options.tenantId
            });
        },

        /**
         * Record a tool call
         */
        async addToolCall(toolCall: ToolCallData): Promise<void> {
            // Track in memory for step synthesis on complete()
            recordedToolCalls.push(toolCall);

            // Resolve tool source from origin map if not explicitly set
            const toolOriginMap = options.toolOriginMap;
            let toolSource = toolCall.mcpServerId ? `mcp:${toolCall.mcpServerId}` : undefined;
            let mcpServerId = toolCall.mcpServerId;

            if (toolOriginMap && toolCall.toolKey in toolOriginMap) {
                toolSource = toolOriginMap[toolCall.toolKey];
                // Extract mcpServerId from origin if it's an MCP tool
                if (toolSource?.startsWith("mcp:") && !mcpServerId) {
                    mcpServerId = toolSource.replace("mcp:", "");
                }
            }

            await prisma.agentToolCall.create({
                data: {
                    runId: run.id,
                    traceId: trace.id,
                    tenantId: options.tenantId,
                    toolKey: toolCall.toolKey,
                    mcpServerId,
                    toolSource,
                    inputJson: (toolCall.input || {}) as Prisma.InputJsonValue,
                    outputJson:
                        toolCall.output !== undefined
                            ? (toolCall.output as Prisma.InputJsonValue)
                            : undefined,
                    success: toolCall.success,
                    error: toolCall.error,
                    durationMs: toolCall.durationMs
                }
            });
        }
    };
}

/**
 * Utility to extract token usage from agent response
 *
 * Handles both AI SDK v4 (promptTokens/completionTokens) and v5/v6 (inputTokens/outputTokens).
 * For multi-step generations, prioritizes totalUsage over usage (last step only).
 */
export function extractTokenUsage(response: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    usage?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    totalUsage?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    steps?: any[];
}): { promptTokens: number; completionTokens: number; totalTokens: number } | null {
    // Prefer totalUsage (aggregated across all steps) over usage (last step only)
    const usage = response.totalUsage || response.usage;

    // If still nothing, try to aggregate from steps array
    if (!usage && response.steps?.length) {
        let inputTokens = 0;
        let outputTokens = 0;
        for (const step of response.steps) {
            if (step.usage) {
                inputTokens += step.usage.inputTokens || step.usage.promptTokens || 0;
                outputTokens += step.usage.outputTokens || step.usage.completionTokens || 0;
            }
        }
        if (inputTokens > 0 || outputTokens > 0) {
            return {
                promptTokens: inputTokens,
                completionTokens: outputTokens,
                totalTokens: inputTokens + outputTokens
            };
        }
    }

    if (!usage) return null;

    // AI SDK v5/v6 uses inputTokens/outputTokens, v4 uses promptTokens/completionTokens
    const promptTokens = usage.inputTokens || usage.promptTokens || 0;
    const completionTokens = usage.outputTokens || usage.completionTokens || 0;
    const totalTokens = usage.totalTokens || promptTokens + completionTokens;

    return { promptTokens, completionTokens, totalTokens };
}

/**
 * Utility to extract tool calls from agent response
 */
export function extractToolCalls(response: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toolCalls?: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toolResults?: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    steps?: any[];
}): ToolCallData[] {
    const normalizeArgs = (value: unknown): Record<string, unknown> => {
        if (!value || typeof value !== "object") return {};
        return value as Record<string, unknown>;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resolveToolName = (value?: any) => {
        return (
            value?.toolName ||
            value?.name ||
            value?.tool ||
            value?.function?.name ||
            value?.payload?.toolName ||
            value?.payload?.tool ||
            value?.payload?.name ||
            value?.payload?.function?.name
        );
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resolveArgs = (value?: any) => {
        const args =
            value?.args ||
            value?.input ||
            value?.arguments ||
            value?.function?.arguments ||
            value?.payload?.args ||
            value?.payload?.arguments;
        if (typeof args === "string") {
            try {
                return JSON.parse(args);
            } catch {
                return {};
            }
        }
        return normalizeArgs(args);
    };

    const mapToolCalls = (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toolCalls?: any[],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toolResults?: any[]
    ): ToolCallData[] => {
        if (!Array.isArray(toolCalls) || toolCalls.length === 0) return [];

        return toolCalls.map((tc, i) => {
            const tr = toolResults?.[i];
            const payload = tr?.payload;
            return {
                toolKey:
                    resolveToolName(tc) ||
                    resolveToolName(tr) ||
                    resolveToolName(payload) ||
                    "unknown",
                input: resolveArgs(tc) || resolveArgs(payload),
                output: tr?.result ?? tr?.output ?? payload?.result ?? tr,
                success: !(tr?.error || payload?.error),
                error: tr?.error || payload?.error
            };
        });
    };

    const directCalls = mapToolCalls(response.toolCalls, response.toolResults);
    if (directCalls.length > 0) {
        return directCalls;
    }

    if (!Array.isArray(response.steps) || response.steps.length === 0) {
        return [];
    }

    const calls: Array<{ id?: string; toolKey: string; input: Record<string, unknown> }> = [];
    const resultsById = new Map<
        string,
        { result?: unknown; error?: string; toolKey?: string; input?: Record<string, unknown> }
    >();
    const resultsByIndex: Array<{
        result?: unknown;
        error?: string;
        toolKey?: string;
        input?: Record<string, unknown>;
    }> = [];

    for (const step of response.steps) {
        const stepToolCalls = Array.isArray(step?.toolCalls) ? step.toolCalls : [];
        const stepToolResults = Array.isArray(step?.toolResults) ? step.toolResults : [];

        for (const tc of stepToolCalls) {
            calls.push({
                id: tc?.toolCallId || tc?.id,
                toolKey: resolveToolName(tc) || "unknown",
                input: resolveArgs(tc)
            });
        }

        for (const tr of stepToolResults) {
            const id = tr?.toolCallId || tr?.id || tr?.payload?.toolCallId;
            const entry = {
                result: tr?.result ?? tr?.output ?? tr?.payload?.result ?? tr,
                error: tr?.error || tr?.payload?.error,
                toolKey: resolveToolName(tr) || resolveToolName(tr?.payload),
                input: resolveArgs(tr) || resolveArgs(tr?.payload)
            };
            if (id) {
                resultsById.set(id, entry);
            } else {
                resultsByIndex.push(entry);
            }
        }

        if (step?.toolCall) {
            const tc = step.toolCall;
            calls.push({
                id: tc?.toolCallId || tc?.id,
                toolKey: resolveToolName(tc) || "unknown",
                input: resolveArgs(tc)
            });
        }

        if (step?.toolResult) {
            const tr = step.toolResult;
            const id = tr?.toolCallId || tr?.id || tr?.payload?.toolCallId;
            const entry = {
                result: tr?.result ?? tr?.output ?? tr?.payload?.result ?? tr,
                error: tr?.error || tr?.payload?.error,
                toolKey: resolveToolName(tr) || resolveToolName(tr?.payload),
                input: resolveArgs(tr) || resolveArgs(tr?.payload)
            };
            if (id) {
                resultsById.set(id, entry);
            } else {
                resultsByIndex.push(entry);
            }
        }
    }

    const resolvedCalls =
        calls.length > 0
            ? calls
            : resultsByIndex.map((entry) => ({
                  toolKey: entry.toolKey || "unknown",
                  input: entry.input || {}
              }));

    return resolvedCalls.map((call, index) => {
        const callId = "id" in call ? (call as { id?: string }).id : undefined;
        const resultEntry = (callId && resultsById.get(callId)) || resultsByIndex[index];
        return {
            toolKey:
                call.toolKey === "unknown" && resultEntry?.toolKey
                    ? resultEntry.toolKey
                    : call.toolKey,
            input:
                Object.keys(call.input).length === 0 && resultEntry?.input
                    ? resultEntry.input
                    : call.input,
            output: resultEntry?.result,
            success: !resultEntry?.error,
            error: resultEntry?.error
        };
    });
}

// ─── Conversation-level Run Functions ────────────────────────────────────────

/**
 * Helper: build turn handle methods for a given turn within a conversation run.
 */
function buildTurnMethods(
    runId: string,
    turnId: string,
    turnIndex: number,
    traceId: string,
    agentId: string,
    agentSlug: string,
    startTime: number,
    toolOriginMap?: Record<string, string>,
    tenantId?: string
): {
    completeTurn: TurnHandle["completeTurn"];
    failTurn: TurnHandle["failTurn"];
    addToolCall: TurnHandle["addToolCall"];
} {
    const recordedToolCalls: ToolCallData[] = [];

    return {
        async completeTurn(completeOptions: CompleteRunOptions): Promise<void> {
            const durationMs = Date.now() - startTime;
            const totalTokens =
                (completeOptions.promptTokens || 0) + (completeOptions.completionTokens || 0);

            // Build steps for this turn
            const steps = completeOptions.steps ? [...completeOptions.steps] : [];
            if (steps.length === 0 && recordedToolCalls.length > 0) {
                let stepNum = 1;
                for (const tc of recordedToolCalls) {
                    steps.push({
                        step: stepNum++,
                        type: "tool_call",
                        content: `Called tool: ${tc.toolKey}${tc.input ? ` with ${JSON.stringify(tc.input).slice(0, 200)}` : ""}`,
                        timestamp: new Date().toISOString()
                    });
                    steps.push({
                        step: stepNum++,
                        type: "tool_result",
                        content: tc.success
                            ? `Tool ${tc.toolKey} succeeded${tc.output ? `: ${JSON.stringify(tc.output).slice(0, 200)}` : ""}`
                            : `Tool ${tc.toolKey} failed: ${tc.error || "Unknown error"}`,
                        timestamp: new Date().toISOString()
                    });
                }
                if (completeOptions.output) {
                    steps.push({
                        step: stepNum++,
                        type: "response",
                        content: completeOptions.output.slice(0, 500),
                        timestamp: new Date().toISOString()
                    });
                }
            }

            await prisma.$transaction(async (tx) => {
                // Update the turn record
                await tx.agentRunTurn.update({
                    where: { id: turnId },
                    data: {
                        outputText: completeOptions.output,
                        durationMs,
                        completedAt: new Date(),
                        promptTokens: completeOptions.promptTokens,
                        completionTokens: completeOptions.completionTokens,
                        totalTokens,
                        costUsd: completeOptions.costUsd,
                        modelProvider: completeOptions.modelProvider,
                        modelName: completeOptions.modelName,
                        stepsJson: (steps || []) as unknown as Prisma.JsonArray
                    }
                });

                // Re-aggregate AgentRun totals from all turns
                const allTurns = await tx.agentRunTurn.findMany({
                    where: { runId },
                    select: {
                        promptTokens: true,
                        completionTokens: true,
                        totalTokens: true,
                        costUsd: true,
                        outputText: true,
                        startedAt: true,
                        completedAt: true
                    },
                    orderBy: { turnIndex: "asc" }
                });

                const aggPrompt = allTurns.reduce((s, t) => s + (t.promptTokens || 0), 0);
                const aggCompletion = allTurns.reduce((s, t) => s + (t.completionTokens || 0), 0);
                const aggCost = allTurns.reduce((s, t) => s + (t.costUsd || 0), 0);
                const lastTurn = allTurns[allTurns.length - 1];
                const firstTurn = allTurns[0];
                const aggDuration =
                    firstTurn && lastTurn?.completedAt
                        ? lastTurn.completedAt.getTime() - firstTurn.startedAt.getTime()
                        : undefined;

                await tx.agentRun.update({
                    where: { id: runId },
                    data: {
                        outputText: lastTurn?.outputText || completeOptions.output,
                        promptTokens: aggPrompt,
                        completionTokens: aggCompletion,
                        totalTokens: aggPrompt + aggCompletion,
                        costUsd: aggCost,
                        durationMs: aggDuration,
                        modelProvider: completeOptions.modelProvider,
                        modelName: completeOptions.modelName
                    }
                });

                // Create CostEvent for this turn
                if (
                    completeOptions.costUsd &&
                    completeOptions.modelProvider &&
                    completeOptions.modelName
                ) {
                    await tx.costEvent.create({
                        data: {
                            runId,
                            turnId,
                            agentId,
                            tenantId,
                            provider: completeOptions.modelProvider,
                            modelName: completeOptions.modelName,
                            promptTokens: completeOptions.promptTokens,
                            completionTokens: completeOptions.completionTokens,
                            totalTokens,
                            costUsd: completeOptions.costUsd
                        }
                    });
                }
            });

            console.log(
                `[RunRecorder] Completed turn ${turnIndex} of run ${runId} in ${durationMs}ms (${totalTokens} tokens)`
            );
        },

        async failTurn(error: Error | string): Promise<void> {
            const durationMs = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : error;

            await prisma.$transaction(async (tx) => {
                await tx.agentRunTurn.update({
                    where: { id: turnId },
                    data: {
                        outputText: `Error: ${errorMessage}`,
                        durationMs,
                        completedAt: new Date()
                    }
                });

                // Update the run's outputText to reflect the error
                await tx.agentRun.update({
                    where: { id: runId },
                    data: {
                        outputText: `Error: ${errorMessage}`
                    }
                });
            });

            console.error(
                `[RunRecorder] Turn ${turnIndex} of run ${runId} failed: ${errorMessage}`
            );
        },

        async addToolCall(toolCall: ToolCallData): Promise<void> {
            recordedToolCalls.push(toolCall);

            // Resolve tool source from origin map
            let toolSource = toolCall.mcpServerId ? `mcp:${toolCall.mcpServerId}` : undefined;
            let mcpServerId = toolCall.mcpServerId;

            if (toolOriginMap && toolCall.toolKey in toolOriginMap) {
                toolSource = toolOriginMap[toolCall.toolKey];
                if (toolSource?.startsWith("mcp:") && !mcpServerId) {
                    mcpServerId = toolSource.replace("mcp:", "");
                }
            }

            await prisma.agentToolCall.create({
                data: {
                    runId,
                    turnId,
                    traceId,
                    tenantId,
                    toolKey: toolCall.toolKey,
                    mcpServerId,
                    toolSource,
                    inputJson: (toolCall.input || {}) as Prisma.InputJsonValue,
                    outputJson:
                        toolCall.output !== undefined
                            ? (toolCall.output as Prisma.InputJsonValue)
                            : undefined,
                    success: toolCall.success,
                    error: toolCall.error,
                    durationMs: toolCall.durationMs
                }
            });
        }
    };
}

/**
 * Start a conversation-level run (One Run = One Conversation).
 * Creates AgentRun + AgentRunTurn (turn 0) + AgentTrace.
 *
 * Used by the chat UI. Non-chat channels continue using startRun().
 */
export async function startConversationRun(
    options: StartRunOptions
): Promise<ConversationRunHandle> {
    const startTime = Date.now();

    const { run, turn, trace } = await prisma.$transaction(async (tx) => {
        // Resolve version
        const resolvedVersionId =
            options.versionId ||
            (await (async () => {
                const agent = await tx.agent.findUnique({
                    where: { id: options.agentId },
                    select: { version: true }
                });
                if (!agent) return null;
                const version = await tx.agentVersion.findFirst({
                    where: { agentId: options.agentId, version: agent.version },
                    select: { id: true }
                });
                return version?.id || null;
            })());

        // Create AgentRun (conversation-level, RUNNING until finalized)
        const agentRun = await tx.agentRun.create({
            data: {
                agentId: options.agentId,
                tenantId: options.tenantId,
                runType: options.source === "test" ? "TEST" : "PROD",
                status: RunStatus.RUNNING,
                inputText: options.input,
                startedAt: new Date(),
                userId: options.userId,
                versionId: resolvedVersionId,
                turnCount: 1,
                source: options.source,
                triggerType: options.triggerType,
                triggerId: options.triggerId,
                sessionId: options.sessionId,
                threadId: options.threadId,
                skillsJson: options.skillsJson ?? undefined
            }
        });

        // Create first turn (index 0)
        const agentRunTurn = await tx.agentRunTurn.create({
            data: {
                runId: agentRun.id,
                turnIndex: 0,
                inputText: options.input,
                startedAt: new Date()
            }
        });

        // Create AgentTrace (conversation-level)
        const agentTrace = await tx.agentTrace.create({
            data: {
                runId: agentRun.id,
                agentId: options.agentId,
                tenantId: options.tenantId,
                status: "RUNNING",
                inputText: options.input,
                stepsJson: [],
                modelJson: {},
                tokensJson: {},
                instructionsHash: options.instructionsHash,
                instructionsSnapshot: options.instructionsSnapshot
            }
        });

        return { run: agentRun, turn: agentRunTurn, trace: agentTrace };
    });

    console.log(
        `[RunRecorder] Started conversation run ${run.id} (turn 0: ${turn.id}) for agent ${options.agentSlug} from ${options.source}`
    );

    // Record to Activity Feed
    recordActivity({
        type: "RUN_STARTED",
        agentId: options.agentId,
        agentSlug: options.agentSlug,
        summary: `${options.agentSlug} conversation started: ${inputPreview(options.input)}`,
        status: "info",
        source: options.source || "chat",
        runId: run.id,
        tenantId: options.tenantId
    });

    const turnMethods = buildTurnMethods(
        run.id,
        turn.id,
        0,
        trace.id,
        options.agentId,
        options.agentSlug,
        startTime,
        options.toolOriginMap,
        options.tenantId
    );

    return {
        runId: run.id,
        turnId: turn.id,
        turnIndex: 0,
        traceId: trace.id,
        ...turnMethods,

        async addTurn(input: string): Promise<TurnHandle> {
            const turnStartTime = Date.now();

            const { newTurn, newTurnCount } = await prisma.$transaction(async (tx) => {
                // Get current turn count
                const currentRun = await tx.agentRun.findUniqueOrThrow({
                    where: { id: run.id },
                    select: { turnCount: true }
                });

                const newIndex = currentRun.turnCount;

                // Create new turn
                const createdTurn = await tx.agentRunTurn.create({
                    data: {
                        runId: run.id,
                        turnIndex: newIndex,
                        inputText: input,
                        startedAt: new Date()
                    }
                });

                // Increment turn count
                await tx.agentRun.update({
                    where: { id: run.id },
                    data: { turnCount: newIndex + 1 }
                });

                return { newTurn: createdTurn, newTurnCount: newIndex + 1 };
            });

            console.log(
                `[RunRecorder] Added turn ${newTurn.turnIndex} (${newTurn.id}) to run ${run.id} (total: ${newTurnCount})`
            );

            const newTurnMethods = buildTurnMethods(
                run.id,
                newTurn.id,
                newTurn.turnIndex,
                trace.id,
                options.agentId,
                options.agentSlug,
                turnStartTime,
                options.toolOriginMap,
                options.tenantId
            );

            return {
                runId: run.id,
                turnId: newTurn.id,
                turnIndex: newTurn.turnIndex,
                traceId: trace.id,
                ...newTurnMethods
            };
        },

        async finalizeRun(): Promise<void> {
            await prisma.$transaction(async (tx) => {
                // Gather all turn steps for the unified trace
                const allTurns = await tx.agentRunTurn.findMany({
                    where: { runId: run.id },
                    orderBy: { turnIndex: "asc" },
                    select: { turnIndex: true, stepsJson: true, inputText: true, outputText: true }
                });

                // Build unified stepsJson for the trace
                const unifiedSteps: unknown[] = [];
                for (const t of allTurns) {
                    if (Array.isArray(t.stepsJson)) {
                        for (const step of t.stepsJson as unknown[]) {
                            unifiedSteps.push(step);
                        }
                    }
                }

                // Get final aggregates
                const agg = await tx.agentRunTurn.aggregate({
                    where: { runId: run.id },
                    _sum: {
                        promptTokens: true,
                        completionTokens: true,
                        totalTokens: true,
                        costUsd: true
                    }
                });

                await tx.agentRun.update({
                    where: { id: run.id },
                    data: {
                        status: "COMPLETED",
                        completedAt: new Date(),
                        promptTokens: agg._sum.promptTokens || 0,
                        completionTokens: agg._sum.completionTokens || 0,
                        totalTokens: agg._sum.totalTokens || 0,
                        costUsd: agg._sum.costUsd || 0
                    }
                });

                await tx.agentTrace.update({
                    where: { id: trace.id },
                    data: {
                        status: "COMPLETED",
                        outputText: allTurns[allTurns.length - 1]?.outputText,
                        stepsJson: unifiedSteps as unknown as Prisma.JsonArray,
                        tokensJson: {
                            prompt: agg._sum.promptTokens || 0,
                            completion: agg._sum.completionTokens || 0,
                            total: agg._sum.totalTokens || 0
                        }
                    }
                });
            });

            // Fire run/completed event for evaluations, learning, etc.
            try {
                await inngest.send({
                    name: "run/completed",
                    data: {
                        runId: run.id,
                        agentId: options.agentId,
                        status: "COMPLETED",
                        isConversation: true
                    }
                });
            } catch (inngestError) {
                console.warn(
                    `[RunRecorder] Failed to emit run/completed for conversation: ${inngestError}`
                );
            }

            console.log(`[RunRecorder] Finalized conversation run ${run.id}`);
        }
    };
}

/**
 * Continue an existing conversation run by adding a new turn.
 * Used when the frontend sends a runId for subsequent messages.
 */
export async function continueTurn(options: ContinueTurnOptions): Promise<TurnHandle> {
    const turnStartTime = Date.now();

    const { newTurn, traceId } = await prisma.$transaction(async (tx) => {
        // Get current run state
        const currentRun = await tx.agentRun.findUniqueOrThrow({
            where: { id: options.runId },
            select: { turnCount: true, status: true }
        });

        if (currentRun.status === "COMPLETED" || currentRun.status === "FAILED") {
            throw new Error(`Cannot add turn to ${currentRun.status} run ${options.runId}`);
        }

        const newIndex = currentRun.turnCount;

        // Create new turn
        const createdTurn = await tx.agentRunTurn.create({
            data: {
                runId: options.runId,
                turnIndex: newIndex,
                inputText: options.input,
                startedAt: new Date()
            }
        });

        // Increment turn count
        await tx.agentRun.update({
            where: { id: options.runId },
            data: { turnCount: newIndex + 1 }
        });

        // Get the trace ID
        const trace = await tx.agentTrace.findFirst({
            where: { runId: options.runId },
            select: { id: true }
        });

        return { newTurn: createdTurn, traceId: trace?.id || "" };
    });

    console.log(
        `[RunRecorder] Continued run ${options.runId} with turn ${newTurn.turnIndex} (${newTurn.id})`
    );

    const turnMethods = buildTurnMethods(
        options.runId,
        newTurn.id,
        newTurn.turnIndex,
        traceId,
        options.agentId,
        options.agentSlug,
        turnStartTime,
        options.toolOriginMap,
        options.tenantId
    );

    return {
        runId: options.runId,
        turnId: newTurn.id,
        turnIndex: newTurn.turnIndex,
        traceId,
        ...turnMethods
    };
}

/**
 * Finalize an existing conversation run by ID.
 * Sets status to COMPLETED and fires run/completed event.
 * Idempotent: no-op if already COMPLETED.
 */
export async function finalizeConversationRun(runId: string): Promise<boolean> {
    const run = await prisma.agentRun.findUnique({
        where: { id: runId },
        select: { status: true, agentId: true, turnCount: true }
    });

    if (!run) {
        console.warn(`[RunRecorder] Cannot finalize: run ${runId} not found`);
        return false;
    }

    if (run.status === "COMPLETED" || run.status === "FAILED" || run.status === "CANCELLED") {
        // Already finalized, no-op
        return true;
    }

    await prisma.$transaction(async (tx) => {
        // Gather all turn steps for the unified trace
        const allTurns = await tx.agentRunTurn.findMany({
            where: { runId },
            orderBy: { turnIndex: "asc" },
            select: { stepsJson: true, outputText: true }
        });

        const unifiedSteps: unknown[] = [];
        for (const t of allTurns) {
            if (Array.isArray(t.stepsJson)) {
                for (const step of t.stepsJson as unknown[]) {
                    unifiedSteps.push(step);
                }
            }
        }

        // Get final aggregates
        const agg = await tx.agentRunTurn.aggregate({
            where: { runId },
            _sum: {
                promptTokens: true,
                completionTokens: true,
                totalTokens: true,
                costUsd: true
            }
        });

        await tx.agentRun.update({
            where: { id: runId },
            data: {
                status: "COMPLETED",
                completedAt: new Date(),
                promptTokens: agg._sum.promptTokens || 0,
                completionTokens: agg._sum.completionTokens || 0,
                totalTokens: agg._sum.totalTokens || 0,
                costUsd: agg._sum.costUsd || 0
            }
        });

        // Update trace
        const trace = await tx.agentTrace.findFirst({
            where: { runId },
            select: { id: true }
        });

        if (trace) {
            await tx.agentTrace.update({
                where: { id: trace.id },
                data: {
                    status: "COMPLETED",
                    outputText: allTurns[allTurns.length - 1]?.outputText,
                    stepsJson: unifiedSteps as unknown as Prisma.JsonArray,
                    tokensJson: {
                        prompt: agg._sum.promptTokens || 0,
                        completion: agg._sum.completionTokens || 0,
                        total: agg._sum.totalTokens || 0
                    }
                }
            });
        }
    });

    // Fire run/completed event
    try {
        await inngest.send({
            name: "run/completed",
            data: {
                runId,
                agentId: run.agentId,
                status: "COMPLETED",
                isConversation: true,
                turnCount: run.turnCount
            }
        });
    } catch (inngestError) {
        console.warn(`[RunRecorder] Failed to emit run/completed for finalize: ${inngestError}`);
    }

    // Record to Activity Feed
    recordActivity({
        type: "RUN_COMPLETED",
        agentId: run.agentId,
        summary: `Conversation run finalized (${run.turnCount || 0} turns)`,
        status: "success",
        source: "chat",
        runId
    });

    console.log(`[RunRecorder] Finalized conversation run ${runId}`);
    return true;
}
