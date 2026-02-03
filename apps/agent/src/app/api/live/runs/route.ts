import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";

/**
 * GET /api/live/runs
 *
 * Returns production runs with optional filtering by status and source.
 * Default filters to PROD runType only.
 *
 * Query Parameters:
 * - status: Filter by run status (completed, failed, running, queued, cancelled)
 * - source: Filter by source channel (slack, whatsapp, voice, telegram, elevenlabs, api)
 * - limit: Number of runs to return (default: 50)
 * - offset: Pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");
        const source = searchParams.get("source");
        const limit = parseInt(searchParams.get("limit") || "50", 10);
        const offset = parseInt(searchParams.get("offset") || "0", 10);

        // Build where clause - always filter to PROD runs
        const where: Prisma.AgentRunWhereInput = {
            runType: "PROD"
        };

        if (status && status !== "all") {
            where.status = status.toUpperCase() as Prisma.EnumRunStatusFilter;
        }

        // Source filter - only apply if the column exists
        if (source && source !== "all") {
            try {
                where.source = source.toLowerCase();
            } catch {
                // Source field might not exist
            }
        }

        // Fetch runs with agent info
        const [runs, counts] = await Promise.all([
            prisma.agentRun.findMany({
                where,
                include: {
                    agent: {
                        select: {
                            slug: true,
                            name: true
                        }
                    }
                },
                orderBy: { startedAt: "desc" },
                take: limit,
                skip: offset
            }),
            // Get counts by status for filters
            Promise.all([
                prisma.agentRun.count({ where: { runType: "PROD" } }),
                prisma.agentRun.count({ where: { runType: "PROD", status: "QUEUED" } }),
                prisma.agentRun.count({ where: { runType: "PROD", status: "RUNNING" } }),
                prisma.agentRun.count({ where: { runType: "PROD", status: "COMPLETED" } }),
                prisma.agentRun.count({ where: { runType: "PROD", status: "FAILED" } }),
                prisma.agentRun.count({ where: { runType: "PROD", status: "CANCELLED" } })
            ])
        ]);

        const [total, queued, running, completed, failed, cancelled] = counts;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const formattedRuns = runs.map((run: any) => ({
            id: run.id,
            agentId: run.agentId,
            agentSlug: run.agent.slug,
            agentName: run.agent.name,
            runType: run.runType,
            status: run.status,
            source: run.source || null,
            sessionId: run.sessionId || null,
            threadId: run.threadId || null,
            inputText: run.inputText,
            outputText: run.outputText,
            durationMs: run.durationMs,
            startedAt: run.startedAt.toISOString(),
            completedAt: run.completedAt?.toISOString() || null,
            modelProvider: run.modelProvider,
            modelName: run.modelName,
            totalTokens: run.totalTokens,
            costUsd: run.costUsd
        }));

        return NextResponse.json({
            success: true,
            runs: formattedRuns,
            counts: {
                total,
                queued,
                running,
                completed,
                failed,
                cancelled
            },
            pagination: {
                limit,
                offset,
                hasMore: offset + runs.length < total
            }
        });
    } catch (error) {
        console.error("[Live Runs] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch production runs" },
            { status: 500 }
        );
    }
}
