/**
 * Activity Feed API
 *
 * GET /api/activity -- Unified activity feed across all agents.
 * Reads from the denormalized activity_event table.
 * Supports filtering, cursor pagination, and aggregate metrics.
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma, type ActivityEventType, type Prisma } from "@repo/database"

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)

        // Parse filters
        const typeFilter = searchParams.get("type") // Comma-separated ActivityEventType values
        const agentId = searchParams.get("agentId")
        const agentSlug = searchParams.get("agentSlug")
        const source = searchParams.get("source")
        const status = searchParams.get("status")
        const from = searchParams.get("from")
        const to = searchParams.get("to")
        const search = searchParams.get("search")
        const cursor = searchParams.get("cursor")
        const tags = searchParams.get("tags") // Comma-separated
        const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200)

        // Build where clause
        const where: Prisma.ActivityEventWhereInput = {}

        if (typeFilter) {
            where.type = { in: typeFilter.split(",").map((t) => t.trim()) as ActivityEventType[] }
        }
        if (agentId) {
            where.agentId = agentId
        }
        if (agentSlug) {
            where.agentSlug = agentSlug
        }
        if (source) {
            where.source = source
        }
        if (status) {
            where.status = status
        }
        if (from || to) {
            where.timestamp = {}
            if (from) where.timestamp.gte = new Date(from)
            if (to) where.timestamp.lte = new Date(to)
        }
        if (search) {
            where.OR = [
                { summary: { contains: search, mode: "insensitive" } },
                { detail: { contains: search, mode: "insensitive" } },
            ]
        }
        if (tags) {
            where.tags = { hasSome: tags.split(",").map((t) => t.trim()) }
        }
        if (cursor) {
            where.id = { lt: cursor }
        }

        // Fetch events
        const events = await prisma.activityEvent.findMany({
            where,
            orderBy: { timestamp: "desc" },
            take: limit + 1, // Fetch one extra to determine hasMore
        })

        const hasMore = events.length > limit
        const results = hasMore ? events.slice(0, limit) : events
        const nextCursor = hasMore ? results[results.length - 1]?.id : null

        // Compute aggregate metrics (parallel queries for performance)
        const metricsWhere = { ...where }
        delete metricsWhere.id // Remove cursor filter for metrics

        const [totalCount, byType, byAgent, costAgg] = await Promise.all([
            prisma.activityEvent.count({ where: metricsWhere }),
            prisma.activityEvent.groupBy({
                by: ["type"],
                where: metricsWhere,
                _count: { type: true },
            }),
            prisma.activityEvent.groupBy({
                by: ["agentSlug", "agentName"],
                where: { ...metricsWhere, agentSlug: { not: null } },
                _count: { agentSlug: true },
                orderBy: { _count: { agentSlug: "desc" } },
                take: 20,
            }),
            prisma.activityEvent.aggregate({
                where: metricsWhere,
                _sum: { costUsd: true },
                _avg: { durationMs: true },
            }),
        ])

        const byTypeMap: Record<string, number> = {}
        for (const t of byType) {
            byTypeMap[t.type] = t._count.type
        }

        return NextResponse.json({
            success: true,
            events: results,
            metrics: {
                totalEvents: totalCount,
                byType: byTypeMap,
                byAgent: byAgent.map((a) => ({
                    agentSlug: a.agentSlug,
                    agentName: a.agentName,
                    count: a._count.agentSlug,
                })),
                totalCost: costAgg._sum.costUsd || 0,
                avgDuration: Math.round(costAgg._avg.durationMs || 0),
            },
            hasMore,
            nextCursor,
        })
    } catch (error) {
        console.error("[Activity API] Error:", error)
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        )
    }
}
