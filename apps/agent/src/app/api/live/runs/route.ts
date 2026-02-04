import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";

/**
 * GET /api/live/runs
 *
 * Returns production runs with optional filtering by status and source.
 * Default filters to PROD runType only.
 *
 * Query Parameters:
 * - status: Filter by run status (completed, failed, running, queued, cancelled)
 * - source: Filter by source channel (slack, whatsapp, voice, telegram, elevenlabs, api)
 * - agentId: Filter by agent ID
 * - versionId: Filter by agent version ID
 * - modelName: Filter by model name
 * - runType: Filter by run type (PROD, TEST, AB, all)
 * - toolUsage: Filter by tool usage (with_tools, without_tools)
 * - search: Search by run ID or keyword in input/output
 * - from/to: Date range filter (ISO)
 * - limit: Number of runs to return (default: 50)
 * - offset: Pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");
        const source = searchParams.get("source");
        const agentId = searchParams.get("agentId");
        const versionId = searchParams.get("versionId");
        const modelName = searchParams.get("modelName");
        const runType = searchParams.get("runType") || "PROD";
        const toolUsage = searchParams.get("toolUsage");
        const search = searchParams.get("search");
        const from = searchParams.get("from");
        const to = searchParams.get("to");
        const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
        const offset = parseInt(searchParams.get("offset") || "0", 10);

        const baseWhere: Prisma.AgentRunWhereInput = {};
        const startedAtFilter: Prisma.DateTimeFilter = {};

        if (runType && runType.toLowerCase() !== "all") {
            baseWhere.runType = runType.toUpperCase() as Prisma.EnumRunTypeFilter;
        }

        const statusFilter =
            status && status !== "all"
                ? (status.toUpperCase() as Prisma.EnumRunStatusFilter)
                : null;

        // Source filter - only apply if the column exists
        if (source && source !== "all") {
            try {
                baseWhere.source = source.toLowerCase();
            } catch {
                // Source field might not exist
            }
        }

        if (agentId && agentId !== "all") {
            baseWhere.agentId = agentId;
        }

        if (versionId && versionId !== "all") {
            baseWhere.versionId = versionId;
        }

        if (modelName && modelName !== "all") {
            baseWhere.modelName = modelName;
        }

        if (toolUsage === "with_tools") {
            baseWhere.toolCalls = { some: {} };
        }

        if (toolUsage === "without_tools") {
            baseWhere.toolCalls = { none: {} };
        }

        if (search) {
            baseWhere.OR = [
                { id: { contains: search, mode: "insensitive" } },
                { inputText: { contains: search, mode: "insensitive" } },
                { outputText: { contains: search, mode: "insensitive" } }
            ];
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

        const where: Prisma.AgentRunWhereInput = statusFilter
            ? { ...baseWhere, status: statusFilter }
            : { ...baseWhere };

        // Fetch runs with agent info
        const [runs, counts] = await Promise.all([
            prisma.agentRun.findMany({
                where,
                include: {
                    agent: {
                        select: {
                            slug: true,
                            name: true
                        }
                    },
                    trace: {
                        select: {
                            stepsJson: true,
                            tokensJson: true,
                            _count: {
                                select: {
                                    steps: true,
                                    toolCalls: true
                                }
                            }
                        }
                    },
                    toolCalls: {
                        select: {
                            toolKey: true
                        }
                    },
                    _count: {
                        select: {
                            toolCalls: true
                        }
                    }
                },
                orderBy: { startedAt: "desc" },
                take: limit,
                skip: offset
            }),
            // Get counts by status for filters
            Promise.all([
                prisma.agentRun.count({ where: baseWhere }),
                prisma.agentRun.count({ where: { ...baseWhere, status: "QUEUED" } }),
                prisma.agentRun.count({ where: { ...baseWhere, status: "RUNNING" } }),
                prisma.agentRun.count({ where: { ...baseWhere, status: "COMPLETED" } }),
                prisma.agentRun.count({ where: { ...baseWhere, status: "FAILED" } }),
                prisma.agentRun.count({ where: { ...baseWhere, status: "CANCELLED" } })
            ])
        ]);

        const [total, queued, running, completed, failed, cancelled] = counts;

        const versionIds = Array.from(
            new Set(runs.map((run) => run.versionId).filter(Boolean))
        ) as string[];

        const versionMap = new Map<string, number>();
        if (versionIds.length > 0) {
            const versions = await prisma.agentVersion.findMany({
                where: { id: { in: versionIds } },
                select: { id: true, version: true }
            });
            for (const v of versions) {
                versionMap.set(v.id, v.version);
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const formattedRuns = runs.map((run: any) => ({
            id: run.id,
            agentId: run.agentId,
            agentSlug: run.agent.slug,
            agentName: run.agent.name,
            runType: run.runType,
            status: run.status,
            source: run.source || null,
            sessionId: run.sessionId || null,
            threadId: run.threadId || null,
            inputText: run.inputText,
            outputText: run.outputText,
            durationMs: run.durationMs,
            startedAt: run.startedAt.toISOString(),
            completedAt: run.completedAt?.toISOString() || null,
            modelProvider: run.modelProvider,
            modelName: run.modelName,
            promptTokens:
                run.promptTokens ?? (run.trace?.tokensJson?.prompt as number | undefined) ?? 0,
            completionTokens:
                run.completionTokens ??
                (run.trace?.tokensJson?.completion as number | undefined) ??
                0,
            totalTokens:
                run.totalTokens ?? (run.trace?.tokensJson?.total as number | undefined) ?? 0,
            costUsd: run.costUsd,
            toolCallCount:
                run._count.toolCalls > 0
                    ? run._count.toolCalls
                    : (run.trace?._count?.toolCalls ?? 0),
            uniqueToolCount: new Set(
                (run.toolCalls || []).map((toolCall: { toolKey: string }) => toolCall.toolKey)
            ).size,
            stepCount: (() => {
                const stepsFromRelation = run.trace?._count?.steps ?? 0;
                if (stepsFromRelation > 0) return stepsFromRelation;
                return Array.isArray(run.trace?.stepsJson) ? run.trace.stepsJson.length : 0;
            })(),
            versionId: run.versionId || null,
            versionNumber: run.versionId ? versionMap.get(run.versionId) || null : null
        }));

        return NextResponse.json({
            success: true,
            runs: formattedRuns,
            counts: {
                total,
                queued,
                running,
                completed,
                failed,
                cancelled
            },
            pagination: {
                limit,
                offset,
                hasMore: offset + runs.length < total
            }
        });
    } catch (error) {
        console.error("[Live Runs] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch production runs" },
            { status: 500 }
        );
    }
}
