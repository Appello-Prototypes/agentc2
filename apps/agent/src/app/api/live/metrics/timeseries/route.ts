import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";

/**
 * GET /api/live/metrics/timeseries
 *
 * Returns time-bucketed metrics for charting: runs, cost, latency, tokens, failures.
 *
 * Query params:
 *   runType  – PROD | DEV | all (default PROD)
 *   from/to  – ISO date range
 *   buckets  – number of time buckets (default 24, max 120)
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const runType = searchParams.get("runType") || "PROD";
        const from = searchParams.get("from");
        const to = searchParams.get("to");
        const bucketCount = Math.min(
            Math.max(parseInt(searchParams.get("buckets") || "24", 10) || 24, 4),
            120
        );

        const now = new Date();
        const rangeFrom = from ? new Date(from) : new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const rangeTo = to ? new Date(to) : now;
        const rangeMs = rangeTo.getTime() - rangeFrom.getTime();
        const bucketMs = Math.max(rangeMs / bucketCount, 1);

        const baseWhere: Prisma.AgentRunWhereInput = {
            startedAt: { gte: rangeFrom, lte: rangeTo }
        };
        if (runType && runType.toLowerCase() !== "all") {
            baseWhere.runType = runType.toUpperCase() as Prisma.EnumRunTypeFilter;
        }

        const runs = await prisma.agentRun.findMany({
            where: baseWhere,
            select: {
                startedAt: true,
                status: true,
                durationMs: true,
                totalTokens: true,
                costUsd: true,
                agentId: true,
                agent: { select: { name: true } }
            },
            orderBy: { startedAt: "asc" }
        });

        interface Bucket {
            time: string;
            runs: number;
            completed: number;
            failed: number;
            avgLatencyMs: number;
            totalTokens: number;
            totalCost: number;
            _latencies: number[];
        }

        const buckets: Bucket[] = Array.from({ length: bucketCount }, (_, i) => ({
            time: new Date(rangeFrom.getTime() + i * bucketMs).toISOString(),
            runs: 0,
            completed: 0,
            failed: 0,
            avgLatencyMs: 0,
            totalTokens: 0,
            totalCost: 0,
            _latencies: []
        }));

        const agentMap = new Map<
            string,
            { name: string; runs: number; cost: number; tokens: number }
        >();

        for (const run of runs) {
            const idx = Math.min(
                Math.floor((run.startedAt.getTime() - rangeFrom.getTime()) / bucketMs),
                bucketCount - 1
            );
            const bucket = buckets[idx];
            bucket.runs++;
            if (run.status === "COMPLETED") bucket.completed++;
            if (run.status === "FAILED") bucket.failed++;
            if (run.durationMs != null) bucket._latencies.push(run.durationMs);
            if (run.totalTokens != null) bucket.totalTokens += run.totalTokens;
            if (run.costUsd != null) bucket.totalCost += run.costUsd;

            const existing = agentMap.get(run.agentId);
            if (existing) {
                existing.runs++;
                existing.cost += run.costUsd || 0;
                existing.tokens += run.totalTokens || 0;
            } else {
                agentMap.set(run.agentId, {
                    name: run.agent.name,
                    runs: 1,
                    cost: run.costUsd || 0,
                    tokens: run.totalTokens || 0
                });
            }
        }

        for (const bucket of buckets) {
            if (bucket._latencies.length > 0) {
                bucket.avgLatencyMs = Math.round(
                    bucket._latencies.reduce((a, b) => a + b, 0) / bucket._latencies.length
                );
            }
            // Round cost for cleaner charts
            bucket.totalCost = Math.round(bucket.totalCost * 10000) / 10000;
        }

        // Strip internal field
        const timeseries = buckets.map(({ _latencies, ...rest }) => rest);

        // Cumulative cost for running total chart
        let cumCost = 0;
        const cumulativeCost = timeseries.map((b) => {
            cumCost += b.totalCost;
            return { time: b.time, cost: Math.round(cumCost * 10000) / 10000 };
        });

        // Per-agent breakdown sorted by runs desc
        const agentBreakdown = [...agentMap.entries()]
            .map(([id, data]) => ({
                agentId: id,
                ...data,
                cost: Math.round(data.cost * 10000) / 10000
            }))
            .sort((a, b) => b.runs - a.runs);

        return NextResponse.json({
            success: true,
            timeseries,
            cumulativeCost,
            agentBreakdown,
            totalRuns: runs.length
        });
    } catch (error) {
        console.error("[Timeseries Metrics] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch timeseries metrics" },
            { status: 500 }
        );
    }
}
