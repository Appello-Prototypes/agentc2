import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

async function resolveEntityId(entityType: string, idOrSlug: string): Promise<string | null> {
    if (entityType === "agent") {
        const agent = await prisma.agent.findFirst({
            where: { OR: [{ slug: idOrSlug }, { id: idOrSlug }] },
            select: { id: true }
        });
        return agent?.id || null;
    }
    if (entityType === "workflow") {
        const workflow = await prisma.workflow.findFirst({
            where: { OR: [{ slug: idOrSlug }, { id: idOrSlug }] },
            select: { id: true }
        });
        return workflow?.id || null;
    }
    if (entityType === "network") {
        const network = await prisma.network.findFirst({
            where: { OR: [{ slug: idOrSlug }, { id: idOrSlug }] },
            select: { id: true }
        });
        return network?.id || null;
    }
    return idOrSlug;
}

/**
 * GET /api/changelog?entityType=agent&entityId=xxx&limit=50&cursor=xxx
 *
 * entityId can be either the database ID or slug - it will be resolved.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const entityType = searchParams.get("entityType");
        const entityIdOrSlug = searchParams.get("entityId");
        const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
        const cursor = searchParams.get("cursor");

        if (!entityType || !entityIdOrSlug) {
            return NextResponse.json(
                { success: false, error: "entityType and entityId are required" },
                { status: 400 }
            );
        }

        const entityId = await resolveEntityId(entityType, entityIdOrSlug);
        if (!entityId) {
            return NextResponse.json(
                { success: false, error: `${entityType} '${entityIdOrSlug}' not found` },
                { status: 404 }
            );
        }

        const entries = await prisma.changeLog.findMany({
            where: { entityType, entityId },
            orderBy: { createdAt: "desc" },
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
        });

        const hasMore = entries.length > limit;
        const results = hasMore ? entries.slice(0, limit) : entries;
        const nextCursor = hasMore ? results[results.length - 1]?.id : null;

        return NextResponse.json({
            success: true,
            entries: results,
            nextCursor,
            totalCount: await prisma.changeLog.count({
                where: { entityType, entityId }
            })
        });
    } catch (error) {
        console.error("[ChangeLog] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to fetch changelog"
            },
            { status: 500 }
        );
    }
}
