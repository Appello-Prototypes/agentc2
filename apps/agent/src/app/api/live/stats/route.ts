import { NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /api/live/stats
 *
 * Returns production statistics for all agents, filtered to PROD runs only.
 * Used by the Live dashboard to show real-time production metrics.
 */
export async function GET() {
    try {
        // Get all agents with their production run stats
        const agents = await prisma.agent.findMany({
            where: { isActive: true },
            select: {
                id: true,
                slug: true,
                name: true,
                isActive: true
            }
        });

        // Get production run stats per agent
        const agentStats = await Promise.all(
            agents.map(async (agent) => {
                const [runs, latestRun, completed] = await Promise.all([
                    // Aggregate stats for PROD runs
                    prisma.agentRun.aggregate({
                        where: {
                            agentId: agent.id,
                            runType: "PROD"
                        },
                        _count: { id: true },
                        _avg: { durationMs: true },
                        _sum: {
                            totalTokens: true,
                            costUsd: true
                        }
                    }),
                    // Latest run
                    prisma.agentRun.findFirst({
                        where: {
                            agentId: agent.id,
                            runType: "PROD"
                        },
                        orderBy: { startedAt: "desc" },
                        select: { startedAt: true, source: true }
                    }),
                    // Completed count
                    prisma.agentRun.count({
                        where: { agentId: agent.id, runType: "PROD", status: "COMPLETED" }
                    })
                ]);

                const totalRuns = runs._count.id;
                const successRate = totalRuns > 0 ? Math.round((completed / totalRuns) * 100) : 0;

                // Get unique sources from recent runs
                const recentRuns = await prisma.agentRun.findMany({
                    where: {
                        agentId: agent.id,
                        runType: "PROD",
                        source: { not: null }
                    },
                    select: { source: true },
                    distinct: ["source"],
                    take: 10
                });

                const sourceCounts: Record<string, number> = {};
                for (const run of recentRuns) {
                    if (run.source) {
                        const count = await prisma.agentRun.count({
                            where: {
                                agentId: agent.id,
                                runType: "PROD",
                                source: run.source
                            }
                        });
                        sourceCounts[run.source] = count;
                    }
                }

                return {
                    id: agent.id,
                    slug: agent.slug,
                    name: agent.name,
                    isActive: agent.isActive,
                    prodRuns: totalRuns,
                    successRate,
                    avgLatencyMs: Math.round(runs._avg.durationMs || 0),
                    totalTokens: runs._sum.totalTokens || 0,
                    totalCostUsd: runs._sum.costUsd || 0,
                    sources: Object.entries(sourceCounts).map(([source, count]) => ({
                        source,
                        count
                    })),
                    lastRunAt: latestRun?.startedAt?.toISOString() || null
                };
            })
        );

        // Filter to agents with production runs
        const activeAgents = agentStats.filter((a) => a.prodRuns > 0);

        // Overall summary
        const [totalProdRuns, completedRuns, failedRuns, overallStats] = await Promise.all([
            prisma.agentRun.count({ where: { runType: "PROD" } }),
            prisma.agentRun.count({ where: { runType: "PROD", status: "COMPLETED" } }),
            prisma.agentRun.count({ where: { runType: "PROD", status: "FAILED" } }),
            prisma.agentRun.aggregate({
                where: { runType: "PROD" },
                _avg: { durationMs: true },
                _sum: { totalTokens: true, costUsd: true }
            })
        ]);

        // Get unique sources across all production runs
        const allSources = await prisma.agentRun.findMany({
            where: { runType: "PROD", source: { not: null } },
            select: { source: true },
            distinct: ["source"]
        });

        const runsBySource: { source: string; count: number }[] = [];
        for (const s of allSources) {
            if (s.source) {
                const count = await prisma.agentRun.count({
                    where: { runType: "PROD", source: s.source }
                });
                runsBySource.push({ source: s.source, count });
            }
        }

        const summary = {
            totalProdRuns,
            completedRuns,
            failedRuns,
            successRate: totalProdRuns > 0 ? Math.round((completedRuns / totalProdRuns) * 100) : 0,
            avgLatencyMs: Math.round(overallStats._avg.durationMs || 0),
            totalTokens: overallStats._sum.totalTokens || 0,
            totalCostUsd: overallStats._sum.costUsd || 0,
            runsBySource,
            activeAgents: activeAgents.length
        };

        return NextResponse.json({
            success: true,
            agents: activeAgents,
            summary
        });
    } catch (error) {
        console.error("[Live Stats] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch production stats" },
            { status: 500 }
        );
    }
}
