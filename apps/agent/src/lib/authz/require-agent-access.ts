import { NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * Check that the authenticated user can access an agent.
 *
 * Access is granted when ANY of these conditions are met:
 *   1. The agent belongs to a workspace in the user's active organization
 *   2. The agent is owned by the user within the same organization
 *   3. The agent has PUBLIC visibility
 *
 * This aligns with AgentResolver.listForUser() so that agents shown in the
 * selector are also accessible via chat/invoke/etc.
 */
export async function requireAgentAccess(
    organizationId: string,
    agentRef: string,
    userId?: string
): Promise<
    { agentId: string; response?: undefined } | { agentId?: undefined; response: NextResponse }
> {
    const agent = await prisma.agent.findFirst({
        where: {
            AND: [
                { OR: [{ id: agentRef }, { slug: agentRef }] },
                { isActive: true },
                {
                    OR: [
                        { workspace: { organizationId } },
                        ...(userId ? [{ ownerId: userId, workspace: { organizationId } }] : []),
                        { visibility: "PUBLIC" }
                    ]
                }
            ]
        },
        select: { id: true }
    });

    if (!agent) {
        return {
            response: NextResponse.json(
                { success: false, error: "Agent not found" },
                { status: 404 }
            )
        };
    }

    return { agentId: agent.id };
}
