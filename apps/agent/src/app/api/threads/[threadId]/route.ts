import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

/**
 * GET /api/threads/[threadId]
 *
 * Get the full conversation for a thread: all runs with their turns, ordered chronologically.
 * Renders as a chat transcript with run boundary markers.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ threadId: string }> }
) {
    const authContext = await authenticateRequest(request);
    if (!authContext) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { threadId } = await params;

        const runs = await prisma.agentRun.findMany({
            where: {
                threadId,
                agent: { workspace: { organizationId: authContext.organizationId } }
            },
            orderBy: { startedAt: "asc" },
            include: {
                agent: { select: { slug: true, name: true } },
                turns: {
                    orderBy: { turnIndex: "asc" },
                    select: {
                        id: true,
                        turnIndex: true,
                        inputText: true,
                        outputText: true,
                        durationMs: true,
                        startedAt: true,
                        completedAt: true,
                        promptTokens: true,
                        completionTokens: true,
                        totalTokens: true,
                        costUsd: true,
                        modelProvider: true,
                        modelName: true
                    }
                },
                toolCalls: {
                    select: {
                        id: true,
                        toolKey: true,
                        success: true,
                        error: true,
                        durationMs: true,
                        turnId: true
                    },
                    orderBy: { createdAt: "asc" }
                }
            }
        });

        if (runs.length === 0) {
            return NextResponse.json(
                { success: false, error: `Thread '${threadId}' not found` },
                { status: 404 }
            );
        }

        const totals = {
            runCount: runs.length,
            totalTurns: runs.reduce((sum, r) => sum + Math.max(r.turnCount, r.turns.length), 0),
            totalTokens: runs.reduce((sum, r) => sum + (r.totalTokens ?? 0), 0),
            totalCostUsd: runs.reduce((sum, r) => sum + (r.costUsd ?? 0), 0),
            totalDurationMs: runs.reduce((sum, r) => sum + (r.durationMs ?? 0), 0)
        };
        totals.totalCostUsd = Math.round(totals.totalCostUsd * 10000) / 10000;

        // Build a flat message list from all turns across all runs
        const messages: Array<{
            role: "user" | "assistant";
            content: string;
            runId: string;
            turnIndex: number;
            timestamp: string;
            durationMs?: number | null;
            tokens?: number | null;
            costUsd?: number | null;
            toolCalls?: Array<{ toolKey: string; success: boolean; error?: string | null }>;
        }> = [];

        for (const run of runs) {
            const turnToolCalls = new Map<string | null, typeof run.toolCalls>();

            for (const tc of run.toolCalls) {
                const key = tc.turnId;
                const existing = turnToolCalls.get(key) || [];
                existing.push(tc);
                turnToolCalls.set(key, existing);
            }

            if (run.turns.length > 0) {
                for (const turn of run.turns) {
                    messages.push({
                        role: "user",
                        content: turn.inputText,
                        runId: run.id,
                        turnIndex: turn.turnIndex,
                        timestamp: turn.startedAt.toISOString()
                    });

                    if (turn.outputText) {
                        const tcs = turnToolCalls.get(turn.id) || [];
                        messages.push({
                            role: "assistant",
                            content: turn.outputText,
                            runId: run.id,
                            turnIndex: turn.turnIndex,
                            timestamp: (turn.completedAt ?? turn.startedAt).toISOString(),
                            durationMs: turn.durationMs,
                            tokens: turn.totalTokens,
                            costUsd: turn.costUsd,
                            toolCalls: tcs.map((tc) => ({
                                toolKey: tc.toolKey,
                                success: tc.success,
                                error: tc.error
                            }))
                        });
                    }
                }
            } else {
                // Fallback for single-turn runs without AgentRunTurn records
                messages.push({
                    role: "user",
                    content: run.inputText,
                    runId: run.id,
                    turnIndex: 0,
                    timestamp: run.startedAt.toISOString()
                });

                if (run.outputText) {
                    const tcs = turnToolCalls.get(null) || [];
                    messages.push({
                        role: "assistant",
                        content: run.outputText,
                        runId: run.id,
                        turnIndex: 0,
                        timestamp: (run.completedAt ?? run.startedAt).toISOString(),
                        durationMs: run.durationMs,
                        tokens: run.totalTokens,
                        costUsd: run.costUsd,
                        toolCalls: tcs.map((tc) => ({
                            toolKey: tc.toolKey,
                            success: tc.success,
                            error: tc.error
                        }))
                    });
                }
            }
        }

        return NextResponse.json({
            success: true,
            threadId,
            agentSlug: runs[0].agent.slug,
            agentName: runs[0].agent.name,
            source: runs[0].source,
            firstMessageAt: runs[0].startedAt,
            lastMessageAt: runs[runs.length - 1].completedAt ?? runs[runs.length - 1].startedAt,
            totals,
            messages,
            runs: runs.map((r) => ({
                id: r.id,
                status: r.status,
                inputText: r.inputText.slice(0, 200),
                durationMs: r.durationMs,
                totalTokens: r.totalTokens,
                costUsd: r.costUsd,
                turnCount: Math.max(r.turnCount, r.turns.length),
                startedAt: r.startedAt,
                completedAt: r.completedAt,
                modelName: r.modelName,
                source: r.source
            }))
        });
    } catch (error) {
        console.error("[Thread Detail] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch thread" },
            { status: 500 }
        );
    }
}
