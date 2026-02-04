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

import { prisma, Prisma } from "@repo/database";
import { inngest } from "./inngest";

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
    | "test"
    | "simulation";

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
                status: "RUNNING",
                inputText: options.input,
                startedAt: new Date(),
                userId: options.userId,
                versionId: resolvedVersionId,
                // New fields for source tracking
                source: options.source,
                sessionId: options.sessionId,
                threadId: options.threadId
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
                tokensJson: {}
            }
        });

        return { run: agentRun, trace: agentTrace };
    });

    console.log(
        `[RunRecorder] Started run ${run.id} for agent ${options.agentSlug} from ${options.source}`
    );

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
                        stepsJson: (completeOptions.steps || []) as unknown as Prisma.JsonArray,
                        modelJson: {
                            provider: completeOptions.modelProvider,
                            name: completeOptions.modelName
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
        },

        /**
         * Record a tool call
         */
        async addToolCall(toolCall: ToolCallData): Promise<void> {
            await prisma.agentToolCall.create({
                data: {
                    runId: run.id,
                    traceId: trace.id,
                    tenantId: options.tenantId,
                    toolKey: toolCall.toolKey,
                    mcpServerId: toolCall.mcpServerId,
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
