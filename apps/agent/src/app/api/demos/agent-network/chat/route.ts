import { NextRequest, NextResponse } from "next/server";
import { networkResolver } from "@repo/agentc2/agents";
import { getDemoSession } from "@/lib/standalone-auth";

/**
 * Agent Network Chat API Route
 *
 * Chat interface for the trip planner that uses database-driven agents.
 * The NetworkResolver loads sub-agents from the database dynamically,
 * enabling runtime configuration of agent behavior.
 *
 * Supports two modes:
 * - useNetwork=true: Full network orchestration with agent delegation
 * - useNetwork=false: Direct agent streaming (simpler, faster for basic queries)
 */
export async function POST(req: NextRequest) {
    const encoder = new TextEncoder();

    try {
        const session = await getDemoSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { message, threadId, resourceId, useNetwork = false } = await req.json();

        if (!message) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        // Get the trip planner network with database-driven sub-agents
        const agent = await networkResolver.getTripPlannerNetwork();
        if (!agent) {
            return NextResponse.json(
                { error: "Failed to initialize Trip Planner network" },
                { status: 500 }
            );
        }

        const effectiveThreadId = threadId || `thread-${Date.now()}`;
        const effectiveResourceId = resourceId || session.user.id;

        const stream = new ReadableStream({
            async start(controller) {
                const sendEvent = (event: string, data: unknown) => {
                    controller.enqueue(encoder.encode(`event: ${event}\n`));
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                };

                try {
                    sendEvent("start", {
                        threadId: effectiveThreadId,
                        resourceId: effectiveResourceId,
                        timestamp: Date.now()
                    });

                    if (useNetwork) {
                        // Use full network orchestration
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const result = await (agent as any).network(message, {
                            threadId: effectiveThreadId,
                            resourceId: effectiveResourceId
                        });

                        let fullText = "";

                        for await (const chunk of result) {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const chunkAny = chunk as any;
                            // Send network events
                            sendEvent("network-event", {
                                type: chunkAny.type,
                                payload: chunkAny.payload
                            });

                            // Extract text from text delta events
                            if (
                                chunkAny.type === "agent-execution-event-text-delta" &&
                                chunkAny.payload?.textDelta
                            ) {
                                fullText += chunkAny.payload.textDelta;
                                sendEvent("text", {
                                    chunk: chunkAny.payload.textDelta,
                                    full: fullText
                                });
                            }

                            // Send final result
                            if (chunkAny.type === "network-execution-event-step-finish") {
                                sendEvent("result", { result: chunkAny.payload?.result });
                            }
                        }

                        sendEvent("done", { text: fullText });
                    } else {
                        // Use direct agent streaming (simpler, faster for basic queries)
                        const steps: Array<{ type: string; content: string }> = [];

                        const responseStream = await agent.stream(message, {
                            maxSteps: 10,
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            onStepFinish: (step: any) => {
                                const stepData = {
                                    type: step.finishReason || "unknown",
                                    toolCalls: step.toolCalls,
                                    text: step.text,
                                    content: step.text || ""
                                };
                                steps.push(stepData);
                                sendEvent("step", stepData);
                            }
                        });

                        let fullText = "";

                        for await (const chunk of responseStream.textStream) {
                            fullText += chunk;
                            sendEvent("text", { chunk, full: fullText });
                        }

                        sendEvent("done", {
                            text: fullText,
                            steps,
                            threadId: effectiveThreadId
                        });
                    }

                    controller.close();
                } catch (error) {
                    console.error("Trip planner chat error:", error);
                    sendEvent("error", {
                        message: error instanceof Error ? error.message : "Chat failed"
                    });
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive"
            }
        });
    } catch (error) {
        console.error("Trip planner chat error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Chat failed" },
            { status: 500 }
        );
    }
}
