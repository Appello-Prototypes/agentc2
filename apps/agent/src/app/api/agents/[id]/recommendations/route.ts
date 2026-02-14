import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /api/agents/[id]/recommendations
 *
 * List institutional memory (recommendations) for an agent.
 * Supports filtering by status, type, and category.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);

        const status = searchParams.get("status"); // "active", "graduated", "expired", "rejected"
        const type = searchParams.get("type"); // "sustain", "improve"
        const category = searchParams.get("category");
        const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

        // Find agent by slug or id
        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id: id }]
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        // Build where clause
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = { agentId: agent.id };
        if (status) where.status = status;
        if (type) where.type = type;
        if (category) where.category = category;

        const [recommendations, stats] = await Promise.all([
            prisma.agentRecommendation.findMany({
                where,
                orderBy: [{ frequency: "desc" }, { createdAt: "desc" }],
                take: limit,
                include: {
                    evaluation: {
                        select: {
                            id: true,
                            overallGrade: true,
                            createdAt: true
                        }
                    }
                }
            }),
            // Get aggregate stats
            prisma.agentRecommendation.groupBy({
                by: ["status"],
                where: { agentId: agent.id },
                _count: { id: true }
            })
        ]);

        const statusCounts: Record<string, number> = {};
        for (const s of stats) {
            statusCounts[s.status] = s._count.id;
        }

        return NextResponse.json({
            success: true,
            recommendations: recommendations.map((r) => ({
                id: r.id,
                type: r.type,
                category: r.category,
                title: r.title,
                description: r.description,
                evidence: r.evidence,
                priority: r.priority,
                status: r.status,
                frequency: r.frequency,
                graduatedTo: r.graduatedTo,
                graduatedRef: r.graduatedRef,
                expiresAt: r.expiresAt,
                createdAt: r.createdAt,
                updatedAt: r.updatedAt,
                evaluation: r.evaluation
            })),
            stats: {
                total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
                ...statusCounts
            }
        });
    } catch (error) {
        console.error("[Agent Recommendations] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get recommendations"
            },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/agents/[id]/recommendations
 *
 * Update a recommendation's status (reject, expire, etc.)
 * Body: { recommendationId: string, status: string }
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { recommendationId, status } = body;

        if (!recommendationId || !status) {
            return NextResponse.json(
                { success: false, error: "recommendationId and status are required" },
                { status: 400 }
            );
        }

        if (!["active", "graduated", "expired", "rejected"].includes(status)) {
            return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
        }

        // Verify agent exists
        const agent = await prisma.agent.findFirst({
            where: { OR: [{ slug: id }, { id: id }] }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        const updated = await prisma.agentRecommendation.update({
            where: { id: recommendationId },
            data: { status }
        });

        return NextResponse.json({ success: true, recommendation: updated });
    } catch (error) {
        console.error("[Agent Recommendations PATCH] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to update recommendation"
            },
            { status: 500 }
        );
    }
}
