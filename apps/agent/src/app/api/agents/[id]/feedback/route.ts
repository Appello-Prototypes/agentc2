import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /api/agents/[id]/feedback/summary
 *
 * Get feedback summary for an agent
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);

        const from = searchParams.get("from");
        const to = searchParams.get("to");

        // Default to last 30 days if no date range provided
        const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = to ? new Date(to) : new Date();

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

        // Get feedback
        const feedback = await prisma.agentFeedback.findMany({
            where: {
                agentId: agent.id,
                createdAt: {
                    gte: startDate,
                    lte: endDate
                }
            },
            select: {
                thumbs: true,
                rating: true,
                comment: true
            }
        });

        const positive = feedback.filter((f) => f.thumbs === true).length;
        const negative = feedback.filter((f) => f.thumbs === false).length;
        const total = feedback.length;

        // Calculate average rating
        const ratings = feedback.filter((f) => f.rating !== null).map((f) => f.rating!);
        const avgRating =
            ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

        // Get themes from EvaluationTheme table
        const themes = await prisma.evaluationTheme.findMany({
            where: {
                agentId: agent.id,
                createdAt: {
                    gte: startDate,
                    lte: endDate
                }
            },
            orderBy: { count: "desc" },
            take: 10
        });

        return NextResponse.json({
            success: true,
            summary: {
                positive,
                negative,
                total,
                positiveRate: total > 0 ? Math.round((positive / total) * 100) : 0,
                avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null
            },
            themes: themes.map((t) => ({
                theme: t.theme,
                sentiment: t.sentiment,
                count: t.count
            })),
            dateRange: {
                from: startDate.toISOString(),
                to: endDate.toISOString()
            }
        });
    } catch (error) {
        console.error("[Agent Feedback Summary] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get feedback"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/agents/[id]/feedback
 *
 * Submit feedback for a run
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();

        const { runId, thumbs, rating, comment } = body;

        if (!runId) {
            return NextResponse.json(
                { success: false, error: "Missing required field: runId" },
                { status: 400 }
            );
        }

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

        // Verify the run exists and belongs to this agent
        const run = await prisma.agentRun.findFirst({
            where: {
                id: runId,
                agentId: agent.id
            }
        });

        if (!run) {
            return NextResponse.json(
                { success: false, error: `Run '${runId}' not found` },
                { status: 404 }
            );
        }

        // Upsert feedback
        const feedback = await prisma.agentFeedback.upsert({
            where: { runId },
            update: {
                thumbs: thumbs ?? undefined,
                rating: rating ?? undefined,
                comment: comment ?? undefined
            },
            create: {
                runId,
                agentId: agent.id,
                tenantId: agent.tenantId,
                thumbs: thumbs ?? null,
                rating: rating ?? null,
                comment: comment ?? null
            }
        });

        return NextResponse.json({
            success: true,
            feedback: {
                id: feedback.id,
                runId: feedback.runId,
                thumbs: feedback.thumbs,
                rating: feedback.rating,
                comment: feedback.comment,
                createdAt: feedback.createdAt
            }
        });
    } catch (error) {
        console.error("[Agent Feedback Create] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to submit feedback"
            },
            { status: 500 }
        );
    }
}
