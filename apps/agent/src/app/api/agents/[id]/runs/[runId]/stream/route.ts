import { NextRequest } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /api/agents/[id]/runs/[runId]/stream
 *
 * SSE endpoint that streams run trace steps, tool calls, and status changes
 * in real-time while a run is executing. Polls every 2 seconds and emits
 * only new data since the last poll.
 *
 * Events emitted:
 *   - trace_step: New trace step added
 *   - tool_call: Tool invocation started/completed/failed
 *   - status_change: Run status updated
 *   - heartbeat: Keep-alive (every 10s)
 *   - complete: Run finished, stream closes
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; runId: string }> }
) {
    const { id, runId } = await params;

    const agent = await prisma.agent.findFirst({
        where: {
            OR: [{ slug: id }, { id }],
            isActive: true
        },
        select: { id: true }
    });

    if (!agent) {
        return new Response(JSON.stringify({ error: "Agent not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" }
        });
    }

    const run = await prisma.agentRun.findFirst({
        where: { id: runId, agentId: agent.id },
        select: { id: true, status: true }
    });

    if (!run) {
        return new Response(JSON.stringify({ error: "Run not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" }
        });
    }

    const encoder = new TextEncoder();
    let closed = false;

    const stream = new ReadableStream({
        async start(controller) {
            function send(event: string, data: unknown) {
                if (closed) return;
                try {
                    controller.enqueue(
                        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
                    );
                } catch {
                    closed = true;
                }
            }

            let knownStepCount = 0;
            let knownToolCallCount = 0;
            let lastStatus = run.status;
            let heartbeatCounter = 0;

            const POLL_INTERVAL = 2000;
            const HEARTBEAT_EVERY = 5; // heartbeats = HEARTBEAT_EVERY * POLL_INTERVAL = 10s

            const TERMINAL_STATUSES = ["COMPLETED", "FAILED", "CANCELLED"];
            if (TERMINAL_STATUSES.includes(run.status)) {
                send("complete", { status: run.status });
                controller.close();
                closed = true;
                return;
            }

            async function poll() {
                if (closed) return;

                try {
                    const currentRun = await prisma.agentRun.findFirst({
                        where: { id: runId },
                        include: {
                            trace: {
                                include: {
                                    steps: {
                                        orderBy: { stepNumber: "asc" },
                                        select: {
                                            id: true,
                                            stepNumber: true,
                                            type: true,
                                            content: true,
                                            durationMs: true
                                        }
                                    },
                                    toolCalls: {
                                        orderBy: { createdAt: "asc" },
                                        select: {
                                            id: true,
                                            toolKey: true,
                                            success: true,
                                            inputJson: true,
                                            outputJson: true,
                                            error: true,
                                            durationMs: true,
                                            createdAt: true
                                        }
                                    }
                                }
                            }
                        }
                    });

                    if (!currentRun) {
                        send("complete", { status: "NOT_FOUND" });
                        controller.close();
                        closed = true;
                        return;
                    }

                    if (currentRun.status !== lastStatus) {
                        lastStatus = currentRun.status;
                        send("status_change", { status: currentRun.status });
                    }

                    const steps = currentRun.trace?.steps ?? [];
                    if (steps.length > knownStepCount) {
                        const newSteps = steps.slice(knownStepCount);
                        for (const step of newSteps) {
                            send("trace_step", {
                                index: step.stepNumber,
                                type: step.type,
                                content: step.content,
                                durationMs: step.durationMs
                            });
                        }
                        knownStepCount = steps.length;
                    }

                    const toolCalls = currentRun.trace?.toolCalls ?? [];
                    if (toolCalls.length > knownToolCallCount) {
                        const newCalls = toolCalls.slice(knownToolCallCount);
                        for (const tc of newCalls) {
                            const isComplete = tc.durationMs !== null;
                            send("tool_call", {
                                id: tc.id,
                                toolKey: tc.toolKey,
                                status: isComplete
                                    ? tc.success
                                        ? "completed"
                                        : "failed"
                                    : "started",
                                inputJson: tc.inputJson,
                                outputJson: tc.outputJson,
                                error: tc.error,
                                durationMs: tc.durationMs
                            });
                        }
                        knownToolCallCount = toolCalls.length;
                    }

                    if (TERMINAL_STATUSES.includes(currentRun.status)) {
                        send("complete", { status: currentRun.status });
                        controller.close();
                        closed = true;
                        return;
                    }

                    heartbeatCounter++;
                    if (heartbeatCounter >= HEARTBEAT_EVERY) {
                        send("heartbeat", { ts: Date.now() });
                        heartbeatCounter = 0;
                    }
                } catch (err) {
                    console.error("[RunStream] Poll error:", err);
                }

                if (!closed) {
                    setTimeout(poll, POLL_INTERVAL);
                }
            }

            // Start polling
            poll();

            // Stop after 5 minutes max to prevent resource leaks
            setTimeout(
                () => {
                    if (!closed) {
                        send("complete", {
                            status: "TIMEOUT",
                            reason: "Stream max duration reached"
                        });
                        controller.close();
                        closed = true;
                    }
                },
                5 * 60 * 1000
            );
        },

        cancel() {
            closed = true;
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no"
        }
    });
}
