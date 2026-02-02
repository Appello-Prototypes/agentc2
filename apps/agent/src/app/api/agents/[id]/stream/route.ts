import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /api/agents/[id]/stream
 *
 * SSE endpoint for real-time agent updates
 * Supports channels: runs, traces, alerts, costs
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);

        const channel = searchParams.get("channel") || "runs";

        // Find agent by slug or id
        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id: id }]
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        // Create SSE stream
        const encoder = new TextEncoder();
        let intervalId: NodeJS.Timeout | null = null;

        const stream = new ReadableStream({
            async start(controller) {
                // Send initial connection message
                controller.enqueue(
                    encoder.encode(
                        `data: ${JSON.stringify({ type: "connected", channel, agentId: agent.id })}\n\n`
                    )
                );

                // Track last seen IDs to detect new items
                let lastRunId: string | null = null;
                let lastAlertId: string | null = null;

                // Get initial last IDs
                const lastRun = await prisma.agentRun.findFirst({
                    where: { agentId: agent.id },
                    orderBy: { createdAt: "desc" },
                    select: { id: true }
                });
                lastRunId = lastRun?.id || null;

                const lastAlert = await prisma.agentAlert.findFirst({
                    where: { agentId: agent.id },
                    orderBy: { createdAt: "desc" },
                    select: { id: true }
                });
                lastAlertId = lastAlert?.id || null;

                // Poll for updates every 2 seconds
                intervalId = setInterval(async () => {
                    try {
                        if (channel === "runs" || channel === "all") {
                            // Check for new runs
                            const newRuns = await prisma.agentRun.findMany({
                                where: {
                                    agentId: agent.id,
                                    ...(lastRunId ? { id: { gt: lastRunId } } : {})
                                },
                                orderBy: { createdAt: "asc" },
                                take: 10,
                                select: {
                                    id: true,
                                    status: true,
                                    inputText: true,
                                    durationMs: true,
                                    startedAt: true
                                }
                            });

                            for (const run of newRuns) {
                                controller.enqueue(
                                    encoder.encode(
                                        `data: ${JSON.stringify({
                                            type: "run",
                                            action: "created",
                                            data: {
                                                id: run.id,
                                                status: run.status,
                                                inputPreview: run.inputText.slice(0, 100),
                                                durationMs: run.durationMs,
                                                startedAt: run.startedAt
                                            }
                                        })}\n\n`
                                    )
                                );
                                lastRunId = run.id;
                            }

                            // Check for updated running runs
                            const runningRuns = await prisma.agentRun.findMany({
                                where: {
                                    agentId: agent.id,
                                    status: { in: ["RUNNING", "QUEUED"] }
                                },
                                select: {
                                    id: true,
                                    status: true,
                                    startedAt: true
                                }
                            });

                            if (runningRuns.length > 0) {
                                controller.enqueue(
                                    encoder.encode(
                                        `data: ${JSON.stringify({
                                            type: "runs_status",
                                            data: runningRuns
                                        })}\n\n`
                                    )
                                );
                            }
                        }

                        if (channel === "alerts" || channel === "all") {
                            // Check for new alerts
                            const newAlerts = await prisma.agentAlert.findMany({
                                where: {
                                    agentId: agent.id,
                                    ...(lastAlertId ? { id: { gt: lastAlertId } } : {})
                                },
                                orderBy: { createdAt: "asc" },
                                take: 10
                            });

                            for (const alert of newAlerts) {
                                controller.enqueue(
                                    encoder.encode(
                                        `data: ${JSON.stringify({
                                            type: "alert",
                                            action: "created",
                                            data: {
                                                id: alert.id,
                                                severity: alert.severity,
                                                message: alert.message,
                                                source: alert.source,
                                                createdAt: alert.createdAt
                                            }
                                        })}\n\n`
                                    )
                                );
                                lastAlertId = alert.id;
                            }
                        }

                        // Send heartbeat
                        controller.enqueue(
                            encoder.encode(
                                `data: ${JSON.stringify({ type: "heartbeat", timestamp: new Date().toISOString() })}\n\n`
                            )
                        );
                    } catch (pollError) {
                        console.error("[SSE Poll Error]", pollError);
                    }
                }, 2000);
            },

            cancel() {
                if (intervalId) {
                    clearInterval(intervalId);
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
        console.error("[Agent Stream] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to create stream"
            },
            { status: 500 }
        );
    }
}
