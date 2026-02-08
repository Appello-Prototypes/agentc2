import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";
import { requireMonitoringWorkspace } from "@/lib/monitoring-auth";

/**
 * GET /api/live/triggers/filters
 *
 * Returns distinct filter values for Trigger Monitoring.
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
        const workspaceContext = await requireMonitoringWorkspace(requestedWorkspaceId);
        if (!workspaceContext.ok) {
            return NextResponse.json(
                { success: false, error: workspaceContext.error },
                { status: workspaceContext.status }
            );
        }

        const baseWhere: Prisma.TriggerEventWhereInput = {
            workspaceId: workspaceContext.workspaceId
        };
        const createdAtFilter: Prisma.DateTimeFilter = {};

        if (from) {
            createdAtFilter.gte = new Date(from);
        }

        if (to) {
            createdAtFilter.lte = new Date(to);
        }

        if (Object.keys(createdAtFilter).length > 0) {
            baseWhere.createdAt = createdAtFilter;
        }

        const [agentRows, triggerRows, statusRows, sourceRows, integrationRows, eventRows] =
            await Promise.all([
                prisma.triggerEvent.findMany({
                    where: baseWhere,
                    distinct: ["agentId"],
                    select: { agentId: true }
                }),
                prisma.triggerEvent.findMany({
                    where: baseWhere,
                    distinct: ["triggerId"],
                    select: { triggerId: true }
                }),
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
                    by: ["integrationKey"],
                    where: { ...baseWhere, integrationKey: { not: null } },
                    _count: { _all: true }
                }),
                prisma.triggerEvent.groupBy({
                    by: ["eventName"],
                    where: { ...baseWhere, eventName: { not: null } },
                    _count: { _all: true }
                })
            ]);

        const agentIds = agentRows
            .map((row) => row.agentId)
            .filter((id): id is string => Boolean(id));
        const triggerIds = triggerRows
            .map((row) => row.triggerId)
            .filter((id): id is string => Boolean(id));

        const [agents, triggers] = await Promise.all([
            agentIds.length > 0
                ? prisma.agent.findMany({
                      where: { id: { in: agentIds } },
                      select: { id: true, slug: true, name: true }
                  })
                : Promise.resolve([]),
            triggerIds.length > 0
                ? prisma.agentTrigger.findMany({
                      where: { id: { in: triggerIds } },
                      select: {
                          id: true,
                          name: true,
                          triggerType: true,
                          eventName: true,
                          webhookPath: true
                      }
                  })
                : Promise.resolve([])
        ]);

        return NextResponse.json({
            success: true,
            filters: {
                agents,
                triggers,
                statuses: statusRows.map((row) => ({
                    status: row.status,
                    count: row._count._all
                })),
                sources: sourceRows.map((row) => ({
                    sourceType: row.sourceType,
                    count: row._count._all
                })),
                integrations: integrationRows.map((row) => ({
                    integrationKey: row.integrationKey,
                    count: row._count._all
                })),
                eventNames: eventRows.map((row) => ({
                    eventName: row.eventName,
                    count: row._count._all
                }))
            }
        });
    } catch (error) {
        console.error("[Trigger Filters] Error:", error);
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            (error.code === "P2021" || error.code === "P2022")
        ) {
            return NextResponse.json({
                success: true,
                filters: {
                    agents: [],
                    triggers: [],
                    statuses: [],
                    sources: [],
                    integrations: [],
                    eventNames: []
                }
            });
        }
        return NextResponse.json(
            { success: false, error: "Failed to fetch trigger filters" },
            { status: 500 }
        );
    }
}
