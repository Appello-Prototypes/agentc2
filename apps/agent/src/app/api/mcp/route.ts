import { NextRequest, NextResponse } from "next/server";
import { createMcpAgent } from "@repo/mastra";
import { auth } from "@repo/auth";
import { headers } from "next/headers";

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
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { message, maxSteps = 10 } = await req.json();

        if (!message) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        // Create agent with MCP tools loaded
        const agent = await createMcpAgent();

        // Capture steps during execution
        const capturedSteps: McpStep[] = [];
        let stepNumber = 0;

        // Generate response with step tracking
        const response = await agent.generate(message, {
            maxSteps,
            onStepFinish: (step) => {
                stepNumber++;

                // Capture tool calls from this step
                if (step.toolCalls && step.toolCalls.length > 0) {
                    for (const toolCall of step.toolCalls) {
                        const tc = toolCall as { toolName?: string; args?: unknown };
                        capturedSteps.push({
                            stepNumber,
                            type: "tool-call",
                            toolName: tc.toolName,
                            toolArgs: tc.args,
                            timestamp: Date.now()
                        });
                    }
                }

                // Capture tool results from this step
                if (step.toolResults && step.toolResults.length > 0) {
                    for (const toolResult of step.toolResults) {
                        const tr = toolResult as { toolName?: string; result?: unknown };
                        capturedSteps.push({
                            stepNumber,
                            type: "tool-result",
                            toolName: tr.toolName,
                            toolResult: tr.result,
                            timestamp: Date.now()
                        });
                    }
                }

                // Capture text from this step
                if (step.text) {
                    capturedSteps.push({
                        stepNumber,
                        type: "text",
                        text: step.text,
                        finishReason: step.finishReason,
                        timestamp: Date.now()
                    });
                }
            }
        });

        // Build comprehensive response
        const mcpResponse: McpResponse = {
            text: response.text || "",
            steps: capturedSteps,
            toolCalls: (response.toolCalls || []).map((tc) => {
                const toolCall = tc as { toolName?: string; args?: unknown };
                return {
                    toolName: toolCall.toolName || "unknown",
                    args: toolCall.args
                };
            }),
            toolResults: (response.toolResults || []).map((tr) => {
                const toolResult = tr as { toolName?: string; result?: unknown };
                return {
                    toolName: toolResult.toolName || "unknown",
                    result: toolResult.result
                };
            }),
            reasoning: response.reasoningText,
            usage: response.usage
                ? {
                      promptTokens: (response.usage as { promptTokens?: number }).promptTokens || 0,
                      completionTokens:
                          (response.usage as { completionTokens?: number }).completionTokens || 0,
                      totalTokens: response.usage.totalTokens || 0
                  }
                : undefined,
            finishReason: response.finishReason || "unknown"
        };

        return NextResponse.json(mcpResponse);
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
