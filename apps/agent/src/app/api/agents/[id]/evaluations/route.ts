import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import {
    relevancyScorer,
    toxicityScorer,
    completenessScorer,
    toneScorer,
    evaluateHelpfulness
} from "@repo/mastra";
import { inngest } from "@/lib/inngest";

/**
 * GET /api/agents/[id]/evaluations
 *
 * List evaluations for an agent with trends, themes, and insights
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);

        const from = searchParams.get("from");
        const to = searchParams.get("to");
        const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
        const cursor = searchParams.get("cursor");
        const source = searchParams.get("source"); // "production", "simulation", "all"

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

        // Build source filter for runs (evaluations are linked to runs)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let runSourceFilter: any = undefined;
        if (source === "production") {
            runSourceFilter = { source: { not: "simulation" } };
        } else if (source === "simulation") {
            runSourceFilter = { source: "simulation" };
        }
        // "all" or undefined means no filter

        // Build where clause
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {
            agentId: agent.id,
            createdAt: {
                gte: startDate,
                lte: endDate
            },
            ...(runSourceFilter && { run: runSourceFilter })
        };

        if (cursor) {
            where.id = { lt: cursor };
        }

        // Run all queries in parallel for efficiency
        const [evaluations, themes, insights, qualityMetrics] = await Promise.all([
            // Get evaluations
            prisma.agentEvaluation.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take: limit + 1,
                include: {
                    run: {
                        select: {
                            id: true,
                            status: true,
                            inputText: true,
                            outputText: true,
                            durationMs: true
                        }
                    }
                }
            }),
            // Get feedback themes for this agent
            prisma.evaluationTheme.findMany({
                where: { agentId: agent.id },
                orderBy: { count: "desc" },
                take: 10
            }),
            // Get AI insights for this agent
            prisma.insight.findMany({
                where: { agentId: agent.id },
                orderBy: { createdAt: "desc" },
                take: 10
            }),
            // Get quality metrics for trends (last 14 days)
            prisma.agentQualityMetricDaily.findMany({
                where: {
                    agentId: agent.id,
                    date: {
                        gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
                        lte: endDate
                    }
                },
                orderBy: { date: "asc" }
            })
        ]);

        // Check if there are more results
        const hasMore = evaluations.length > limit;
        if (hasMore) {
            evaluations.pop();
        }

        // Calculate summary stats
        const allScores: Record<string, number[]> = {};
        for (const eval_ of evaluations) {
            const scores = eval_.scoresJson as Record<string, number>;
            if (scores) {
                for (const [key, value] of Object.entries(scores)) {
                    if (typeof value === "number") {
                        if (!allScores[key]) allScores[key] = [];
                        allScores[key].push(value);
                    }
                }
            }
        }

        const avgScores = Object.entries(allScores).map(([scorer, scores]) => ({
            scorer,
            avg: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100,
            min: Math.min(...scores),
            max: Math.max(...scores),
            count: scores.length
        }));

        // Build trends data grouped by scorer
        const trendsMap: Record<string, Array<{ date: string; score: number }>> = {};
        for (const metric of qualityMetrics) {
            if (!trendsMap[metric.scorerKey]) {
                trendsMap[metric.scorerKey] = [];
            }
            trendsMap[metric.scorerKey].push({
                date: metric.date.toISOString().split("T")[0],
                score: metric.avgScore ?? 0
            });
        }

        // Convert to array format
        const trends = Object.entries(trendsMap).map(([scorer, data]) => ({
            scorer,
            data
        }));

        return NextResponse.json({
            success: true,
            evaluations: evaluations.map((eval_) => ({
                id: eval_.id,
                runId: eval_.runId,
                scoresJson: eval_.scoresJson,
                scorerVersion: eval_.scorerVersion,
                createdAt: eval_.createdAt,
                run: eval_.run
                    ? {
                          id: eval_.run.id,
                          status: eval_.run.status,
                          inputPreview: eval_.run.inputText.slice(0, 100),
                          outputPreview: eval_.run.outputText?.slice(0, 100),
                          durationMs: eval_.run.durationMs
                      }
                    : null
            })),
            summary: {
                total: evaluations.length,
                avgScores
            },
            // Feedback themes from database
            themes: themes.map((t) => ({
                theme: t.theme,
                count: t.count,
                sentiment: t.sentiment ?? "neutral"
            })),
            // AI-generated insights from database
            insights: insights.map((i) => ({
                id: i.id,
                type: i.type,
                title: i.title,
                description: i.description,
                createdAt: i.createdAt
            })),
            // Score trends over time
            trends,
            dateRange: {
                from: startDate.toISOString(),
                to: endDate.toISOString()
            },
            nextCursor: hasMore ? evaluations[evaluations.length - 1].id : null
        });
    } catch (error) {
        console.error("[Agent Evaluations List] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get evaluations"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/agents/[id]/evaluations
 *
 * Run evaluations on unevaluated runs
 * Body: { limit?: number, runIds?: string[] }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json().catch(() => ({}));
        const limit = Math.min(body.limit || 10, 50);
        const runIds: string[] | undefined = body.runIds;

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

        // Find runs without evaluations
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {
            agentId: agent.id,
            status: "COMPLETED",
            evaluation: null
        };

        if (runIds && runIds.length > 0) {
            where.id = { in: runIds };
        }

        const runs = await prisma.agentRun.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: limit,
            select: {
                id: true,
                inputText: true,
                outputText: true
            }
        });

        if (runs.length === 0) {
            return NextResponse.json({
                success: true,
                message: "No unevaluated runs found",
                evaluated: 0,
                results: []
            });
        }

        const results: Array<{
            runId: string;
            scores: Record<string, number>;
            success: boolean;
            error?: string;
        }> = [];

        // Run evaluations on each run
        for (const run of runs) {
            if (!run.outputText) {
                results.push({
                    runId: run.id,
                    scores: {},
                    success: false,
                    error: "No output to evaluate"
                });
                continue;
            }

            try {
                // Run all scorers
                const scores: Record<string, number> = {};

                // Get configured scorers for agent, or use defaults
                const scorerKeys =
                    agent.scorers.length > 0 ? agent.scorers : ["relevancy", "completeness"];

                // Normalize scorer names (common aliases)
                const normalizeKey = (key: string): string => {
                    const aliases: Record<string, string> = {
                        relevance: "relevancy",
                        concise: "conciseness"
                    };
                    return aliases[key] || key;
                };

                // Build scorer input — Mastra prebuilt scorers expect plain strings
                const scorerInput = {
                    input: run.inputText || "",
                    output: run.outputText || ""
                };

                // Scorer registry map
                const scorerMap: Record<
                    string,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    { run: (input: any) => Promise<{ score: number }> } | null
                > = {
                    relevancy: relevancyScorer,
                    toxicity: toxicityScorer,
                    completeness: completenessScorer,
                    tone: toneScorer
                };

                for (const rawKey of scorerKeys) {
                    const key = normalizeKey(rawKey);
                    try {
                        let score: number | undefined;

                        if (key === "helpfulness") {
                            const result = evaluateHelpfulness(
                                run.inputText,
                                run.outputText
                            );
                            score = result.score;
                        } else if (key === "conciseness") {
                            // Custom conciseness scorer: ratio of input length to output length
                            // Shorter, more concise responses score higher
                            const inputLen = (run.inputText || "").length;
                            const outputLen = (run.outputText || "").length;
                            if (outputLen > 0) {
                                // Score 1.0 for responses shorter than input, decreasing as response gets longer
                                const ratio = inputLen / outputLen;
                                score = Math.min(1.0, Math.max(0.1, ratio));
                            } else {
                                score = 0;
                            }
                        } else if (scorerMap[key]) {
                            const result = await (
                                scorerMap[key] as {
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    run: (input: any) => Promise<{ score: number }>;
                                }
                            ).run(scorerInput);
                            score = result.score;
                        }

                        if (score !== undefined) {
                            // Store with the original key name the user configured
                            scores[rawKey] = score;
                        }
                    } catch (scorerError) {
                        console.error(`[Evaluation] Scorer ${key} failed:`, scorerError);
                    }
                }

                // Save evaluation to database
                const evaluation = await prisma.agentEvaluation.create({
                    data: {
                        runId: run.id,
                        agentId: agent.id,
                        scoresJson: scores,
                        scorerVersion: "1.0"
                    }
                });

                // Emit evaluation/completed event for insight generation
                await inngest.send({
                    name: "evaluation/completed",
                    data: {
                        evaluationId: evaluation.id,
                        agentId: agent.id,
                        runId: run.id,
                        scores
                    }
                });

                results.push({
                    runId: run.id,
                    scores,
                    success: true
                });
            } catch (evalError) {
                console.error(`[Evaluation] Run ${run.id} failed:`, evalError);
                results.push({
                    runId: run.id,
                    scores: {},
                    success: false,
                    error: evalError instanceof Error ? evalError.message : "Evaluation failed"
                });
            }
        }

        return NextResponse.json({
            success: true,
            evaluated: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length,
            results
        });
    } catch (error) {
        console.error("[Agent Evaluations Run] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to run evaluations"
            },
            { status: 500 }
        );
    }
}
