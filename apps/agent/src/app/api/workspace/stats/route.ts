import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /api/workspace/stats
 *
 * Get aggregated stats for all agents in the workspace
 * Returns per-agent stats including runs, success rate, and latency
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const from = searchParams.get("from");
        const to = searchParams.get("to");

        // Default to last 30 days if no date range provided
        const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = to ? new Date(to) : new Date();

        // Get all active agents
        const agents = await prisma.agent.findMany({
            where: { isActive: true },
            select: {
                id: true,
                slug: true,
                name: true,
                description: true,
                type: true,
                modelProvider: true,
                modelName: true,
                memoryEnabled: true,
                scorers: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
                tools: {
                    select: { toolId: true }
                }
            },
            orderBy: { name: "asc" }
        });

        // Get runs for all agents in the date range
        const runs = await prisma.agentRun.findMany({
            where: {
                startedAt: {
                    gte: startDate,
                    lte: endDate
                }
            },
            select: {
                agentId: true,
                status: true,
                durationMs: true,
                totalTokens: true,
                costUsd: true
            }
        });

        // Group runs by agent and calculate stats
        const statsByAgent = new Map<
            string,
            {
                totalRuns: number;
                completedRuns: number;
                failedRuns: number;
                totalDurationMs: number;
                totalTokens: number;
                totalCostUsd: number;
            }
        >();

        for (const run of runs) {
            const existing = statsByAgent.get(run.agentId) || {
                totalRuns: 0,
                completedRuns: 0,
                failedRuns: 0,
                totalDurationMs: 0,
                totalTokens: 0,
                totalCostUsd: 0
            };

            statsByAgent.set(run.agentId, {
                totalRuns: existing.totalRuns + 1,
                completedRuns: existing.completedRuns + (run.status === "COMPLETED" ? 1 : 0),
                failedRuns: existing.failedRuns + (run.status === "FAILED" ? 1 : 0),
                totalDurationMs: existing.totalDurationMs + (run.durationMs || 0),
                totalTokens: existing.totalTokens + (run.totalTokens || 0),
                totalCostUsd: existing.totalCostUsd + (run.costUsd || 0)
            });
        }

        // Build agent stats response
        const agentStats = agents.map((agent) => {
            const stats = statsByAgent.get(agent.id) || {
                totalRuns: 0,
                completedRuns: 0,
                failedRuns: 0,
                totalDurationMs: 0,
                totalTokens: 0,
                totalCostUsd: 0
            };

            const successRate =
                stats.totalRuns > 0 ? (stats.completedRuns / stats.totalRuns) * 100 : 0;
            const avgLatencyMs =
                stats.completedRuns > 0 ? stats.totalDurationMs / stats.completedRuns : 0;

            return {
                id: agent.id,
                slug: agent.slug,
                name: agent.name,
                description: agent.description,
                type: agent.type,
                modelProvider: agent.modelProvider,
                modelName: agent.modelName,
                memoryEnabled: agent.memoryEnabled,
                scorers: agent.scorers,
                toolCount: agent.tools.length,
                isActive: agent.isActive,
                createdAt: agent.createdAt,
                updatedAt: agent.updatedAt,
                stats: {
                    runs: stats.totalRuns,
                    successRate: Math.round(successRate * 10) / 10,
                    avgLatencyMs: Math.round(avgLatencyMs),
                    completedRuns: stats.completedRuns,
                    failedRuns: stats.failedRuns,
                    totalTokens: stats.totalTokens,
                    totalCostUsd: Math.round(stats.totalCostUsd * 10000) / 10000
                }
            };
        });

        // Calculate workspace-wide summary
        const totalRuns = runs.length;
        const completedRuns = runs.filter((r) => r.status === "COMPLETED").length;
        const failedRuns = runs.filter((r) => r.status === "FAILED").length;
        const successRate = totalRuns > 0 ? (completedRuns / totalRuns) * 100 : 0;

        const durations = runs.filter((r) => r.durationMs).map((r) => r.durationMs!);
        const avgLatencyMs =
            durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

        const totalTokens = runs.reduce((sum, r) => sum + (r.totalTokens || 0), 0);
        const totalCostUsd = runs.reduce((sum, r) => sum + (r.costUsd || 0), 0);

        return NextResponse.json({
            success: true,
            agents: agentStats,
            summary: {
                totalAgents: agents.length,
                activeAgents: agents.filter((a) => a.isActive).length,
                systemAgents: agents.filter((a) => a.type === "SYSTEM").length,
                userAgents: agents.filter((a) => a.type === "USER").length,
                totalRuns,
                completedRuns,
                failedRuns,
                successRate: Math.round(successRate * 10) / 10,
                avgLatencyMs: Math.round(avgLatencyMs),
                totalTokens,
                totalCostUsd: Math.round(totalCostUsd * 10000) / 10000
            },
            dateRange: {
                from: startDate.toISOString(),
                to: endDate.toISOString()
            }
        });
    } catch (error) {
        console.error("[Workspace Stats] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get workspace stats"
            },
            { status: 500 }
        );
    }
}
