import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const from = searchParams.get("from");
        const to = searchParams.get("to");

        const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = to ? new Date(to) : new Date();

        const workflows = await prisma.workflow.findMany({
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                slug: true,
                name: true,
                description: true,
                version: true,
                isPublished: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
                definitionJson: true
            }
        });

        const runs = await prisma.workflowRun.findMany({
            where: {
                startedAt: {
                    gte: startDate,
                    lte: endDate
                }
            },
            select: {
                workflowId: true,
                status: true,
                startedAt: true,
                durationMs: true
            }
        });

        const statsByWorkflow = new Map<
            string,
            {
                totalRuns: number;
                completedRuns: number;
                failedRuns: number;
                queuedRuns: number;
                runningRuns: number;
                cancelledRuns: number;
                totalDurationMs: number;
                lastRunAt: Date | null;
                lastFailedAt: Date | null;
            }
        >();

        let totalRuns = 0;
        let completedRuns = 0;
        let failedRuns = 0;
        let queuedRuns = 0;
        let runningRuns = 0;
        let cancelledRuns = 0;
        let totalDurationMs = 0;

        for (const run of runs) {
            const existing = statsByWorkflow.get(run.workflowId) || {
                totalRuns: 0,
                completedRuns: 0,
                failedRuns: 0,
                queuedRuns: 0,
                runningRuns: 0,
                cancelledRuns: 0,
                totalDurationMs: 0,
                lastRunAt: null,
                lastFailedAt: null
            };

            const status = run.status?.toUpperCase();
            const startedAt = run.startedAt;

            existing.totalRuns += 1;
            totalRuns += 1;

            if (status === "COMPLETED") {
                existing.completedRuns += 1;
                completedRuns += 1;
                existing.totalDurationMs += run.durationMs || 0;
                totalDurationMs += run.durationMs || 0;
            } else if (status === "FAILED") {
                existing.failedRuns += 1;
                failedRuns += 1;
            } else if (status === "QUEUED") {
                existing.queuedRuns += 1;
                queuedRuns += 1;
            } else if (status === "RUNNING") {
                existing.runningRuns += 1;
                runningRuns += 1;
            } else if (status === "CANCELLED") {
                existing.cancelledRuns += 1;
                cancelledRuns += 1;
            }

            existing.lastRunAt =
                !existing.lastRunAt || startedAt > existing.lastRunAt
                    ? startedAt
                    : existing.lastRunAt;

            if (status === "FAILED") {
                existing.lastFailedAt =
                    !existing.lastFailedAt || startedAt > existing.lastFailedAt
                        ? startedAt
                        : existing.lastFailedAt;
            }

            statsByWorkflow.set(run.workflowId, existing);
        }

        const summary = {
            totalWorkflows: workflows.length,
            activeWorkflows: workflows.filter((workflow) => workflow.isActive).length,
            publishedWorkflows: workflows.filter((workflow) => workflow.isPublished).length,
            totalRuns,
            completedRuns,
            failedRuns,
            queuedRuns,
            runningRuns,
            cancelledRuns,
            successRate: totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0,
            avgLatencyMs: completedRuns > 0 ? Math.round(totalDurationMs / completedRuns) : 0
        };

        const workflowsWithStats = workflows.map((workflow) => {
            const stats = statsByWorkflow.get(workflow.id) || {
                totalRuns: 0,
                completedRuns: 0,
                failedRuns: 0,
                queuedRuns: 0,
                runningRuns: 0,
                cancelledRuns: 0,
                totalDurationMs: 0,
                lastRunAt: null,
                lastFailedAt: null
            };

            const definition = workflow.definitionJson as { steps?: unknown[] } | null;
            const stepCount = Array.isArray(definition?.steps) ? definition?.steps.length : 0;

            return {
                id: workflow.id,
                slug: workflow.slug,
                name: workflow.name,
                description: workflow.description,
                version: workflow.version,
                isPublished: workflow.isPublished,
                isActive: workflow.isActive,
                createdAt: workflow.createdAt,
                updatedAt: workflow.updatedAt,
                stepCount,
                stats: {
                    totalRuns: stats.totalRuns,
                    completedRuns: stats.completedRuns,
                    failedRuns: stats.failedRuns,
                    queuedRuns: stats.queuedRuns,
                    runningRuns: stats.runningRuns,
                    cancelledRuns: stats.cancelledRuns,
                    avgLatencyMs:
                        stats.completedRuns > 0
                            ? Math.round(stats.totalDurationMs / stats.completedRuns)
                            : 0,
                    lastRunAt: stats.lastRunAt?.toISOString() || null,
                    lastFailedAt: stats.lastFailedAt?.toISOString() || null
                }
            };
        });

        return NextResponse.json({
            success: true,
            summary,
            workflows: workflowsWithStats,
            dateRange: {
                from: startDate.toISOString(),
                to: endDate.toISOString()
            }
        });
    } catch (error) {
        console.error("[Workflows Stats] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to load workflow stats" },
            { status: 500 }
        );
    }
}
