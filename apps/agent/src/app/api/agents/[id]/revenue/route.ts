import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth, requireAgentAccess } from "@/lib/authz";
import { getAgentRevenue } from "@repo/agentc2/budget/revenue";

/**
 * GET /api/agents/[id]/revenue
 *
 * Get revenue metrics for an agent.
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

        const revenue = await getAgentRevenue(agentId, periodDays);

        const recentEvents = await prisma.agentRevenueEvent.findMany({
            where: { agentId },
            orderBy: { createdAt: "desc" },
            take: 20
        });

        return NextResponse.json({ ...revenue, recentEvents });
    } catch (error) {
        console.error("[revenue] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}
