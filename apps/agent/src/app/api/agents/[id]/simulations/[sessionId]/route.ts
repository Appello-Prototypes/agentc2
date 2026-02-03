import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /api/agents/[id]/simulations/[sessionId]
 *
 * Get simulation session details with run breakdown
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
    try {
        const { id, sessionId } = await params;

        // Find agent by slug or id
        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id: id }],
                isActive: true
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        // Find session
        const session = await prisma.simulationSession.findFirst({
            where: {
                id: sessionId,
                agentId: agent.id
            }
        });

        if (!session) {
            return NextResponse.json(
                { success: false, error: `Simulation session '${sessionId}' not found` },
                { status: 404 }
            );
        }

        // Get runs for this session
        const runs = await prisma.agentRun.findMany({
            where: {
                source: "simulation",
                sessionId: session.id
            },
            orderBy: { createdAt: "desc" },
            take: 100,
            select: {
                id: true,
                status: true,
                inputText: true,
                outputText: true,
                durationMs: true,
                createdAt: true
            }
        });

        // Calculate quality distribution
        const qualityBuckets = {
            excellent: 0, // 0.8-1.0
            good: 0, // 0.6-0.8
            fair: 0, // 0.4-0.6
            poor: 0 // 0-0.4
        };

        // For now, we don't have quality scores stored per run
        // This would require evaluation scores
        const completedRuns = runs.filter((r) => r.status === "COMPLETED");
        const failedRuns = runs.filter((r) => r.status === "FAILED");

        return NextResponse.json({
            success: true,
            session: {
                id: session.id,
                theme: session.theme,
                status: session.status,
                targetCount: session.targetCount,
                completedCount: session.completedCount,
                failedCount: session.failedCount,
                concurrency: session.concurrency,
                avgQualityScore: session.avgQualityScore,
                avgDurationMs: session.avgDurationMs,
                successRate: session.successRate,
                totalCostUsd: session.totalCostUsd,
                startedAt: session.startedAt,
                completedAt: session.completedAt,
                createdAt: session.createdAt
            },
            runs: runs.map((run) => ({
                id: run.id,
                status: run.status,
                input: run.inputText?.substring(0, 200),
                output: run.outputText?.substring(0, 200),
                durationMs: run.durationMs,
                createdAt: run.createdAt
            })),
            summary: {
                completed: completedRuns.length,
                failed: failedRuns.length,
                avgDurationMs:
                    completedRuns.reduce((sum, r) => sum + (r.durationMs || 0), 0) /
                        completedRuns.length || 0,
                qualityDistribution: qualityBuckets
            }
        });
    } catch (error) {
        console.error("[Simulation Session] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get simulation session"
            },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/agents/[id]/simulations/[sessionId]
 *
 * Cancel a running simulation session
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
    try {
        const { id, sessionId } = await params;

        // Find agent by slug or id
        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id: id }],
                isActive: true
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        // Find session
        const session = await prisma.simulationSession.findFirst({
            where: {
                id: sessionId,
                agentId: agent.id
            }
        });

        if (!session) {
            return NextResponse.json(
                { success: false, error: `Simulation session '${sessionId}' not found` },
                { status: 404 }
            );
        }

        // Only allow cancellation of pending or running sessions
        if (!["PENDING", "RUNNING"].includes(session.status)) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Cannot cancel session with status '${session.status}'`
                },
                { status: 400 }
            );
        }

        // Update session status to CANCELLED
        const updated = await prisma.simulationSession.update({
            where: { id: sessionId },
            data: {
                status: "CANCELLED",
                completedAt: new Date()
            }
        });

        console.log(`[Simulations] Cancelled session ${sessionId}`);

        return NextResponse.json({
            success: true,
            session: {
                id: updated.id,
                status: updated.status,
                completedAt: updated.completedAt
            }
        });
    } catch (error) {
        console.error("[Simulation Cancel] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to cancel simulation"
            },
            { status: 500 }
        );
    }
}
