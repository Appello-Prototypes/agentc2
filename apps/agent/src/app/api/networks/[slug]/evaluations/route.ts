import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";

/**
 * GET /api/networks/[slug]/evaluations
 *
 * List evaluations for a network
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const { slug } = await params;
        const { searchParams } = new URL(request.url);
        const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
        const cursor = searchParams.get("cursor");

        const network = await prisma.network.findFirst({
            where: { OR: [{ slug }, { id: slug }] }
        });

        if (!network) {
            return NextResponse.json(
                { success: false, error: `Network '${slug}' not found` },
                { status: 404 }
            );
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = { networkId: network.id };
        if (cursor) {
            where.id = { lt: cursor };
        }

        const evaluations = await prisma.networkRunEvaluation.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: limit + 1,
            include: {
                networkRun: {
                    select: {
                        id: true,
                        status: true,
                        durationMs: true,
                        stepsExecuted: true,
                        totalTokens: true,
                        totalCostUsd: true,
                        createdAt: true
                    }
                }
            }
        });

        const hasMore = evaluations.length > limit;
        if (hasMore) evaluations.pop();

        // Compute summary
        const routingScores = evaluations
            .filter((e) => e.routingScore !== null)
            .map((e) => e.routingScore as number);
        const avgRouting =
            routingScores.length > 0
                ? Math.round(
                      (routingScores.reduce((a, b) => a + b, 0) / routingScores.length) * 100
                  ) / 100
                : null;

        return NextResponse.json({
            success: true,
            evaluations: evaluations.map((e) => ({
                id: e.id,
                networkRunId: e.networkRunId,
                routingScore: e.routingScore,
                agentScores: e.agentScores,
                narrative: e.narrative,
                createdAt: e.createdAt,
                run: e.networkRun
            })),
            summary: {
                total: evaluations.length,
                avgRoutingScore: avgRouting
            },
            nextCursor: hasMore ? evaluations[evaluations.length - 1].id : null
        });
    } catch (error) {
        console.error("[Network Evaluations List] Error:", error);
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
 * POST /api/networks/[slug]/evaluations
 *
 * Evaluate completed network runs. Computes routing score and agent performance.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;
        const body = await request.json().catch(() => ({}));
        const limit = Math.min(body.limit || 10, 50);
        const runIds: string[] | undefined = body.runIds;

        const network = await prisma.network.findFirst({
            where: { OR: [{ slug }, { id: slug }] }
        });

        if (!network) {
            return NextResponse.json(
                { success: false, error: `Network '${slug}' not found` },
                { status: 404 }
            );
        }

        // Find completed runs without evaluations
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {
            networkId: network.id,
            status: "COMPLETED",
            evaluation: null
        };
        if (runIds && runIds.length > 0) {
            where.id = { in: runIds };
        }

        const runs = await prisma.networkRun.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: limit,
            include: {
                steps: {
                    orderBy: { stepNumber: "asc" }
                }
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
            routingScore: number | null;
            success: boolean;
            error?: string;
        }> = [];

        for (const run of runs) {
            try {
                const totalSteps = run.steps.length;

                // Routing score: how efficiently did the router pick primitives?
                // Heuristic: fewer steps = more efficient routing
                // Baseline: 3-5 steps is optimal, more steps reduce score
                let routingScore: number | null = null;
                if (totalSteps > 0) {
                    const completedSteps = run.steps.filter((s) => s.status === "COMPLETED").length;
                    const successRate = totalSteps > 0 ? completedSteps / totalSteps : 0;

                    // Step efficiency: penalize excessive steps
                    const optimalSteps = 4;
                    const stepEfficiency = Math.min(1.0, optimalSteps / Math.max(1, totalSteps));

                    // Weighted routing score
                    routingScore =
                        Math.round((successRate * 0.7 + stepEfficiency * 0.3) * 100) / 100;
                }

                // Agent scores: aggregate performance by agent
                const agentScores: Record<string, { count: number; successCount: number }> = {};
                for (const step of run.steps) {
                    if (step.primitiveType === "agent" && step.primitiveId) {
                        if (!agentScores[step.primitiveId]) {
                            agentScores[step.primitiveId] = { count: 0, successCount: 0 };
                        }
                        agentScores[step.primitiveId].count++;
                        if (step.status === "COMPLETED") {
                            agentScores[step.primitiveId].successCount++;
                        }
                    }
                }

                const agentScoresSummary: Record<string, number> = {};
                for (const [agentId, stats] of Object.entries(agentScores)) {
                    agentScoresSummary[agentId] =
                        stats.count > 0
                            ? Math.round((stats.successCount / stats.count) * 100) / 100
                            : 0;
                }

                await prisma.networkRunEvaluation.create({
                    data: {
                        networkRunId: run.id,
                        networkId: network.id,
                        routingScore,
                        agentScores:
                            Object.keys(agentScoresSummary).length > 0
                                ? (agentScoresSummary as unknown as Prisma.InputJsonValue)
                                : Prisma.DbNull
                    }
                });

                results.push({
                    runId: run.id,
                    routingScore,
                    success: true
                });
            } catch (evalError) {
                console.error(`[Network Evaluation] Run ${run.id} failed:`, evalError);
                results.push({
                    runId: run.id,
                    routingScore: null,
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
        console.error("[Network Evaluations Run] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to run evaluations"
            },
            { status: 500 }
        );
    }
}
