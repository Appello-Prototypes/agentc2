import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /api/agents/[id]/analytics
 *
 * Get analytics summary for an agent (on-demand aggregation)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);

        const from = searchParams.get("from");
        const to = searchParams.get("to");
        // Type parameter reserved for future use (e.g., "summary", "detailed")
        // const type = searchParams.get("type") || "summary";

        // Default to last 30 days if no date range provided
        const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = to ? new Date(to) : new Date();

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

        // Build base where clause
        const baseWhere = {
            agentId: agent.id,
            startedAt: {
                gte: startDate,
                lte: endDate
            }
        };

        // Get runs data
        const runs = await prisma.agentRun.findMany({
            where: baseWhere,
            select: {
                id: true,
                status: true,
                durationMs: true,
                totalTokens: true,
                costUsd: true,
                modelProvider: true,
                modelName: true,
                startedAt: true
            }
        });

        // Calculate summary metrics
        const totalRuns = runs.length;
        const completedRuns = runs.filter((r) => r.status === "COMPLETED").length;
        const failedRuns = runs.filter((r) => r.status === "FAILED").length;
        const successRate = totalRuns > 0 ? (completedRuns / totalRuns) * 100 : 0;

        const durations = runs.filter((r) => r.durationMs).map((r) => r.durationMs!);
        const avgLatencyMs =
            durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

        // Sort for percentiles
        durations.sort((a, b) => a - b);
        const p50 = durations[Math.floor(durations.length * 0.5)] || 0;
        const p95 = durations[Math.floor(durations.length * 0.95)] || 0;
        const p99 = durations[Math.floor(durations.length * 0.99)] || 0;

        const totalTokens = runs.reduce((sum, r) => sum + (r.totalTokens || 0), 0);
        const totalCostUsd = runs.reduce((sum, r) => sum + (r.costUsd || 0), 0);

        // Group runs by day for trend
        const runsByDay = new Map<string, { total: number; completed: number; failed: number }>();
        for (const run of runs) {
            const day = run.startedAt.toISOString().split("T")[0];
            const existing = runsByDay.get(day) || { total: 0, completed: 0, failed: 0 };
            runsByDay.set(day, {
                total: existing.total + 1,
                completed: existing.completed + (run.status === "COMPLETED" ? 1 : 0),
                failed: existing.failed + (run.status === "FAILED" ? 1 : 0)
            });
        }

        // Get tool usage
        const toolCalls = await prisma.agentToolCall.findMany({
            where: {
                run: baseWhere
            },
            select: {
                toolKey: true,
                success: true,
                durationMs: true
            }
        });

        const toolUsage = new Map<
            string,
            { calls: number; success: number; totalDurationMs: number }
        >();
        for (const call of toolCalls) {
            const existing = toolUsage.get(call.toolKey) || {
                calls: 0,
                success: 0,
                totalDurationMs: 0
            };
            toolUsage.set(call.toolKey, {
                calls: existing.calls + 1,
                success: existing.success + (call.success ? 1 : 0),
                totalDurationMs: existing.totalDurationMs + (call.durationMs || 0)
            });
        }

        // Get evaluations
        const evaluations = await prisma.agentEvaluation.findMany({
            where: {
                agentId: agent.id,
                createdAt: {
                    gte: startDate,
                    lte: endDate
                }
            },
            select: { scoresJson: true }
        });

        // Calculate quality scores
        const qualityByScorer = new Map<string, { total: number; count: number }>();
        for (const eval_ of evaluations) {
            const scores = eval_.scoresJson as Record<string, number>;
            if (scores) {
                for (const [key, value] of Object.entries(scores)) {
                    if (typeof value === "number") {
                        const existing = qualityByScorer.get(key) || { total: 0, count: 0 };
                        qualityByScorer.set(key, {
                            total: existing.total + value,
                            count: existing.count + 1
                        });
                    }
                }
            }
        }

        // Get feedback summary
        const feedback = await prisma.agentFeedback.findMany({
            where: {
                agentId: agent.id,
                createdAt: {
                    gte: startDate,
                    lte: endDate
                }
            },
            select: { thumbs: true, rating: true }
        });

        const positiveFeedback = feedback.filter((f) => f.thumbs === true).length;
        const negativeFeedback = feedback.filter((f) => f.thumbs === false).length;

        // Model usage
        const modelUsage = new Map<
            string,
            { runs: number; tokens: number; cost: number; totalLatency: number }
        >();
        for (const run of runs) {
            const model = `${run.modelProvider}/${run.modelName}`;
            const existing = modelUsage.get(model) || {
                runs: 0,
                tokens: 0,
                cost: 0,
                totalLatency: 0
            };
            modelUsage.set(model, {
                runs: existing.runs + 1,
                tokens: existing.tokens + (run.totalTokens || 0),
                cost: existing.cost + (run.costUsd || 0),
                totalLatency: existing.totalLatency + (run.durationMs || 0)
            });
        }

        return NextResponse.json({
            success: true,
            summary: {
                totalRuns,
                completedRuns,
                failedRuns,
                successRate: Math.round(successRate * 100) / 100,
                avgLatencyMs: Math.round(avgLatencyMs),
                totalTokens,
                totalCostUsd: Math.round(totalCostUsd * 10000) / 10000
            },
            latency: {
                avg: Math.round(avgLatencyMs),
                p50: Math.round(p50),
                p95: Math.round(p95),
                p99: Math.round(p99),
                histogram: durations.slice(0, 100) // Sample for histogram
            },
            trends: {
                runs: Array.from(runsByDay.entries())
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([date, data]) => ({
                        date,
                        total: data.total,
                        completed: data.completed,
                        failed: data.failed,
                        successRate:
                            data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0
                    }))
            },
            toolUsage: Array.from(toolUsage.entries()).map(([tool, data]) => ({
                tool,
                calls: data.calls,
                successRate: Math.round((data.success / data.calls) * 100),
                avgDurationMs: Math.round(data.totalDurationMs / data.calls)
            })),
            quality: {
                scorers: Array.from(qualityByScorer.entries()).map(([scorer, data]) => ({
                    scorer,
                    avgScore: Math.round((data.total / data.count) * 100) / 100,
                    sampleCount: data.count
                })),
                feedback: {
                    positive: positiveFeedback,
                    negative: negativeFeedback,
                    total: feedback.length,
                    positiveRate:
                        feedback.length > 0
                            ? Math.round((positiveFeedback / feedback.length) * 100)
                            : 0
                }
            },
            models: Array.from(modelUsage.entries()).map(([model, data]) => ({
                model,
                runs: data.runs,
                tokens: data.tokens,
                costUsd: Math.round(data.cost * 10000) / 10000,
                avgLatencyMs: Math.round(data.totalLatency / data.runs)
            })),
            dateRange: {
                from: startDate.toISOString(),
                to: endDate.toISOString()
            }
        });
    } catch (error) {
        console.error("[Agent Analytics] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get analytics"
            },
            { status: 500 }
        );
    }
}
