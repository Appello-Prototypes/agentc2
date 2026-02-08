import {
    createUIMessageStream,
    createUIMessageStreamResponse,
    generateId,
    type UIMessageStreamWriter
} from "ai";
import { headers } from "next/headers";
import { agentResolver } from "@repo/mastra";
import { auth } from "@repo/auth";
import { NextRequest, NextResponse } from "next/server";
import {
    startRun,
    type RunSource,
    type RunRecorderHandle,
    type ToolCallData
} from "@/lib/run-recorder";
import { calculateCost } from "@/lib/cost-calculator";
import { getUserOrganizationId } from "@/lib/organization";

/**
 * The slug of the database-driven webhook wizard agent.
 * Must match the slug in seed-agents.ts.
 */
const WEBHOOK_WIZARD_SLUG = "webhook-wizard";

/**
 * POST /api/webhooks/chat
 *
 * Conversational AI endpoint for creating webhooks.
 * Uses the database-driven webhook-wizard agent via agentResolver,
 * with full run recording for traceability and auditability.
 */
export async function POST(request: NextRequest) {
    try {
        // Authenticate and resolve user's organization
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;
        const organizationId = await getUserOrganizationId(userId);
        if (!organizationId) {
            return NextResponse.json(
                { success: false, error: "Organization membership required" },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { threadId, messages } = body;

        const userThreadId = threadId || `webhook-wizard-${userId}-${Date.now()}`;
        const resourceId = userId;

        // Resolve the webhook-wizard agent from the database
        const { agent, record, source } = await agentResolver.resolve({
            slug: WEBHOOK_WIZARD_SLUG,
            requestContext: { userId }
        });

        console.log(
            `[Webhook Chat] Resolved agent '${WEBHOOK_WIZARD_SLUG}' from ${source} for user ${userId} (org: ${organizationId})`
        );

        // Extract last user message
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

        // Start recording the run (only if agent exists in database)
        const agentId = record?.id || null;
        let run: RunRecorderHandle | null = null;
        const runSource: RunSource = "api";

        if (agentId) {
            run = await startRun({
                agentId,
                agentSlug: WEBHOOK_WIZARD_SLUG,
                input: lastUserMessage,
                source: runSource,
                userId: resourceId,
                threadId: userThreadId
            });
            console.log(`[Webhook Chat] Started run ${run.runId} for agent ${WEBHOOK_WIZARD_SLUG}`);
        }

        const maxSteps = record?.maxSteps ?? 5;

        // Collect output and tool calls for recording
        let fullOutput = "";
        const toolCalls: ToolCallData[] = [];
        const toolCallMap = new Map<
            string,
            {
                toolName: string;
                args: Record<string, unknown>;
                startTime: number;
            }
        >();

        // Stream the response using the resolved agent.
        // Inject organizationId as system context so the agent passes it to webhook-create.
        const messageWithContext = `[System context: organizationId="${organizationId}"]\n\n${lastUserMessage}`;

        const responseStream = await agent.stream(messageWithContext, {
            maxSteps,
            memory: {
                thread: userThreadId,
                resource: resourceId
            }
        });

        // Create a UI message stream compatible with useChat
        const stream = createUIMessageStream({
            execute: async ({ writer }: { writer: UIMessageStreamWriter }) => {
                const messageId = generateId();

                try {
                    writer.write({ type: "text-start", id: messageId });

                    if (run) {
                        writer.write({
                            type: "data-run-metadata",
                            data: { runId: run.runId, messageId }
                        });
                    }

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const fullStream = (responseStream as any).fullStream;

                    if (fullStream) {
                        for await (const chunk of fullStream) {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const c = chunk as any;

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
                            } else if (c.type === "tool-call") {
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
                                toolCallMap.set(toolCallId, {
                                    toolName,
                                    args,
                                    startTime: Date.now()
                                });
                            } else if (c.type === "tool-result") {
                                const payload = c.payload || c;
                                const toolCallId =
                                    payload.toolCallId || payload.id || c.toolCallId || c.id;
                                const toolName = payload.toolName || c.toolName || "unknown";
                                const result = payload.result || c.result;
                                const error = payload.error || c.error;
                                const call = toolCallMap.get(toolCallId);

                                if (call) {
                                    toolCalls.push({
                                        toolKey: call.toolName,
                                        input: call.args,
                                        output: result,
                                        success: !error,
                                        error: error,
                                        durationMs: Date.now() - call.startTime
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
                            }
                        }
                    } else {
                        for await (const chunk of responseStream.textStream) {
                            fullOutput += chunk;
                            writer.write({
                                type: "text-delta",
                                id: messageId,
                                delta: chunk
                            });
                        }
                    }

                    writer.write({ type: "text-end", id: messageId });

                    // Record tool calls
                    if (run) {
                        for (const tc of toolCalls) {
                            await run.addToolCall(tc);
                        }
                    }

                    // Get usage data
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const streamResult = responseStream as any;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    let usage: any = null;
                    try {
                        if (streamResult.usage) {
                            usage = await streamResult.usage;
                        }
                    } catch {
                        // Usage not available
                    }

                    const promptTokens = usage?.promptTokens || usage?.inputTokens || 0;
                    const completionTokens = usage?.completionTokens || usage?.outputTokens || 0;

                    const costUsd = calculateCost(
                        record?.modelName || "gpt-4o-mini",
                        record?.modelProvider || "openai",
                        promptTokens,
                        completionTokens
                    );

                    if (run) {
                        await run.complete({
                            output: fullOutput,
                            modelProvider: record?.modelProvider || "openai",
                            modelName: record?.modelName || "gpt-4o-mini",
                            promptTokens,
                            completionTokens,
                            costUsd,
                            steps: []
                        });
                        console.log(`[Webhook Chat] Completed run ${run.runId}`);
                    }
                } catch (streamError) {
                    console.error("[Webhook Chat] Stream error:", streamError);

                    if (run) {
                        await run.fail(
                            streamError instanceof Error ? streamError : String(streamError)
                        );
                    }

                    writer.write({
                        type: "error",
                        errorText:
                            streamError instanceof Error ? streamError.message : "Stream failed"
                    });
                }
            },
            onError: (error: unknown) => {
                console.error("[Webhook Chat] UIMessageStream error:", error);
                if (run) {
                    run.fail(error instanceof Error ? error : String(error)).catch(console.error);
                }
                return error instanceof Error ? error.message : "Stream failed";
            }
        });

        return createUIMessageStreamResponse({ stream });
    } catch (error) {
        console.error("[Webhook Chat] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to process chat"
            },
            { status: 500 }
        );
    }
}
