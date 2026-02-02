import { handleChatStream } from "@mastra/ai-sdk";
import { toAISdkV5Messages } from "@mastra/ai-sdk/ui";
import { createUIMessageStreamResponse } from "ai";
import { agentResolver, mastra } from "@repo/mastra";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/agents/[id]/chat
 * Handles streaming chat messages for a specific agent
 * Supports both code-defined and database-driven agents via AgentResolver
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { threadId, requestContext, messages, ...chatParams } = body;

        // Create a thread ID for this test session
        const userThreadId = threadId || `test-${id}-${Date.now()}`;
        const resourceId = requestContext?.userId || "test-user";

        // First, try to get the agent from Mastra (code-defined agents)
        // mastra.getAgent() throws if agent not found, so we wrap in try-catch
        try {
            const codeAgent = mastra.getAgent(id);

            if (codeAgent) {
                // Use handleChatStream for code-defined agents (faster path)
                const stream = await handleChatStream({
                    mastra,
                    agentId: id,
                    params: {
                        messages,
                        ...chatParams,
                        memory: {
                            thread: userThreadId,
                            resource: resourceId
                        }
                    }
                });

                return createUIMessageStreamResponse({ stream });
            }
        } catch {
            // Agent not found in Mastra, will try database via AgentResolver
        }

        // For database-driven agents, use AgentResolver and stream manually
        const { agent, source } = await agentResolver.resolve({
            slug: id,
            requestContext
        });

        console.log(`[Agent Chat] Resolved agent '${id}' from ${source}`);

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

        // Stream the response using the resolved agent
        const responseStream = await agent.stream(lastUserMessage, {
            memory: {
                thread: userThreadId,
                resource: resourceId
            }
        });

        // Create a UI-compatible stream
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    let fullText = "";

                    // Stream text chunks in AI SDK data stream format
                    for await (const chunk of responseStream.textStream) {
                        fullText += chunk;
                        // AI SDK data stream protocol: 0: prefix for text chunks
                        controller.enqueue(encoder.encode(`0:${JSON.stringify(chunk)}\n`));
                    }

                    // Send finish message
                    controller.enqueue(
                        encoder.encode(
                            `d:${JSON.stringify({ finishReason: "stop", usage: { promptTokens: 0, completionTokens: 0 } })}\n`
                        )
                    );

                    controller.close();
                } catch (streamError) {
                    console.error("[Agent Chat] Stream error:", streamError);
                    controller.enqueue(
                        encoder.encode(
                            `e:${JSON.stringify({ error: streamError instanceof Error ? streamError.message : "Stream failed" })}\n`
                        )
                    );
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "X-Vercel-AI-Data-Stream": "v1"
            }
        });
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
