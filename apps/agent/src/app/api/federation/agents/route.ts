import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { discoverFederatedAgents, getExposedAgentCards } from "@repo/mastra/federation";

/**
 * GET /api/federation/agents
 *
 * Discover agents available through federation connections.
 *
 * Query params:
 *   agreementId - Scope to a specific connection
 *
 * Returns A2A-compatible Agent Cards for all federated agents
 * available to the requesting organization.
 */
export async function GET(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const agreementId = searchParams.get("agreementId");

        let cards;
        if (agreementId) {
            cards = await getExposedAgentCards(agreementId, authContext.organizationId);
        } else {
            cards = await discoverFederatedAgents(authContext.organizationId);
        }

        return NextResponse.json({
            success: true,
            agents: cards,
            count: cards.length
        });
    } catch (error) {
        console.error("[Federation] Discover agents error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to discover agents" },
            { status: 500 }
        );
    }
}
