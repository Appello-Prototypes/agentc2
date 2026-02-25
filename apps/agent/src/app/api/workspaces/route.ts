import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth } from "@/lib/authz";

/**
 * GET /api/workspaces
 *
 * List workspaces for the current user's organization.
 * Convenience endpoint used by the marketplace deploy page.
 */
export async function GET(request: NextRequest) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) {
            return authResult.response;
        }

        const { organizationId } = authResult.context;

        const workspaces = await prisma.workspace.findMany({
            where: { organizationId },
            orderBy: [{ isDefault: "desc" }, { name: "asc" }],
            include: {
                _count: {
                    select: { agents: true }
                }
            }
        });

        return NextResponse.json({
            workspaces: workspaces.map((ws) => ({
                id: ws.id,
                name: ws.name,
                slug: ws.slug,
                environment: ws.environment,
                description: ws.description,
                isDefault: ws.isDefault,
                agentsCount: ws._count.agents
            }))
        });
    } catch (error) {
        console.error("[Workspaces] Error listing:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Failed to list workspaces"
            },
            { status: 500 }
        );
    }
}
