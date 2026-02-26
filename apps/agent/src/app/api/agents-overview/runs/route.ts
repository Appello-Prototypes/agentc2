import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

/**
 * GET /api/workspace/runs
 *
 * Get all runs across all agents, ordered by most recent first
 */
export async function GET(request: NextRequest) {
    const authContext = await authenticateRequest(request);
    if (!authContext) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);

        // Parse query parameters
        const status = searchParams.get("status");
        const agentId = searchParams.get("agentId");
        const search = searchParams.get("search");
        const from = searchParams.get("from");
        const to = searchParams.get("to");
        const cursor = searchParams.get("cursor");
        const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

        // Build where clause
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {};

        if (status) {
            where.status = status.toUpperCase();
        }

        if (agentId) {
            where.agentId = agentId;
        }

        if (search) {
            where.OR = [
                { inputText: { contains: search, mode: "insensitive" } },
                { outputText: { contains: search, mode: "insensitive" } }
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

        where.agent = { ...where.agent, workspace: { organizationId: authContext.organizationId } };

        // Query runs with agent info, tool call counts, and step counts
        const runs = await prisma.agentRun.findMany({
            where,
            orderBy: { startedAt: "desc" },
            take: limit + 1,
            include: {
                agent: {
                    select: {
                        id: true,
                        slug: true,
                        name: true
                    }
                },
                evaluation: {
                    select: { scoresJson: true }
                },
                feedbacks: {
                    select: { thumbs: true, rating: true, turnId: true }
                },
                _count: {
                    select: {
                        toolCalls: true
                    }
                },
                trace: {
                    select: {
                        stepsJson: true,
                        _count: {
                            select: {
                                steps: true,
                                toolCalls: true
                            }
                        }
                    }
                }
            }
        });

        // Check if there are more results
        const hasMore = runs.length > limit;
        if (hasMore) {
            runs.pop();
        }

        // Get total counts
        const orgFilter = { agent: { workspace: { organizationId: authContext.organizationId } } };
        const total = await prisma.agentRun.count({
            where: status
                ? { status: status.toUpperCase() as never, ...orgFilter }
                : { ...orgFilter }
        });
        const statusCounts = await prisma.agentRun.groupBy({
            by: ["status"],
            where: { ...orgFilter },
            _count: { status: true }
        });

        const counts = {
            total,
            queued: 0,
            running: 0,
            completed: 0,
            failed: 0,
            cancelled: 0
        };

        for (const item of statusCounts) {
            const key = item.status.toLowerCase() as keyof typeof counts;
            if (key in counts) {
                counts[key] = item._count.status;
            }
        }

        return NextResponse.json({
            success: true,
            runs: runs.map((run) => {
                // Calculate tool call count from run or trace
                const toolCallCount =
                    run._count.toolCalls > 0
                        ? run._count.toolCalls
                        : (run.trace?._count?.toolCalls ?? 0);

                // Calculate step count from trace steps or stepsJson
                let stepCount = run.trace?._count?.steps ?? 0;
                if (stepCount === 0 && run.trace?.stepsJson) {
                    // Fall back to stepsJson array length if available
                    stepCount = Array.isArray(run.trace.stepsJson) ? run.trace.stepsJson.length : 0;
                }

                return {
                    id: run.id,
                    agentId: run.agentId,
                    agentSlug: run.agent.slug,
                    agentName: run.agent.name,
                    runType: run.runType,
                    status: run.status,
                    inputText: run.inputText,
                    outputText: run.outputText,
                    durationMs: run.durationMs,
                    startedAt: run.startedAt,
                    completedAt: run.completedAt,
                    modelProvider: run.modelProvider,
                    modelName: run.modelName,
                    totalTokens: run.totalTokens,
                    costUsd: run.costUsd,
                    toolCallCount,
                    stepCount,
                    turnCount: run.turnCount,
                    evaluation: run.evaluation?.scoresJson,
                    feedback: run.feedbacks
                };
            }),
            counts,
            nextCursor: hasMore ? runs[runs.length - 1].id : null
        });
    } catch (error) {
        console.error("[Workspace Runs] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list runs"
            },
            { status: 500 }
        );
    }
}
