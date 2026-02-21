import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth, requireAgentAccess } from "@/lib/authz";
import { getAgentROI, getCostPerOutcome } from "@repo/agentc2/budget/outcomes";

/**
 * GET /api/agents/[id]/outcomes
 *
 * Get outcome metrics and ROI for an agent.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const accessResult = await requireAgentAccess(authResult.context.organizationId, id);
        if (accessResult.response) return accessResult.response;

        const agentId = accessResult.agentId!;
        const url = new URL(request.url);
        const periodDays = parseInt(url.searchParams.get("periodDays") ?? "30", 10);
        const outcomeType = url.searchParams.get("outcomeType");

        if (outcomeType) {
            const metrics = await getCostPerOutcome(agentId, outcomeType, periodDays);
            return NextResponse.json(metrics);
        }

        const roi = await getAgentROI(agentId, periodDays);

        const recentOutcomes = await prisma.agentOutcome.findMany({
            where: { agentId },
            orderBy: { createdAt: "desc" },
            take: 20
        });

        return NextResponse.json({ ...roi, recentOutcomes });
    } catch (error) {
        console.error("[outcomes] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}
