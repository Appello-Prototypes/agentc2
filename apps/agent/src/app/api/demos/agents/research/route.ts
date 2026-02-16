import { NextRequest, NextResponse } from "next/server";
import { mastra } from "@repo/mastra/core";
import { getDemoSession } from "@/lib/standalone-auth";

export async function POST(req: NextRequest) {
    const encoder = new TextEncoder();

    try {
        const session = await getDemoSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { query, maxSteps = 5 } = await req.json();

        if (!query) {
            return NextResponse.json({ error: "Query is required" }, { status: 400 });
        }

        const agent = mastra.getAgent("research");
        if (!agent) {
            return NextResponse.json({ error: "Research agent not found" }, { status: 500 });
        }

        const stream = new ReadableStream({
            async start(controller) {
                const sendEvent = (event: string, data: unknown) => {
                    controller.enqueue(encoder.encode(`event: ${event}\n`));
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                };

                try {
                    const steps: Array<{ type: string; content: unknown }> = [];

                    // Use streaming generation
                    const responseStream = await agent.stream(query, {
                        maxSteps,
                        onStepFinish: (step) => {
                            const stepData = {
                                type: step.finishReason || "unknown",
                                content: step.text || step.toolCalls
                            };
                            steps.push(stepData);
                            sendEvent("step", stepData);
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
                        steps
                    });

                    controller.close();
                } catch (error) {
                    console.error("Research agent streaming error:", error);
                    sendEvent("error", {
                        message: error instanceof Error ? error.message : "Research failed"
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
        console.error("Research agent error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Research failed" },
            { status: 500 }
        );
    }
}
