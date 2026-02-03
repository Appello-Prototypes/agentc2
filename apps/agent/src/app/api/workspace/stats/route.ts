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
                startedAt: true,
                durationMs: true,
                totalTokens: true,
                costUsd: true
            }
        });

        const startDay = new Date(startDate);
        startDay.setHours(0, 0, 0, 0);
        const endDay = new Date(endDate);
        endDay.setHours(0, 0, 0, 0);
        const dateKeys: string[] = [];
        for (let d = new Date(startDay); d <= endDay; d.setDate(d.getDate() + 1)) {
            dateKeys.push(d.toISOString().split("T")[0]);
        }
        const trendDates = dateKeys.slice(-14);

        // Group runs by agent and calculate stats
        const statsByAgent = new Map<
            string,
            {
                totalRuns: number;
                completedRuns: number;
                failedRuns: number;
                queuedRuns: number;
                runningRuns: number;
                cancelledRuns: number;
                totalDurationMs: number;
                totalTokens: number;
                totalCostUsd: number;
                lastRunAt: Date | null;
                lastFailedAt: Date | null;
            }
        >();
        const dailyByAgent = new Map<
            string,
            Map<
                string,
                { runs: number; costUsd: number; latencyTotal: number; latencyCount: number }
            >
        >();

        for (const run of runs) {
            const existing = statsByAgent.get(run.agentId) || {
                totalRuns: 0,
                completedRuns: 0,
                failedRuns: 0,
                queuedRuns: 0,
                runningRuns: 0,
                cancelledRuns: 0,
                totalDurationMs: 0,
                totalTokens: 0,
                totalCostUsd: 0,
                lastRunAt: null,
                lastFailedAt: null
            };

            const status = run.status?.toUpperCase();
            const startedAt = run.startedAt;

            statsByAgent.set(run.agentId, {
                totalRuns: existing.totalRuns + 1,
                completedRuns: existing.completedRuns + (status === "COMPLETED" ? 1 : 0),
                failedRuns: existing.failedRuns + (status === "FAILED" ? 1 : 0),
                queuedRuns: existing.queuedRuns + (status === "QUEUED" ? 1 : 0),
                runningRuns: existing.runningRuns + (status === "RUNNING" ? 1 : 0),
                cancelledRuns: existing.cancelledRuns + (status === "CANCELLED" ? 1 : 0),
                totalDurationMs: existing.totalDurationMs + (run.durationMs || 0),
                totalTokens: existing.totalTokens + (run.totalTokens || 0),
                totalCostUsd: existing.totalCostUsd + (run.costUsd || 0),
                lastRunAt:
                    !existing.lastRunAt || startedAt > existing.lastRunAt
                        ? startedAt
                        : existing.lastRunAt,
                lastFailedAt:
                    status === "FAILED" &&
                    (!existing.lastFailedAt || startedAt > existing.lastFailedAt)
                        ? startedAt
                        : existing.lastFailedAt
            });

            const dayKey = startedAt.toISOString().split("T")[0];
            const agentDaily = dailyByAgent.get(run.agentId) || new Map();
            const daily = agentDaily.get(dayKey) || {
                runs: 0,
                costUsd: 0,
                latencyTotal: 0,
                latencyCount: 0
            };

            daily.runs += 1;
            daily.costUsd += run.costUsd || 0;
            if (run.durationMs) {
                daily.latencyTotal += run.durationMs;
                daily.latencyCount += 1;
            }

            agentDaily.set(dayKey, daily);
            dailyByAgent.set(run.agentId, agentDaily);
        }

        // Build agent stats response
        const agentStats = agents.map((agent) => {
            const stats = statsByAgent.get(agent.id) || {
                totalRuns: 0,
                completedRuns: 0,
                failedRuns: 0,
                queuedRuns: 0,
                runningRuns: 0,
                cancelledRuns: 0,
                totalDurationMs: 0,
                totalTokens: 0,
                totalCostUsd: 0,
                lastRunAt: null,
                lastFailedAt: null
            };

            const successRate =
                stats.totalRuns > 0 ? (stats.completedRuns / stats.totalRuns) * 100 : 0;
            const avgLatencyMs =
                stats.completedRuns > 0 ? stats.totalDurationMs / stats.completedRuns : 0;
            const agentDaily = dailyByAgent.get(agent.id);
            const trends =
                stats.totalRuns > 0 && agentDaily
                    ? trendDates.map((date) => {
                          const day = agentDaily.get(date) || {
                              runs: 0,
                              costUsd: 0,
                              latencyTotal: 0,
                              latencyCount: 0
                          };
                          const avgLatency =
                              day.latencyCount > 0 ? day.latencyTotal / day.latencyCount : 0;
                          return {
                              date,
                              runs: day.runs,
                              costUsd: Math.round(day.costUsd * 10000) / 10000,
                              avgLatencyMs: Math.round(avgLatency)
                          };
                      })
                    : [];

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
                    queuedRuns: stats.queuedRuns,
                    runningRuns: stats.runningRuns,
                    cancelledRuns: stats.cancelledRuns,
                    totalTokens: stats.totalTokens,
                    totalCostUsd: Math.round(stats.totalCostUsd * 10000) / 10000,
                    lastRunAt: stats.lastRunAt ? stats.lastRunAt.toISOString() : null,
                    lastFailedAt: stats.lastFailedAt ? stats.lastFailedAt.toISOString() : null
                },
                trends
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
