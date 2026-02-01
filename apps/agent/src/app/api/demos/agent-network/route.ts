import { NextRequest, NextResponse } from "next/server";
import { networkResolver } from "@repo/mastra";
import { getDemoSession } from "@/lib/standalone-auth";

/**
 * Agent Network API Route
 *
 * Executes the trip planner agent network with streaming events.
 * The network uses database-driven sub-agents resolved via NetworkResolver.
 */
export async function POST(req: NextRequest) {
    const encoder = new TextEncoder();

    try {
        const session = await getDemoSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { message, threadId, resourceId } = await req.json();

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

        const stream = new ReadableStream({
            async start(controller) {
                const sendEvent = (event: string, data: unknown) => {
                    controller.enqueue(encoder.encode(`event: ${event}\n`));
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                };

                try {
                    // Track network execution events
                    const networkEvents: Array<{
                        type: string;
                        payload: unknown;
                        timestamp: number;
                    }> = [];

                    // Send initial event
                    sendEvent("network-start", {
                        message: "Starting trip planner network",
                        timestamp: Date.now()
                    });

                    // Execute the agent network
                    // Note: Mastra's .network() returns a stream of events
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const result = await (agent as any).network(message, {
                        threadId: threadId || `thread-${Date.now()}`,
                        resourceId: resourceId || session.user.id
                    });

                    // Process the network event stream
                    for await (const chunk of result) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const chunkAny = chunk as any;
                        const eventData = {
                            type: chunkAny.type,
                            payload: chunkAny.payload,
                            timestamp: Date.now()
                        };
                        networkEvents.push(eventData);

                        // Send event to client
                        sendEvent("network-event", eventData);

                        // Handle specific event types
                        switch (chunkAny.type) {
                            case "routing-agent-start":
                                sendEvent("status", {
                                    status: "routing",
                                    message: "Analyzing your request..."
                                });
                                break;

                            case "agent-execution-start":
                                sendEvent("status", {
                                    status: "agent-active",
                                    message: `Delegating to specialist agent...`,
                                    agent: chunkAny.payload?.agentId
                                });
                                break;

                            case "workflow-execution-start":
                                sendEvent("status", {
                                    status: "workflow-active",
                                    message: `Running workflow...`,
                                    workflow: chunkAny.payload?.workflowId
                                });
                                break;

                            case "tool-execution-start":
                                sendEvent("status", {
                                    status: "tool-active",
                                    message: `Using tool...`,
                                    tool: chunkAny.payload?.toolName
                                });
                                break;

                            case "agent-execution-event-text-delta":
                                // Stream text as it's generated
                                if (chunkAny.payload?.textDelta) {
                                    sendEvent("text", { chunk: chunkAny.payload.textDelta });
                                }
                                break;

                            case "network-execution-event-step-finish":
                                // Final result from a network step
                                sendEvent("step-complete", {
                                    result: chunkAny.payload?.result
                                });
                                break;
                        }
                    }

                    // Send completion event
                    sendEvent("network-complete", {
                        message: "Network execution complete",
                        eventCount: networkEvents.length,
                        timestamp: Date.now()
                    });

                    controller.close();
                } catch (error) {
                    console.error("Agent network streaming error:", error);
                    sendEvent("error", {
                        message: error instanceof Error ? error.message : "Network execution failed"
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
        console.error("Agent network error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Network execution failed" },
            { status: 500 }
        );
    }
}

/**
 * GET handler - Return network info
 */
export async function GET() {
    try {
        // Get the list of sub-agent slugs used by the network
        const subAgentSlugs = networkResolver.getTripPlannerSubAgentSlugs();

        return NextResponse.json({
            id: "trip-planner",
            name: "Trip Planner Agent Network",
            description:
                "A multi-agent network for comprehensive trip planning with specialized agents for destinations, transport, accommodation, activities, budgeting, and itinerary creation.",
            source: "database",
            capabilities: {
                agents: subAgentSlugs,
                workflows: [
                    "parallelResearchWorkflow",
                    "itineraryAssemblyWorkflow",
                    "budgetApprovalWorkflow"
                ],
                tools: ["flightSearch", "hotelSearch", "weatherLookup", "tripNotes"],
                memory: {
                    messageHistory: true,
                    workingMemory: true,
                    semanticRecall: true
                }
            }
        });
    } catch (error) {
        console.error("Agent network info error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to get network info" },
            { status: 500 }
        );
    }
}
