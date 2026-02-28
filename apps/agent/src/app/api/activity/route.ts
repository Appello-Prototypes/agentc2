/**
 * Activity Feed API
 *
 * GET /api/activity -- Unified activity feed across all agents.
 * Reads from the denormalized activity_event table.
 * Supports filtering, cursor pagination, and aggregate metrics.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma, type ActivityEventType, type Prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);

        // Parse filters
        const typeFilter = searchParams.get("type"); // Comma-separated ActivityEventType values
        const agentId = searchParams.get("agentId");
        const agentSlug = searchParams.get("agentSlug");
        const source = searchParams.get("source");
        const status = searchParams.get("status");
        const from = searchParams.get("from");
        const to = searchParams.get("to");
        const search = searchParams.get("search");
        const cursor = searchParams.get("cursor");
        const tags = searchParams.get("tags"); // Comma-separated
        const since = searchParams.get("since"); // ISO timestamp for polling new events
        const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

        // Build where clause -- scoped to current org
        const where: Prisma.ActivityEventWhereInput = {
            tenantId: authContext.organizationId
        };

        if (typeFilter) {
            where.type = { in: typeFilter.split(",").map((t) => t.trim()) as ActivityEventType[] };
        }
        if (agentId) {
            where.agentId = agentId;
        }
        if (agentSlug) {
            where.agentSlug = agentSlug;
        }
        if (source) {
            where.source = source;
        }
        if (status) {
            where.status = status;
        }
        if (from || to) {
            where.timestamp = {};
            if (from) where.timestamp.gte = new Date(from);
            if (to) where.timestamp.lte = new Date(to);
        }
        if (search) {
            where.OR = [
                { summary: { contains: search, mode: "insensitive" } },
                { detail: { contains: search, mode: "insensitive" } }
            ];
        }
        if (tags) {
            where.tags = { hasSome: tags.split(",").map((t) => t.trim()) };
        }
        if (since) {
            where.timestamp = {
                ...(where.timestamp as Record<string, Date> | undefined),
                gt: new Date(since)
            };
        }
        if (cursor) {
            where.id = { lt: cursor };
        }

        // Fetch events
        const events = await prisma.activityEvent.findMany({
            where,
            orderBy: { timestamp: "desc" },
            take: limit + 1 // Fetch one extra to determine hasMore
        });

        const hasMore = events.length > limit;
        const results = hasMore ? events.slice(0, limit) : events;
        const nextCursor = hasMore ? results[results.length - 1]?.id : null;

        // Compute aggregate metrics (parallel queries for performance)
        const metricsWhere = { ...where };
        delete metricsWhere.id; // Remove cursor filter for metrics

        // When polling with `since`, also compute full (unfiltered) metrics
        // so the dashboard stats stay accurate instead of resetting to zero.
        const isPolling = !!since;

        const queries: Promise<unknown>[] = [
            prisma.activityEvent.count({ where: metricsWhere }),
            prisma.activityEvent.groupBy({
                by: ["type"],
                where: metricsWhere,
                _count: { type: true }
            }),
            prisma.activityEvent.groupBy({
                by: ["agentSlug", "agentName"],
                where: { ...metricsWhere, agentSlug: { not: null } },
                _count: { agentSlug: true },
                orderBy: { _count: { agentSlug: "desc" } },
                take: 20
            }),
            prisma.activityEvent.aggregate({
                where: metricsWhere,
                _sum: { costUsd: true },
                _avg: { durationMs: true }
            })
        ];

        if (isPolling) {
            const fullWhere: Prisma.ActivityEventWhereInput = {
                tenantId: authContext.organizationId
            };
            if (agentSlug) fullWhere.agentSlug = agentSlug;
            if (typeFilter)
                fullWhere.type = {
                    in: typeFilter.split(",").map((t) => t.trim()) as ActivityEventType[]
                };

            queries.push(
                prisma.activityEvent.count({ where: fullWhere }),
                prisma.activityEvent.groupBy({
                    by: ["type"],
                    where: fullWhere,
                    _count: { type: true }
                }),
                prisma.activityEvent.groupBy({
                    by: ["agentSlug", "agentName"],
                    where: { ...fullWhere, agentSlug: { not: null } },
                    _count: { agentSlug: true },
                    orderBy: { _count: { agentSlug: "desc" } },
                    take: 20
                }),
                prisma.activityEvent.aggregate({
                    where: fullWhere,
                    _sum: { costUsd: true },
                    _avg: { durationMs: true }
                })
            );
        }

        const queryResults = await Promise.all(queries);

        const totalCount = queryResults[0] as number;
        const byType = queryResults[1] as Array<{ type: string; _count: { type: number } }>;
        const byAgent = queryResults[2] as Array<{
            agentSlug: string;
            agentName: string;
            _count: { agentSlug: number };
        }>;
        const costAgg = queryResults[3] as {
            _sum: { costUsd: number | null };
            _avg: { durationMs: number | null };
        };

        const byTypeMap: Record<string, number> = {};
        for (const t of byType) {
            byTypeMap[t.type] = t._count.type;
        }

        const buildMetrics = (
            total: number,
            typeMap: Record<string, number>,
            agents: Array<{ agentSlug: string; agentName: string; _count: { agentSlug: number } }>,
            agg: { _sum: { costUsd: number | null }; _avg: { durationMs: number | null } }
        ) => ({
            totalEvents: total,
            byType: typeMap,
            byAgent: agents.map((a) => ({
                agentSlug: a.agentSlug,
                agentName: a.agentName,
                count: a._count.agentSlug
            })),
            totalCost: agg._sum.costUsd || 0,
            avgDuration: Math.round(agg._avg.durationMs || 0)
        });

        const metrics = buildMetrics(totalCount, byTypeMap, byAgent, costAgg);

        let fullMetrics = undefined;
        if (isPolling) {
            const fullTotal = queryResults[4] as number;
            const fullByType = queryResults[5] as Array<{ type: string; _count: { type: number } }>;
            const fullByAgent = queryResults[6] as Array<{
                agentSlug: string;
                agentName: string;
                _count: { agentSlug: number };
            }>;
            const fullCostAgg = queryResults[7] as {
                _sum: { costUsd: number | null };
                _avg: { durationMs: number | null };
            };
            const fullByTypeMap: Record<string, number> = {};
            for (const t of fullByType) {
                fullByTypeMap[t.type] = t._count.type;
            }
            fullMetrics = buildMetrics(fullTotal, fullByTypeMap, fullByAgent, fullCostAgg);
        }

        return NextResponse.json({
            success: true,
            events: results,
            metrics,
            ...(fullMetrics ? { fullMetrics } : {}),
            hasMore,
            nextCursor
        });
    } catch (error) {
        console.error("[Activity API] Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
