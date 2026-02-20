import { NextRequest, NextResponse } from "next/server";
import { queryRag, ragGenerateStream } from "@repo/agentc2/rag";
import { mastra } from "@repo/agentc2/core";
import { getDemoSession } from "@/lib/standalone-auth";

export async function POST(req: NextRequest) {
    const encoder = new TextEncoder();

    try {
        const session = await getDemoSession(req);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { query, topK, minScore, generateResponse } = await req.json();

        if (!query) {
            return NextResponse.json({ error: "Query is required" }, { status: 400 });
        }

        // Non-streaming path for search-only queries
        if (!generateResponse) {
            const results = await queryRag(query, { topK, minScore });
            return NextResponse.json({ results });
        }

        // Streaming path for generate responses
        const stream = new ReadableStream({
            async start(controller) {
                const sendEvent = (event: string, data: unknown) => {
                    controller.enqueue(encoder.encode(`event: ${event}\n`));
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                };

                try {
                    const agent = mastra.getAgent("assistant");
                    if (!agent) {
                        sendEvent("error", { message: "Agent not found" });
                        controller.close();
                        return;
                    }

                    // Get streaming response with sources
                    const { textStream, sources } = await ragGenerateStream(query, agent, {
                        topK,
                        minScore
                    });

                    // Send sources immediately
                    sendEvent("sources", { sources });

                    let fullText = "";

                    // Stream text chunks
                    for await (const chunk of textStream) {
                        fullText += chunk;
                        sendEvent("text", { chunk, full: fullText });
                    }

                    // Send completion event
                    sendEvent("done", {
                        response: fullText,
                        sources
                    });

                    controller.close();
                } catch (error) {
                    console.error("RAG streaming error:", error);
                    sendEvent("error", {
                        message: error instanceof Error ? error.message : "Query failed"
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
        console.error("RAG query error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Query failed" },
            { status: 500 }
        );
    }
}
