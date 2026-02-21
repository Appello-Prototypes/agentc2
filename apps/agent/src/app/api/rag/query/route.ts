import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { queryRag, ragGenerateStream } from "@repo/agentc2/rag";
import { mastra } from "@repo/agentc2/core";
import { getDemoSession } from "@/lib/standalone-auth";
import { getUserOrganizationId } from "@/lib/organization";

const ragQuerySchema = z.object({
    query: z.string().min(1).max(10000),
    topK: z.number().int().min(1).max(100).optional(),
    minScore: z.number().min(0).max(1).optional(),
    generateResponse: z.boolean().optional(),
    mode: z.enum(["vector", "keyword", "hybrid"]).optional(),
    vectorWeight: z.number().min(0).max(1).optional()
});

export async function POST(req: NextRequest) {
    const encoder = new TextEncoder();

    try {
        const session = await getDemoSession(req);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const organizationId = await getUserOrganizationId(session.user.id);
        const body = ragQuerySchema.safeParse(await req.json());
        if (!body.success) {
            return NextResponse.json(
                { error: "Invalid input", details: body.error.flatten().fieldErrors },
                { status: 400 }
            );
        }
        const { query, topK, minScore, generateResponse, mode, vectorWeight } = body.data;

        // Non-streaming path for search-only queries
        if (!generateResponse) {
            const results = await queryRag(query, {
                organizationId: organizationId || undefined,
                topK,
                minScore,
                mode: mode || "vector",
                vectorWeight
            });
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
                        organizationId: organizationId || undefined,
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
