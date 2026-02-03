import { toAISdkV5Messages } from "@mastra/ai-sdk/ui";
import {
    createUIMessageStream,
    createUIMessageStreamResponse,
    generateId,
    type UIMessageStreamWriter
} from "ai";
import { agentResolver, getScorersByNames } from "@repo/mastra";
import { prisma } from "@repo/database";
import { NextRequest, NextResponse } from "next/server";
import { startRun, type RunSource, type ToolCallData } from "@/lib/run-recorder";
import { calculateCost } from "@/lib/cost-calculator";

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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const scorer = config.scorer as any;

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
    try {
        const { id } = await params;
        const body = await request.json();
        const { threadId, requestContext, messages } = body;

        // Determine source based on mode parameter in requestContext
        // "live" mode = production run (PROD), otherwise test run (TEST)
        const mode = requestContext?.mode || "test";
        const runSource: RunSource = mode === "live" ? "api" : "test";

        // Create a thread ID for this session
        const userThreadId = threadId || `${runSource}-${id}-${Date.now()}`;
        const resourceId = requestContext?.userId || "test-user";

        // Resolve agent via AgentResolver (database-first, fallback to code-defined)
        // This is the same path used by production channels (Slack, WhatsApp, Voice)
        const { agent, record, source } = await agentResolver.resolve({
            slug: id,
            requestContext
        });

        console.log(`[Agent Chat] Resolved agent '${id}' from ${source} (mode: ${runSource})`);

        // Convert AI SDK v5 messages to get the last user message
        const lastUserMessage = messages
            ?.filter((m: { role: string }) => m.role === "user")
            .map((m: { content: string; parts?: Array<{ type: string; text?: string }> }) => {
                if (m.parts && Array.isArray(m.parts)) {
                    const textPart = m.parts.find((p) => p.type === "text");
                    return textPart?.text || "";
                }
                return m.content || "";
            })
            .pop();

        if (!lastUserMessage) {
            return NextResponse.json(
                { success: false, error: "No user message provided" },
                { status: 400 }
            );
        }

        // Get agent ID for recording - prefer database record ID, fallback to slug
        const agentId = record?.id || id;

        // Start recording the run
        const run = await startRun({
            agentId,
            agentSlug: id,
            input: lastUserMessage,
            source: runSource,
            userId: resourceId,
            threadId: userThreadId
        });

        console.log(`[Agent Chat] Started run ${run.runId} for agent ${id}`);

        // Use maxSteps from database record or default to 5 (matches production)
        const maxSteps = record?.maxSteps ?? 5;

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

        // Stream the response using the resolved agent
        const responseStream = await agent.stream(lastUserMessage, {
            maxSteps,
            memory: {
                thread: userThreadId,
                resource: resourceId
            }
        });

        // Create a UI message stream compatible with useChat
        const stream = createUIMessageStream({
            execute: async ({ writer }: { writer: UIMessageStreamWriter }) => {
                // Generate a unique message ID for this response
                const messageId = generateId();

                try {
                    // Start the text message
                    writer.write({
                        type: "text-start",
                        id: messageId
                    });

                    // Send run metadata so client can associate feedback with this run
                    // Using data-run-metadata as the type (data-${string} format)
                    writer.write({
                        type: "data-run-metadata",
                        data: { runId: run.runId, messageId }
                    });

                    // Use fullStream to capture ALL events including tool calls
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const fullStream = (responseStream as any).fullStream;
                    let chunkCount = 0;
                    if (fullStream) {
                        for await (const chunk of fullStream) {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const c = chunk as any;
                            chunkCount++;

                            // Log first few chunks and any non-text chunks for debugging
                            if (chunkCount <= 3 || (c.type && c.type !== "text-delta")) {
                                console.log(
                                    `[Agent Chat] Chunk #${chunkCount}: type=${c.type}, keys=${Object.keys(c).join(",")}`
                                );
                            }

                            // Handle text chunks
                            // Mastra fullStream wraps data in payload: chunk.payload.text
                            if (c.type === "text-delta") {
                                const text =
                                    c.payload?.text ||
                                    c.textDelta ||
                                    c.text ||
                                    c.delta ||
                                    c.content ||
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
                            }
                            // Handle tool calls
                            // Mastra fullStream: chunk.payload contains toolCallId, toolName, args
                            else if (c.type === "tool-call") {
                                // Log full structure to understand format
                                console.log(
                                    `[Agent Chat] Tool call chunk:`,
                                    JSON.stringify(c).slice(0, 500)
                                );
                                // Mastra wraps tool call data in payload
                                const payload = c.payload || c;
                                const toolName =
                                    payload.toolName ||
                                    payload.name ||
                                    c.toolName ||
                                    c.name ||
                                    "unknown";
                                const toolCallId =
                                    payload.toolCallId ||
                                    payload.id ||
                                    c.toolCallId ||
                                    c.id ||
                                    `tool-${Date.now()}`;
                                const args = payload.args || c.args || {};
                                console.log(
                                    `[Agent Chat] Extracted tool: ${toolName}, id: ${toolCallId}`
                                );
                                toolCallMap.set(toolCallId, {
                                    toolName,
                                    args,
                                    startTime: Date.now()
                                });

                                // Record execution step for time travel
                                stepCounter++;
                                executionSteps.push({
                                    step: stepCounter,
                                    type: "tool_call",
                                    content: `Calling tool: ${toolName}\nArgs: ${JSON.stringify(args, null, 2)}`,
                                    timestamp: new Date().toISOString()
                                });
                            }
                            // Handle tool results
                            // Mastra fullStream: chunk.payload contains toolCallId, toolName, result, error
                            else if (c.type === "tool-result") {
                                // Log full structure
                                console.log(
                                    `[Agent Chat] Tool result chunk:`,
                                    JSON.stringify(c).slice(0, 500)
                                );
                                // Mastra wraps tool result data in payload
                                const payload = c.payload || c;
                                const toolCallId =
                                    payload.toolCallId || payload.id || c.toolCallId || c.id;
                                const toolName = payload.toolName || c.toolName || "unknown";
                                const result = payload.result || c.result;
                                const error = payload.error || c.error;
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
                                    console.log(
                                        `[Agent Chat] Matched tool result: ${call.toolName}, ${durationMs}ms`
                                    );
                                } else {
                                    toolCalls.push({
                                        toolKey: toolName,
                                        input: {},
                                        output: result,
                                        success: !error,
                                        error: error
                                    });
                                    console.log(`[Agent Chat] Unmatched tool result: ${toolName}`);
                                }

                                // Record execution step for time travel
                                stepCounter++;
                                const resultPreview =
                                    typeof result === "string"
                                        ? result.slice(0, 500)
                                        : JSON.stringify(result, null, 2).slice(0, 500);
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
                        }
                    } else {
                        // Fallback to textStream if fullStream not available
                        for await (const chunk of responseStream.textStream) {
                            fullOutput += chunk;
                            writer.write({
                                type: "text-delta",
                                id: messageId,
                                delta: chunk
                            });
                        }
                    }

                    // End the text message
                    writer.write({
                        type: "text-end",
                        id: messageId
                    });

                    // Try to get final result with usage and tool calls
                    // MastraModelOutput provides promise-based access
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const streamResult = responseStream as any;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    let usage: any = null;

                    // Get usage data (Promise<LanguageModelUsage>)
                    try {
                        // Debug: Log available keys on stream result
                        console.log(`[Agent Chat] Stream result keys:`, Object.keys(streamResult));

                        if (streamResult.usage) {
                            usage = await streamResult.usage;
                            // Debug: Log full usage object structure
                            console.log(
                                `[Agent Chat] Usage object:`,
                                JSON.stringify(usage, null, 2)
                            );
                            console.log(`[Agent Chat] Usage keys:`, Object.keys(usage || {}));
                        }
                    } catch (e) {
                        console.log(`[Agent Chat] Could not get usage data: ${e}`);
                    }

                    // Tool calls are captured via onChunk callback above
                    // Log summary of captured tool calls
                    if (toolCalls.length > 0) {
                        console.log(
                            `[Agent Chat] Captured ${toolCalls.length} tool calls via onChunk:`,
                            toolCalls.map((tc) => tc.toolKey).join(", ")
                        );
                    }

                    // Record tool calls
                    for (const tc of toolCalls) {
                        await run.addToolCall(tc);
                    }

                    // Extract token counts
                    let promptTokens = usage?.promptTokens || usage?.inputTokens || 0;
                    let completionTokens = usage?.completionTokens || usage?.outputTokens || 0;
                    const totalTokens = usage?.totalTokens || 0;

                    // Fallback: If we have totalTokens but not individual counts, estimate them
                    // Typical ratio is ~70% prompt, ~30% completion for conversational AI
                    if (totalTokens > 0 && promptTokens === 0 && completionTokens === 0) {
                        promptTokens = Math.round(totalTokens * 0.7);
                        completionTokens = totalTokens - promptTokens;
                        console.log(
                            `[Agent Chat] Estimated tokens from total ${totalTokens}: prompt=${promptTokens}, completion=${completionTokens}`
                        );
                    }

                    // Calculate cost based on model and token usage
                    const costUsd = calculateCost(
                        record?.modelName || "unknown",
                        record?.modelProvider || "unknown",
                        promptTokens,
                        completionTokens
                    );

                    // Add final response step for time travel
                    stepCounter++;
                    executionSteps.push({
                        step: stepCounter,
                        type: "response",
                        content:
                            fullOutput.slice(0, 2000) + (fullOutput.length > 2000 ? "..." : ""),
                        timestamp: new Date().toISOString()
                    });

                    // Complete the run with the full output, cost, and execution steps
                    await run.complete({
                        output: fullOutput,
                        modelProvider: record?.modelProvider || "unknown",
                        modelName: record?.modelName || "unknown",
                        promptTokens,
                        completionTokens,
                        costUsd,
                        steps: executionSteps
                    });

                    console.log(`[Agent Chat] Completed run ${run.runId}`);

                    // Run evaluations asynchronously (don't await - fire and forget)
                    const scorerNames = record?.scorers || [];
                    if (scorerNames.length > 0) {
                        runEvaluationsAsync(
                            run.runId,
                            agentId,
                            scorerNames,
                            lastUserMessage,
                            fullOutput
                        ).catch(console.error);
                    }
                } catch (streamError) {
                    console.error("[Agent Chat] Stream error:", streamError);

                    // Record the failure
                    await run.fail(
                        streamError instanceof Error ? streamError : String(streamError)
                    );

                    writer.write({
                        type: "error",
                        errorText:
                            streamError instanceof Error ? streamError.message : "Stream failed"
                    });
                }
            },
            onError: (error: unknown) => {
                console.error("[Agent Chat] UIMessageStream error:", error);
                // Record the failure
                run.fail(error instanceof Error ? error : String(error)).catch(console.error);
                return error instanceof Error ? error.message : "Stream failed";
            }
        });

        return createUIMessageStreamResponse({ stream });
    } catch (error) {
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
