import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";

/**
 * GET /api/workflows/[slug]/evaluations
 *
 * List evaluations for a workflow
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const { slug } = await params;
        const { searchParams } = new URL(request.url);
        const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
        const cursor = searchParams.get("cursor");

        const workflow = await prisma.workflow.findFirst({
            where: { OR: [{ slug }, { id: slug }] }
        });

        if (!workflow) {
            return NextResponse.json(
                { success: false, error: `Workflow '${slug}' not found` },
                { status: 404 }
            );
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = { workflowId: workflow.id };
        if (cursor) {
            where.id = { lt: cursor };
        }

        const evaluations = await prisma.workflowRunEvaluation.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: limit + 1,
            include: {
                workflowRun: {
                    select: {
                        id: true,
                        status: true,
                        durationMs: true,
                        createdAt: true
                    }
                }
            }
        });

        const hasMore = evaluations.length > limit;
        if (hasMore) evaluations.pop();

        // Compute summary
        const scores = evaluations.filter((e) => e.overallScore !== null);
        const avgScore =
            scores.length > 0
                ? Math.round(
                      (scores.reduce((sum, e) => sum + (e.overallScore || 0), 0) / scores.length) *
                          100
                  ) / 100
                : null;
        const avgStepSuccess =
            scores.length > 0
                ? Math.round(
                      (scores.reduce((sum, e) => sum + (e.stepSuccessRate || 0), 0) /
                          scores.length) *
                          100
                  ) / 100
                : null;

        return NextResponse.json({
            success: true,
            evaluations: evaluations.map((e) => ({
                id: e.id,
                workflowRunId: e.workflowRunId,
                stepSuccessRate: e.stepSuccessRate,
                outputQuality: e.outputQuality,
                durationScore: e.durationScore,
                overallScore: e.overallScore,
                stepScores: e.stepScores,
                narrative: e.narrative,
                createdAt: e.createdAt,
                run: e.workflowRun
            })),
            summary: {
                total: evaluations.length,
                avgOverallScore: avgScore,
                avgStepSuccessRate: avgStepSuccess
            },
            nextCursor: hasMore ? evaluations[evaluations.length - 1].id : null
        });
    } catch (error) {
        console.error("[Workflow Evaluations List] Error:", error);
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
 * POST /api/workflows/[slug]/evaluations
 *
 * Evaluate completed workflow runs that haven't been evaluated yet.
 * Computes step success rate, duration score, and overall quality.
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

        const workflow = await prisma.workflow.findFirst({
            where: { OR: [{ slug }, { id: slug }] }
        });

        if (!workflow) {
            return NextResponse.json(
                { success: false, error: `Workflow '${slug}' not found` },
                { status: 404 }
            );
        }

        // Find completed runs without evaluations
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {
            workflowId: workflow.id,
            status: "COMPLETED",
            evaluation: null
        };
        if (runIds && runIds.length > 0) {
            where.id = { in: runIds };
        }

        const runs = await prisma.workflowRun.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: limit,
            include: {
                steps: {
                    orderBy: { startedAt: "asc" }
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
            scores: Record<string, number | null>;
            success: boolean;
            error?: string;
        }> = [];

        for (const run of runs) {
            try {
                const totalSteps = run.steps.length;
                if (totalSteps === 0) {
                    results.push({
                        runId: run.id,
                        scores: {},
                        success: false,
                        error: "No steps to evaluate"
                    });
                    continue;
                }

                // 1. Step success rate: fraction of steps that completed
                const completedSteps = run.steps.filter((s) => s.status === "COMPLETED").length;
                const stepSuccessRate =
                    totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) / 100 : 0;

                // 2. Duration score: normalize against a target (e.g., 60s baseline)
                const durationMs = run.durationMs || 0;
                const targetMs = 60000; // 60 second baseline
                const durationScore =
                    durationMs > 0
                        ? Math.round(Math.min(1.0, targetMs / durationMs) * 100) / 100
                        : null;

                // 3. Step-level scores
                const stepScores: Record<
                    string,
                    { status: string; durationMs: number | null; type: string }
                > = {};
                for (const step of run.steps) {
                    stepScores[step.stepId] = {
                        status: step.status,
                        durationMs: step.durationMs,
                        type: step.stepType
                    };
                }

                // 4. Overall score: weighted composite
                const weights = {
                    stepSuccess: 0.6,
                    duration: 0.2,
                    outputQuality: 0.2
                };

                // Simple output quality heuristic:
                // If the final output is non-null and non-empty, it's decent
                const outputJson = run.outputJson;
                let outputQuality: number | null = null;
                if (outputJson !== null && outputJson !== undefined) {
                    const str =
                        typeof outputJson === "string" ? outputJson : JSON.stringify(outputJson);
                    // Basic quality: length-based heuristic (short = low, long = higher, capped)
                    const len = str.length;
                    if (len === 0) {
                        outputQuality = 0;
                    } else if (len < 50) {
                        outputQuality = 0.3;
                    } else if (len < 200) {
                        outputQuality = 0.6;
                    } else {
                        outputQuality = 0.8;
                    }
                }

                const overallScore =
                    Math.round(
                        (stepSuccessRate * weights.stepSuccess +
                            (durationScore || 0) * weights.duration +
                            (outputQuality || 0) * weights.outputQuality) *
                            100
                    ) / 100;

                await prisma.workflowRunEvaluation.create({
                    data: {
                        workflowRunId: run.id,
                        workflowId: workflow.id,
                        stepSuccessRate,
                        outputQuality,
                        durationScore,
                        overallScore,
                        stepScores: stepScores as unknown as Prisma.InputJsonValue
                    }
                });

                results.push({
                    runId: run.id,
                    scores: {
                        stepSuccessRate,
                        outputQuality,
                        durationScore,
                        overallScore
                    },
                    success: true
                });
            } catch (evalError) {
                console.error(`[Workflow Evaluation] Run ${run.id} failed:`, evalError);
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
        console.error("[Workflow Evaluations Run] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to run evaluations"
            },
            { status: 500 }
        );
    }
}
