import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";
import { requireMonitoringWorkspace } from "@/lib/monitoring-auth";

/**
 * GET /api/live/triggers/metrics
 *
 * Returns aggregate metrics for Trigger Monitoring.
 *
 * Query Parameters:
 * - from/to: Date range filter (ISO)
 * - workspaceId: Optional workspace override (owner only)
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const requestedWorkspaceId = searchParams.get("workspaceId");

    try {
        const workspaceContext = await requireMonitoringWorkspace(requestedWorkspaceId, request);
        if (!workspaceContext.ok) {
            return NextResponse.json(
                { success: false, error: workspaceContext.error },
                { status: workspaceContext.status }
            );
        }

        // Include events from this workspace AND events with no workspace (system-level)
        const conditions: Prisma.TriggerEventWhereInput[] = [
            {
                OR: [{ workspaceId: workspaceContext.workspaceId }, { workspaceId: null }]
            }
        ];

        const createdAtFilter: Prisma.DateTimeFilter = {};
        if (from) createdAtFilter.gte = new Date(from);
        if (to) createdAtFilter.lte = new Date(to);
        if (Object.keys(createdAtFilter).length > 0) {
            conditions.push({ createdAt: createdAtFilter });
        }

        const baseWhere: Prisma.TriggerEventWhereInput = { AND: conditions };

        const [total, statusRows, sourceRows, entityTypeRows] = await Promise.all([
            prisma.triggerEvent.count({ where: baseWhere }),
            prisma.triggerEvent.groupBy({
                by: ["status"],
                where: baseWhere,
                _count: { _all: true }
            }),
            prisma.triggerEvent.groupBy({
                by: ["sourceType"],
                where: baseWhere,
                _count: { _all: true }
            }),
            prisma.triggerEvent.groupBy({
                by: ["entityType"],
                where: baseWhere,
                _count: { _all: true }
            })
        ]);

        return NextResponse.json({
            success: true,
            summary: {
                total,
                statuses: statusRows.map((row) => ({
                    status: row.status,
                    count: row._count._all
                })),
                sources: sourceRows.map((row) => ({
                    sourceType: row.sourceType,
                    count: row._count._all
                })),
                entityTypes: entityTypeRows.map((row) => ({
                    entityType: row.entityType,
                    count: row._count._all
                }))
            },
            dateRange: {
                from: from || null,
                to: to || null
            }
        });
    } catch (error) {
        console.error("[Trigger Metrics] Error:", error);
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            (error.code === "P2021" || error.code === "P2022")
        ) {
            return NextResponse.json({
                success: true,
                summary: {
                    total: 0,
                    statuses: [],
                    sources: []
                },
                dateRange: {
                    from: from || null,
                    to: to || null
                }
            });
        }
        return NextResponse.json(
            { success: false, error: "Failed to fetch trigger metrics" },
            { status: 500 }
        );
    }
}
