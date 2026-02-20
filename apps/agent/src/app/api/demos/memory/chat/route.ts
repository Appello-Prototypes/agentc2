import { NextRequest, NextResponse } from "next/server";
import { mastra } from "@repo/agentc2/core";
import { getDemoSession } from "@/lib/standalone-auth";

/**
 * Streaming chat endpoint for memory demo
 */
export async function POST(req: NextRequest) {
    const encoder = new TextEncoder();

    try {
        const session = await getDemoSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { message } = await req.json();

        if (!message) {
            return NextResponse.json({ error: "Message required" }, { status: 400 });
        }

        const userId = session.user.id;
        const threadId = `memory-demo-${userId}`;

        const agent = mastra.getAgent("assistant");

        if (!agent) {
            return NextResponse.json({ error: "Agent not found" }, { status: 500 });
        }

        const stream = new ReadableStream({
            async start(controller) {
                const sendEvent = (event: string, data: unknown) => {
                    controller.enqueue(encoder.encode(`event: ${event}\n`));
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                };

                try {
                    // Use streaming generation with memory
                    const responseStream = await agent.stream(message, {
                        memory: {
                            thread: threadId,
                            resource: userId
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
                        threadId
                    });

                    controller.close();
                } catch (error) {
                    console.error("Memory demo streaming error:", error);
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
        console.error("Memory demo chat error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Chat failed" },
            { status: 500 }
        );
    }
}
