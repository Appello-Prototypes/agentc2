import { NextResponse } from "next/server";
import { prisma } from "@repo/database";

export async function requireAgentAccess(
    organizationId: string,
    agentRef: string
): Promise<
    { agentId: string; response?: undefined } | { agentId?: undefined; response: NextResponse }
> {
    const agent = await prisma.agent.findFirst({
        where: {
            AND: [
                { OR: [{ id: agentRef }, { slug: agentRef }] },
                { OR: [{ workspace: { organizationId } }, { tenantId: organizationId }] }
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
