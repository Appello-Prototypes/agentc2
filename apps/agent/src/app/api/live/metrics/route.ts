import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";

function percentile(sorted: number[], p: number) {
    if (sorted.length === 0) return 0;
    const index = Math.ceil(p * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

/**
 * GET /api/live/metrics
 *
 * Returns aggregate performance metrics for Live Runs.
 *
 * Query Parameters:
 * - runType: Filter by run type (PROD, TEST, AB, all)
 * - from/to: Date range filter (ISO)
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const runType = searchParams.get("runType") || "PROD";
        const from = searchParams.get("from");
        const to = searchParams.get("to");

        const baseWhere: Prisma.AgentRunWhereInput = {};
        const startedAtFilter: Prisma.DateTimeFilter = {};

        if (runType && runType.toLowerCase() !== "all") {
            baseWhere.runType = runType.toUpperCase() as Prisma.EnumRunTypeFilter;
        }

        if (from) {
            startedAtFilter.gte = new Date(from);
        }

        if (to) {
            startedAtFilter.lte = new Date(to);
        }

        if (Object.keys(startedAtFilter).length > 0) {
            baseWhere.startedAt = startedAtFilter;
        }

        const [
            totalRuns,
            completedRuns,
            failedRuns,
            runningRuns,
            queuedRuns,
            cancelledRuns,
            aggregate,
            totalToolCalls,
            durationRows,
            slowRuns,
            expensiveRuns,
            agentTotals,
            agentStatusCounts,
            modelTotals,
            modelStatusCounts,
            versionTotals,
            versionStatusCounts
        ] = await Promise.all([
            prisma.agentRun.count({ where: baseWhere }),
            prisma.agentRun.count({ where: { ...baseWhere, status: "COMPLETED" } }),
            prisma.agentRun.count({ where: { ...baseWhere, status: "FAILED" } }),
            prisma.agentRun.count({ where: { ...baseWhere, status: "RUNNING" } }),
            prisma.agentRun.count({ where: { ...baseWhere, status: "QUEUED" } }),
            prisma.agentRun.count({ where: { ...baseWhere, status: "CANCELLED" } }),
            prisma.agentRun.aggregate({
                where: baseWhere,
                _avg: { durationMs: true },
                _sum: { totalTokens: true, costUsd: true }
            }),
            prisma.agentToolCall.count({ where: { run: baseWhere } }),
            prisma.agentRun.findMany({
                where: { ...baseWhere, durationMs: { not: null } },
                select: { durationMs: true },
                orderBy: { startedAt: "desc" },
                take: 1000
            }),
            prisma.agentRun.findMany({
                where: { ...baseWhere, durationMs: { not: null } },
                include: { agent: { select: { id: true, name: true, slug: true } } },
                orderBy: { durationMs: "desc" },
                take: 5
            }),
            prisma.agentRun.findMany({
                where: { ...baseWhere, costUsd: { not: null } },
                include: { agent: { select: { id: true, name: true, slug: true } } },
                orderBy: { costUsd: "desc" },
                take: 5
            }),
            prisma.agentRun.groupBy({
                by: ["agentId"],
                where: baseWhere,
                _avg: { durationMs: true, totalTokens: true, costUsd: true },
                _count: { _all: true }
            }),
            prisma.agentRun.groupBy({
                by: ["agentId", "status"],
                where: baseWhere,
                _count: { _all: true }
            }),
            prisma.agentRun.groupBy({
                by: ["modelName", "modelProvider"],
                where: { ...baseWhere, modelName: { not: null } },
                _avg: { durationMs: true },
                _sum: { totalTokens: true, costUsd: true },
                _count: { _all: true }
            }),
            prisma.agentRun.groupBy({
                by: ["modelName", "modelProvider", "status"],
                where: { ...baseWhere, modelName: { not: null } },
                _count: { _all: true }
            }),
            prisma.agentRun.groupBy({
                by: ["versionId"],
                where: { ...baseWhere, versionId: { not: null } },
                _avg: { durationMs: true, totalTokens: true, costUsd: true },
                _count: { _all: true }
            }),
            prisma.agentRun.groupBy({
                by: ["versionId", "status"],
                where: { ...baseWhere, versionId: { not: null } },
                _count: { _all: true }
            })
        ]);

        const durations = durationRows
            .map((row) => row.durationMs || 0)
            .filter((value) => value > 0)
            .sort((a, b) => a - b);

        const latency = {
            p50: percentile(durations, 0.5),
            p95: percentile(durations, 0.95),
            sampleSize: durations.length
        };

        const successRate = totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0;
        const avgToolCalls = totalRuns > 0 ? totalToolCalls / totalRuns : 0;

        const agentIds = agentTotals.map((row) => row.agentId);
        const agents = await prisma.agent.findMany({
            where: { id: { in: agentIds } },
            select: { id: true, name: true, slug: true }
        });
        const agentMap = new Map(agents.map((agent) => [agent.id, agent]));

        const agentFailureMap = new Map<string, { total: number; failed: number }>();
        for (const row of agentStatusCounts) {
            const current = agentFailureMap.get(row.agentId) || { total: 0, failed: 0 };
            current.total += row._count._all;
            if (row.status === "FAILED") {
                current.failed += row._count._all;
            }
            agentFailureMap.set(row.agentId, current);
        }

        const agentToolCallCounts = await Promise.all(
            agentIds.map(async (agentId) => {
                const count = await prisma.agentToolCall.count({
                    where: { run: { ...baseWhere, agentId } }
                });
                return [agentId, count] as const;
            })
        );
        const agentToolMap = new Map(agentToolCallCounts);

        const perAgent = agentTotals.map((row) => {
            const agent = agentMap.get(row.agentId);
            const failure = agentFailureMap.get(row.agentId) || {
                total: row._count._all,
                failed: 0
            };
            const toolCalls = agentToolMap.get(row.agentId) || 0;
            const avgToolCallsForAgent = row._count._all > 0 ? toolCalls / row._count._all : 0;

            return {
                agentId: row.agentId,
                agentName: agent?.name || "Unknown",
                agentSlug: agent?.slug || "unknown",
                totalRuns: row._count._all,
                successRate:
                    failure.total > 0
                        ? Math.round(((failure.total - failure.failed) / failure.total) * 100)
                        : 0,
                failureRate:
                    failure.total > 0 ? Math.round((failure.failed / failure.total) * 100) : 0,
                avgLatencyMs: Math.round(row._avg.durationMs || 0),
                avgToolCalls: avgToolCallsForAgent,
                avgTokens: Math.round(row._avg.totalTokens || 0),
                avgCostUsd: row._avg.costUsd || 0
            };
        });

        const modelStatusMap = new Map<string, { total: number; failed: number }>();
        for (const row of modelStatusCounts) {
            const key = `${row.modelProvider || "unknown"}::${row.modelName || "unknown"}`;
            const current = modelStatusMap.get(key) || { total: 0, failed: 0 };
            current.total += row._count._all;
            if (row.status === "FAILED") {
                current.failed += row._count._all;
            }
            modelStatusMap.set(key, current);
        }

        const modelUsage = modelTotals.map((row) => {
            const key = `${row.modelProvider || "unknown"}::${row.modelName || "unknown"}`;
            const status = modelStatusMap.get(key) || { total: row._count._all, failed: 0 };
            const failureRate =
                status.total > 0 ? Math.round((status.failed / status.total) * 100) : 0;

            return {
                modelName: row.modelName,
                modelProvider: row.modelProvider,
                runs: row._count._all,
                avgLatencyMs: Math.round(row._avg.durationMs || 0),
                totalTokens: row._sum.totalTokens || 0,
                totalCostUsd: row._sum.costUsd || 0,
                failureRate
            };
        });

        const versionIds = Array.from(
            new Set(versionTotals.map((row) => row.versionId).filter(Boolean))
        ) as string[];
        const versionRecords =
            versionIds.length > 0
                ? await prisma.agentVersion.findMany({
                      where: { id: { in: versionIds } },
                      select: {
                          id: true,
                          version: true,
                          agentId: true,
                          modelProvider: true,
                          modelName: true,
                          createdAt: true
                      }
                  })
                : [];

        const versionRecordMap = new Map(versionRecords.map((row) => [row.id, row]));

        const versionStatusMap = new Map<string, { total: number; failed: number }>();
        for (const row of versionStatusCounts) {
            if (!row.versionId) continue;
            const current = versionStatusMap.get(row.versionId) || { total: 0, failed: 0 };
            current.total += row._count._all;
            if (row.status === "FAILED") {
                current.failed += row._count._all;
            }
            versionStatusMap.set(row.versionId, current);
        }

        const perVersion = versionTotals
            .filter((row) => Boolean(row.versionId))
            .map((row) => {
                const versionRecord = row.versionId
                    ? versionRecordMap.get(row.versionId)
                    : undefined;
                const status = row.versionId ? versionStatusMap.get(row.versionId) : undefined;
                const total = status?.total ?? row._count._all;
                const failed = status?.failed ?? 0;

                return {
                    versionId: row.versionId,
                    agentId: versionRecord?.agentId || null,
                    versionNumber: versionRecord?.version || null,
                    modelProvider: versionRecord?.modelProvider || null,
                    modelName: versionRecord?.modelName || null,
                    createdAt: versionRecord?.createdAt || null,
                    totalRuns: row._count._all,
                    successRate: total > 0 ? Math.round(((total - failed) / total) * 100) : 0,
                    failureRate: total > 0 ? Math.round((failed / total) * 100) : 0,
                    avgLatencyMs: Math.round(row._avg.durationMs || 0),
                    avgTokens: Math.round(row._avg.totalTokens || 0),
                    avgCostUsd: row._avg.costUsd || 0
                };
            });

        return NextResponse.json({
            success: true,
            summary: {
                totalRuns,
                completedRuns,
                failedRuns,
                runningRuns,
                queuedRuns,
                cancelledRuns,
                successRate,
                avgLatencyMs: Math.round(aggregate._avg.durationMs || 0),
                avgToolCalls,
                totalTokens: aggregate._sum.totalTokens || 0,
                totalCostUsd: aggregate._sum.costUsd || 0
            },
            latency,
            topRuns: {
                slowest: slowRuns.map((run) => ({
                    id: run.id,
                    agentId: run.agentId,
                    agentName: run.agent.name,
                    agentSlug: run.agent.slug,
                    status: run.status,
                    durationMs: run.durationMs,
                    modelName: run.modelName,
                    modelProvider: run.modelProvider,
                    startedAt: run.startedAt,
                    costUsd: run.costUsd,
                    totalTokens: run.totalTokens
                })),
                mostExpensive: expensiveRuns.map((run) => ({
                    id: run.id,
                    agentId: run.agentId,
                    agentName: run.agent.name,
                    agentSlug: run.agent.slug,
                    status: run.status,
                    durationMs: run.durationMs,
                    modelName: run.modelName,
                    modelProvider: run.modelProvider,
                    startedAt: run.startedAt,
                    costUsd: run.costUsd,
                    totalTokens: run.totalTokens
                }))
            },
            perAgent,
            perVersion,
            modelUsage,
            dateRange: {
                from: from || null,
                to: to || null
            }
        });
    } catch (error) {
        console.error("[Live Metrics] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch live metrics" },
            { status: 500 }
        );
    }
}
