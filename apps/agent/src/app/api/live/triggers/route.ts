import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma, TriggerEventStatus } from "@repo/database";
import { requireMonitoringWorkspace } from "@/lib/monitoring-auth";

/**
 * GET /api/live/triggers
 *
 * Returns trigger events for monitoring.
 *
 * Query Parameters:
 * - status: Filter by trigger event status
 * - sourceType: Filter by source type (webhook, event, integration)
 * - integrationKey: Filter by integration key (gmail, etc.)
 * - triggerId: Filter by trigger ID
 * - agentId: Filter by agent ID
 * - eventName: Filter by event name
 * - search: Search by ID, event name, payload preview, or error
 * - from/to: Date range filter (ISO)
 * - limit: Number of events to return (default: 50)
 * - offset: Pagination offset (default: 0)
 * - workspaceId: Optional workspace override (owner only)
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    try {
        const status = searchParams.get("status");
        const sourceType = searchParams.get("sourceType");
        const integrationKey = searchParams.get("integrationKey");
        const triggerId = searchParams.get("triggerId");
        const agentId = searchParams.get("agentId");
        const eventName = searchParams.get("eventName");
        const entityType = searchParams.get("entityType");
        const search = searchParams.get("search");
        const from = searchParams.get("from");
        const to = searchParams.get("to");
        const requestedWorkspaceId = searchParams.get("workspaceId");

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

        if (status && status !== "all") {
            conditions.push({ status: status as TriggerEventStatus });
        }
        if (sourceType && sourceType !== "all") {
            conditions.push({ sourceType });
        }
        if (integrationKey && integrationKey !== "all") {
            conditions.push({ integrationKey });
        }
        if (triggerId && triggerId !== "all") {
            conditions.push({ triggerId });
        }
        if (agentId && agentId !== "all") {
            conditions.push({ agentId });
        }
        if (eventName && eventName !== "all") {
            conditions.push({ eventName });
        }
        if (entityType && entityType !== "all") {
            conditions.push({ entityType });
        }

        const createdAtFilter: Prisma.DateTimeFilter = {};
        if (from) createdAtFilter.gte = new Date(from);
        if (to) createdAtFilter.lte = new Date(to);
        if (Object.keys(createdAtFilter).length > 0) {
            conditions.push({ createdAt: createdAtFilter });
        }

        if (search) {
            conditions.push({
                OR: [
                    { id: { contains: search, mode: "insensitive" } },
                    { eventName: { contains: search, mode: "insensitive" } },
                    { payloadPreview: { contains: search, mode: "insensitive" } },
                    { errorMessage: { contains: search, mode: "insensitive" } },
                    { trigger: { name: { contains: search, mode: "insensitive" } } },
                    { agent: { name: { contains: search, mode: "insensitive" } } }
                ]
            });
        }

        const baseWhere: Prisma.TriggerEventWhereInput = { AND: conditions };

        const [events, total] = await Promise.all([
            prisma.triggerEvent.findMany({
                where: baseWhere,
                include: {
                    trigger: {
                        select: {
                            id: true,
                            name: true,
                            triggerType: true,
                            eventName: true,
                            webhookPath: true
                        }
                    },
                    agent: {
                        select: {
                            id: true,
                            slug: true,
                            name: true
                        }
                    },
                    run: {
                        select: {
                            id: true,
                            status: true,
                            startedAt: true,
                            completedAt: true,
                            durationMs: true
                        }
                    },
                    workflow: {
                        select: { id: true, slug: true, name: true }
                    },
                    workflowRun: {
                        select: {
                            id: true,
                            status: true,
                            startedAt: true,
                            completedAt: true,
                            durationMs: true
                        }
                    },
                    network: {
                        select: { id: true, slug: true, name: true }
                    },
                    networkRun: {
                        select: {
                            id: true,
                            status: true,
                            startedAt: true,
                            completedAt: true,
                            durationMs: true
                        }
                    }
                },
                orderBy: { createdAt: "desc" },
                take: limit,
                skip: offset
            }),
            prisma.triggerEvent.count({ where: baseWhere })
        ]);

        return NextResponse.json({
            success: true,
            events: events.map((event) => ({
                id: event.id,
                status: event.status,
                sourceType: event.sourceType,
                triggerType: event.triggerType,
                entityType: event.entityType,
                integrationKey: event.integrationKey,
                integrationId: event.integrationId,
                eventName: event.eventName,
                webhookPath: event.webhookPath,
                errorMessage: event.errorMessage,
                payloadPreview: event.payloadPreview,
                payloadTruncated: event.payloadTruncated,
                createdAt: event.createdAt.toISOString(),
                updatedAt: event.updatedAt.toISOString(),
                trigger: event.trigger
                    ? {
                          id: event.trigger.id,
                          name: event.trigger.name,
                          triggerType: event.trigger.triggerType,
                          eventName: event.trigger.eventName,
                          webhookPath: event.trigger.webhookPath
                      }
                    : null,
                agent: event.agent
                    ? {
                          id: event.agent.id,
                          slug: event.agent.slug,
                          name: event.agent.name
                      }
                    : null,
                run: event.run
                    ? {
                          id: event.run.id,
                          status: event.run.status,
                          startedAt: event.run.startedAt.toISOString(),
                          completedAt: event.run.completedAt
                              ? event.run.completedAt.toISOString()
                              : null,
                          durationMs: event.run.durationMs
                      }
                    : null,
                workflow: event.workflow
                    ? {
                          id: event.workflow.id,
                          slug: event.workflow.slug,
                          name: event.workflow.name
                      }
                    : null,
                workflowRun: event.workflowRun
                    ? {
                          id: event.workflowRun.id,
                          status: event.workflowRun.status,
                          startedAt: event.workflowRun.startedAt?.toISOString() ?? null,
                          completedAt: event.workflowRun.completedAt?.toISOString() ?? null,
                          durationMs: event.workflowRun.durationMs
                      }
                    : null,
                network: event.network
                    ? {
                          id: event.network.id,
                          slug: event.network.slug,
                          name: event.network.name
                      }
                    : null,
                networkRun: event.networkRun
                    ? {
                          id: event.networkRun.id,
                          status: event.networkRun.status,
                          startedAt: event.networkRun.startedAt?.toISOString() ?? null,
                          completedAt: event.networkRun.completedAt?.toISOString() ?? null,
                          durationMs: event.networkRun.durationMs
                      }
                    : null
            })),
            pagination: {
                limit,
                offset,
                hasMore: offset + events.length < total
            },
            total
        });
    } catch (error) {
        console.error("[Trigger Monitor] Error:", error);
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            (error.code === "P2021" || error.code === "P2022")
        ) {
            return NextResponse.json({
                success: true,
                events: [],
                pagination: {
                    limit,
                    offset,
                    hasMore: false
                },
                total: 0
            });
        }
        return NextResponse.json(
            { success: false, error: "Failed to fetch trigger events" },
            { status: 500 }
        );
    }
}
