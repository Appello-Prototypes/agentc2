/**
 * GET /api/godmode/wiretap
 *
 * SSE endpoint that streams live execution data for ALL currently-running
 * agent runs across the entire platform. Unlike the per-run stream endpoint,
 * this aggregates every active execution into a single firehose so God Mode
 * can display a real-time view of the whole system.
 *
 * Events emitted:
 *   snapshot      – Full state of all running runs on connect
 *   run_started   – A new run appeared
 *   trace_step    – A new trace step was recorded for a running run
 *   tool_call     – A tool invocation was recorded
 *   run_completed – A run transitioned to COMPLETED / FAILED / CANCELLED
 *   heartbeat     – Keep-alive with active run count
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

interface RunState {
    status: string;
    stepCount: number;
    toolCallCount: number;
}

const POLL_INTERVAL_MS = 2000;
const MAX_DURATION_MS = 10 * 60 * 1000;

export async function GET(request: NextRequest) {
    const authContext = await authenticateRequest(request);
    if (!authContext) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const orgId = authContext.organizationId;
    const encoder = new TextEncoder();
    let closed = false;

    const knownRuns = new Map<string, RunState>();

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

            async function poll(isInitial: boolean) {
                if (closed) return;

                try {
                    const activeRuns = await prisma.agentRun.findMany({
                        where: {
                            status: { in: ["RUNNING", "QUEUED"] },
                            tenantId: orgId
                        },
                        include: {
                            agent: {
                                select: { slug: true, name: true }
                            },
                            trace: {
                                include: {
                                    steps: {
                                        orderBy: { stepNumber: "asc" },
                                        select: {
                                            id: true,
                                            stepNumber: true,
                                            type: true,
                                            content: true,
                                            durationMs: true,
                                            timestamp: true
                                        }
                                    },
                                    toolCalls: {
                                        orderBy: { createdAt: "asc" },
                                        select: {
                                            id: true,
                                            toolKey: true,
                                            mcpServerId: true,
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
                        },
                        orderBy: { startedAt: "desc" },
                        take: 50
                    });

                    if (isInitial) {
                        const snapshot = activeRuns.map((run) => ({
                            runId: run.id,
                            agentId: run.agentId,
                            agentSlug: run.agent.slug,
                            agentName: run.agent.name,
                            status: run.status,
                            inputText: run.inputText.slice(0, 300),
                            source: run.source,
                            startedAt: run.startedAt.toISOString(),
                            elapsedMs: Date.now() - run.startedAt.getTime(),
                            steps: (run.trace?.steps ?? []).map((s) => ({
                                stepNumber: s.stepNumber,
                                type: s.type,
                                content: s.content,
                                durationMs: s.durationMs,
                                timestamp: s.timestamp.toISOString()
                            })),
                            toolCalls: (run.trace?.toolCalls ?? []).map((tc) => ({
                                id: tc.id,
                                toolKey: tc.toolKey,
                                mcpServerId: tc.mcpServerId,
                                status:
                                    tc.durationMs !== null
                                        ? tc.success
                                            ? "completed"
                                            : "failed"
                                        : "started",
                                durationMs: tc.durationMs,
                                createdAt: tc.createdAt.toISOString()
                            }))
                        }));

                        send("snapshot", { runs: snapshot });

                        for (const run of activeRuns) {
                            knownRuns.set(run.id, {
                                status: run.status,
                                stepCount: run.trace?.steps.length ?? 0,
                                toolCallCount: run.trace?.toolCalls.length ?? 0
                            });
                        }
                        return;
                    }

                    const currentRunIds = new Set(activeRuns.map((r) => r.id));

                    // Detect new runs
                    for (const run of activeRuns) {
                        const known = knownRuns.get(run.id);
                        if (!known) {
                            send("run_started", {
                                runId: run.id,
                                agentId: run.agentId,
                                agentSlug: run.agent.slug,
                                agentName: run.agent.name,
                                status: run.status,
                                inputText: run.inputText.slice(0, 300),
                                source: run.source,
                                startedAt: run.startedAt.toISOString()
                            });
                            knownRuns.set(run.id, {
                                status: run.status,
                                stepCount: 0,
                                toolCallCount: 0
                            });
                        }
                    }

                    // Detect new steps and tool calls for known runs
                    for (const run of activeRuns) {
                        const known = knownRuns.get(run.id);
                        if (!known) continue;

                        const steps = run.trace?.steps ?? [];
                        if (steps.length > known.stepCount) {
                            const newSteps = steps.slice(known.stepCount);
                            for (const step of newSteps) {
                                send("trace_step", {
                                    runId: run.id,
                                    agentSlug: run.agent.slug,
                                    agentName: run.agent.name,
                                    stepNumber: step.stepNumber,
                                    type: step.type,
                                    content: step.content,
                                    durationMs: step.durationMs,
                                    timestamp: step.timestamp.toISOString()
                                });
                            }
                            known.stepCount = steps.length;
                        }

                        const toolCalls = run.trace?.toolCalls ?? [];
                        if (toolCalls.length > known.toolCallCount) {
                            const newCalls = toolCalls.slice(known.toolCallCount);
                            for (const tc of newCalls) {
                                send("tool_call", {
                                    runId: run.id,
                                    agentSlug: run.agent.slug,
                                    agentName: run.agent.name,
                                    id: tc.id,
                                    toolKey: tc.toolKey,
                                    mcpServerId: tc.mcpServerId,
                                    status:
                                        tc.durationMs !== null
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
                            known.toolCallCount = toolCalls.length;
                        }
                    }

                    // Detect runs that completed (were known but no longer active)
                    for (const [runId, state] of knownRuns) {
                        if (
                            !currentRunIds.has(runId) &&
                            state.status !== "COMPLETED" &&
                            state.status !== "FAILED" &&
                            state.status !== "CANCELLED"
                        ) {
                            const finishedRun = await prisma.agentRun.findUnique({
                                where: { id: runId },
                                select: {
                                    status: true,
                                    outputText: true,
                                    durationMs: true,
                                    totalTokens: true,
                                    costUsd: true,
                                    agent: {
                                        select: {
                                            slug: true,
                                            name: true
                                        }
                                    }
                                }
                            });

                            if (finishedRun) {
                                send("run_completed", {
                                    runId,
                                    agentSlug: finishedRun.agent.slug,
                                    agentName: finishedRun.agent.name,
                                    status: finishedRun.status,
                                    outputPreview: finishedRun.outputText?.slice(0, 300),
                                    durationMs: finishedRun.durationMs,
                                    totalTokens: finishedRun.totalTokens,
                                    costUsd: finishedRun.costUsd
                                });
                                state.status = finishedRun.status;
                            }

                            knownRuns.delete(runId);
                        }
                    }

                    send("heartbeat", {
                        activeRuns: currentRunIds.size,
                        timestamp: new Date().toISOString()
                    });
                } catch (err) {
                    console.error("[Wiretap] Poll error:", err);
                }

                if (!closed) {
                    setTimeout(() => poll(false), POLL_INTERVAL_MS);
                }
            }

            // Initial snapshot
            await poll(true);

            // Start polling loop
            if (!closed) {
                setTimeout(() => poll(false), POLL_INTERVAL_MS);
            }

            // Auto-close to prevent resource leaks
            setTimeout(() => {
                if (!closed) {
                    send("complete", {
                        reason: "Stream max duration reached"
                    });
                    controller.close();
                    closed = true;
                }
            }, MAX_DURATION_MS);
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
