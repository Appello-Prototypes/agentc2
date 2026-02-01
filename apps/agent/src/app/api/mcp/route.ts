import { NextRequest, NextResponse } from "next/server";
import { createMcpAgent } from "@repo/mastra";
import { getDemoSession } from "@/lib/standalone-auth";

export interface McpStep {
    stepNumber: number;
    type: "tool-call" | "text" | "tool-result";
    toolName?: string;
    toolArgs?: unknown;
    toolResult?: unknown;
    text?: string;
    finishReason?: string;
    timestamp: number;
}

export interface McpResponse {
    text: string;
    steps: McpStep[];
    toolCalls: Array<{
        toolName: string;
        args: unknown;
    }>;
    toolResults: Array<{
        toolName: string;
        result: unknown;
    }>;
    reasoning?: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    finishReason: string;
    error?: string;
}

export async function POST(req: NextRequest) {
    const encoder = new TextEncoder();

    try {
        const session = await getDemoSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { message, maxSteps = 10 } = await req.json();

        if (!message) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        const stream = new ReadableStream({
            async start(controller) {
                const sendEvent = (event: string, data: unknown) => {
                    controller.enqueue(encoder.encode(`event: ${event}\n`));
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                };

                try {
                    // Create agent with MCP tools loaded
                    const agent = await createMcpAgent();

                    // Capture steps during execution
                    const capturedSteps: McpStep[] = [];
                    let stepNumber = 0;

                    // Use streaming generation with step tracking
                    const responseStream = await agent.stream(message, {
                        maxSteps,
                        onStepFinish: (step) => {
                            stepNumber++;

                            // Capture tool calls from this step
                            if (step.toolCalls && step.toolCalls.length > 0) {
                                for (const toolCall of step.toolCalls) {
                                    const tc = toolCall as { toolName?: string; args?: unknown };
                                    const stepData: McpStep = {
                                        stepNumber,
                                        type: "tool-call",
                                        toolName: tc.toolName,
                                        toolArgs: tc.args,
                                        timestamp: Date.now()
                                    };
                                    capturedSteps.push(stepData);
                                    sendEvent("step", stepData);
                                }
                            }

                            // Capture tool results from this step
                            if (step.toolResults && step.toolResults.length > 0) {
                                for (const toolResult of step.toolResults) {
                                    const tr = toolResult as {
                                        toolName?: string;
                                        result?: unknown;
                                    };
                                    const stepData: McpStep = {
                                        stepNumber,
                                        type: "tool-result",
                                        toolName: tr.toolName,
                                        toolResult: tr.result,
                                        timestamp: Date.now()
                                    };
                                    capturedSteps.push(stepData);
                                    sendEvent("step", stepData);
                                }
                            }

                            // Capture text from this step
                            if (step.text) {
                                const stepData: McpStep = {
                                    stepNumber,
                                    type: "text",
                                    text: step.text,
                                    finishReason: step.finishReason,
                                    timestamp: Date.now()
                                };
                                capturedSteps.push(stepData);
                                sendEvent("step", stepData);
                            }
                        }
                    });

                    let fullText = "";

                    // Stream text chunks
                    for await (const chunk of responseStream.textStream) {
                        fullText += chunk;
                        sendEvent("text", { chunk, full: fullText });
                    }

                    // Send completion event
                    sendEvent("done", {
                        text: fullText,
                        steps: capturedSteps,
                        finishReason: "stop"
                    });

                    controller.close();
                } catch (error) {
                    console.error("MCP agent streaming error:", error);
                    sendEvent("error", {
                        message: error instanceof Error ? error.message : "MCP request failed"
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
        console.error("MCP agent error:", error);
        return NextResponse.json(
            {
                text: "",
                steps: [],
                toolCalls: [],
                toolResults: [],
                finishReason: "error",
                error: error instanceof Error ? error.message : "MCP request failed"
            } as McpResponse,
            { status: 500 }
        );
    }
}
