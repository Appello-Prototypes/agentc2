import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { prisma, Prisma } from "@repo/database";

function percentile(sorted: number[], p: number) {
    if (sorted.length === 0) return 0;
    const index = Math.ceil(p * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

async function resolveAgent(agentId: string) {
    return prisma.agent.findFirst({
        where: { OR: [{ slug: agentId }, { id: agentId }] }
    });
}

export const metricsLiveSummaryTool = createTool({
    id: "metrics-live-summary",
    description: "Get live run metrics summary with latency and top runs.",
    inputSchema: z.object({
        runType: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional()
    }),
    outputSchema: z.object({
        success: z.boolean(),
        summary: z.record(z.any()),
        latency: z.record(z.any()),
        topRuns: z.record(z.any()),
        perAgent: z.array(z.any()),
        modelUsage: z.array(z.any())
    }),
    execute: async ({ runType, from, to }) => {
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
            durationRows,
            slowRuns,
            expensiveRuns,
            agentTotals,
            agentStatusCounts,
            modelTotals,
            modelStatusCounts
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

        const perAgent = agentTotals.map((row) => {
            const agent = agentMap.get(row.agentId);
            const failure = agentFailureMap.get(row.agentId) || {
                total: row._count._all,
                failed: 0
            };

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

        return {
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
                totalTokens: aggregate._sum.totalTokens || 0,
                totalCostUsd: aggregate._sum.costUsd || 0
            },
            latency,
            topRuns: {
                slowest: slowRuns.map((run) => ({
                    id: run.id,
                    agentId: run.agentId,
                    agentName: run.agent?.name,
                    agentSlug: run.agent?.slug,
                    durationMs: run.durationMs,
                    startedAt: run.startedAt,
                    status: run.status,
                    costUsd: run.costUsd
                })),
                expensive: expensiveRuns.map((run) => ({
                    id: run.id,
                    agentId: run.agentId,
                    agentName: run.agent?.name,
                    agentSlug: run.agent?.slug,
                    durationMs: run.durationMs,
                    startedAt: run.startedAt,
                    status: run.status,
                    costUsd: run.costUsd
                }))
            },
            perAgent,
            modelUsage
        };
    }
});

export const metricsAgentAnalyticsTool = createTool({
    id: "metrics-agent-analytics",
    description: "Get analytics summary for an agent.",
    inputSchema: z.object({
        agentId: z.string(),
        from: z.string().optional(),
        to: z.string().optional()
    }),
    outputSchema: z.object({
        success: z.boolean(),
        summary: z.record(z.any()),
        latency: z.record(z.any()),
        trends: z.record(z.any()),
        toolUsage: z.array(z.any()),
        quality: z.record(z.any()),
        models: z.array(z.any()),
        dateRange: z.record(z.any())
    }),
    execute: async ({ agentId, from, to }) => {
        const agent = await resolveAgent(agentId);
        if (!agent) {
            throw new Error(`Agent '${agentId}' not found`);
        }

        const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = to ? new Date(to) : new Date();

        const baseWhere = {
            agentId: agent.id,
            startedAt: {
                gte: startDate,
                lte: endDate
            }
        };

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

        const totalRuns = runs.length;
        const completedRuns = runs.filter((r) => r.status === "COMPLETED").length;
        const failedRuns = runs.filter((r) => r.status === "FAILED").length;
        const successRate = totalRuns > 0 ? (completedRuns / totalRuns) * 100 : 0;

        const durations = runs.filter((r) => r.durationMs).map((r) => r.durationMs || 0);
        const avgLatencyMs =
            durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

        durations.sort((a, b) => a - b);
        const p50 = durations[Math.floor(durations.length * 0.5)] || 0;
        const p95 = durations[Math.floor(durations.length * 0.95)] || 0;
        const p99 = durations[Math.floor(durations.length * 0.99)] || 0;

        const totalTokens = runs.reduce((sum, r) => sum + (r.totalTokens || 0), 0);
        const totalCostUsd = runs.reduce((sum, r) => sum + (r.costUsd || 0), 0);

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

        return {
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
                histogram: durations.slice(0, 100)
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
        };
    }
});

export const metricsAgentRunsTool = createTool({
    id: "metrics-agent-runs",
    description: "List agent runs with filtering and pagination.",
    inputSchema: z.object({
        agentId: z.string(),
        status: z.string().optional(),
        search: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        cursor: z.string().optional(),
        triggerId: z.string().optional(),
        limit: z.number().optional(),
        source: z.string().optional()
    }),
    outputSchema: z.object({
        success: z.boolean(),
        runs: z.array(z.any()),
        hasMore: z.boolean(),
        total: z.number()
    }),
    execute: async ({ agentId, status, search, from, to, cursor, triggerId, limit, source }) => {
        const agent = await resolveAgent(agentId);
        if (!agent) {
            throw new Error(`Agent '${agentId}' not found`);
        }

        const take = Math.min(limit || 20, 100);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = { agentId: agent.id };

        if (source === "production") {
            where.AND = [
                ...(where.AND || []),
                { OR: [{ source: { not: "simulation" } }, { source: null }] }
            ];
        } else if (source === "simulation") {
            where.source = "simulation";
        }

        if (status) {
            where.status = status.toUpperCase();
        }

        if (search) {
            where.AND = [
                ...(where.AND || []),
                {
                    OR: [
                        { inputText: { contains: search, mode: "insensitive" } },
                        { outputText: { contains: search, mode: "insensitive" } }
                    ]
                }
            ];
        }

        if (from) {
            where.startedAt = { ...where.startedAt, gte: new Date(from) };
        }

        if (to) {
            where.startedAt = { ...where.startedAt, lte: new Date(to) };
        }

        if (cursor) {
            where.id = { lt: cursor };
        }

        if (triggerId && triggerId !== "all") {
            where.triggerId = triggerId;
        }

        const runs = await prisma.agentRun.findMany({
            where,
            orderBy: { startedAt: "desc" },
            take: take + 1,
            include: {
                trace: {
                    select: {
                        tokensJson: true,
                        stepsJson: true,
                        _count: { select: { steps: true, toolCalls: true } }
                    }
                },
                _count: {
                    select: { toolCalls: true }
                }
            }
        });

        const hasMore = runs.length > take;
        if (hasMore) {
            runs.pop();
        }

        const total = await prisma.agentRun.count({ where: { agentId: agent.id } });

        return {
            success: true,
            runs: runs.map((run) => {
                const stepsFromRelation = run.trace?._count.steps ?? 0;
                const stepsFromJson = Array.isArray(run.trace?.stepsJson)
                    ? (run.trace.stepsJson as unknown[]).length
                    : 0;
                const stepsCount = stepsFromRelation > 0 ? stepsFromRelation : stepsFromJson;

                const toolCallsCount = run.trace?._count.toolCalls ?? run._count.toolCalls ?? 0;

                const traceTokens = run.trace?.tokensJson as {
                    prompt?: number;
                    completion?: number;
                    total?: number;
                } | null;

                return {
                    id: run.id,
                    agentId: run.agentId,
                    status: run.status,
                    inputText: run.inputText,
                    outputText: run.outputText,
                    durationMs: run.durationMs,
                    startedAt: run.startedAt,
                    completedAt: run.completedAt,
                    modelProvider: run.modelProvider,
                    modelName: run.modelName,
                    totalTokens: run.totalTokens ?? traceTokens?.total ?? 0,
                    costUsd: run.costUsd ?? 0,
                    toolCallsCount,
                    stepsCount,
                    triggerId: run.triggerId,
                    source: run.source
                };
            }),
            hasMore,
            total
        };
    }
});

export const metricsWorkflowDailyTool = createTool({
    id: "metrics-workflow-daily",
    description: "Get daily workflow metrics for the last N days.",
    inputSchema: z.object({
        workflowSlug: z.string(),
        days: z.number().optional()
    }),
    outputSchema: z.object({
        success: z.boolean(),
        metrics: z.array(z.any())
    }),
    execute: async ({ workflowSlug, days }) => {
        const workflow = await prisma.workflow.findFirst({
            where: { OR: [{ slug: workflowSlug }, { id: workflowSlug }] }
        });
        if (!workflow) {
            throw new Error(`Workflow '${workflowSlug}' not found`);
        }

        const since = new Date();
        since.setDate(since.getDate() - (days || 14));
        since.setHours(0, 0, 0, 0);

        const metrics = await prisma.workflowMetricDaily.findMany({
            where: {
                workflowId: workflow.id,
                date: { gte: since }
            },
            orderBy: { date: "asc" }
        });

        return { success: true, metrics };
    }
});

export const metricsNetworkDailyTool = createTool({
    id: "metrics-network-daily",
    description: "Get daily network metrics for the last N days.",
    inputSchema: z.object({
        networkSlug: z.string(),
        days: z.number().optional()
    }),
    outputSchema: z.object({
        success: z.boolean(),
        metrics: z.array(z.any())
    }),
    execute: async ({ networkSlug, days }) => {
        const network = await prisma.network.findFirst({
            where: { OR: [{ slug: networkSlug }, { id: networkSlug }] }
        });
        if (!network) {
            throw new Error(`Network '${networkSlug}' not found`);
        }

        const since = new Date();
        since.setDate(since.getDate() - (days || 14));
        since.setHours(0, 0, 0, 0);

        const metrics = await prisma.networkMetricDaily.findMany({
            where: {
                networkId: network.id,
                date: { gte: since }
            },
            orderBy: { date: "asc" }
        });

        return { success: true, metrics };
    }
});
