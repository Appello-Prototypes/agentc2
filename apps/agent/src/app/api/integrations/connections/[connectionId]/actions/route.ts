import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { getMcpTools } from "@repo/mastra/mcp";
import { getUserOrganizationId } from "@/lib/organization";
import { resolveConnectionServerId } from "@/lib/integrations";

/**
 * GET /api/integrations/connections/[connectionId]/actions
 *
 * List actions and triggers for a connection.
 */
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ connectionId: string }> }
) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const organizationId = await getUserOrganizationId(session.user.id);
        if (!organizationId) {
            return NextResponse.json(
                { success: false, error: "Organization membership required" },
                { status: 403 }
            );
        }

        const { connectionId } = await params;
        const connection = await prisma.integrationConnection.findFirst({
            where: { id: connectionId, organizationId },
            include: { provider: true }
        });

        if (!connection) {
            return NextResponse.json(
                { success: false, error: "Connection not found" },
                { status: 404 }
            );
        }

        if (
            connection.provider.providerType === "mcp" ||
            connection.provider.providerType === "custom"
        ) {
            const serverId = resolveConnectionServerId(connection.provider.key, connection);
            const { tools } = await getMcpTools({
                organizationId,
                userId: session.user.id
            });
            const actions = Object.entries(tools)
                .filter(([name]) => name.startsWith(`${serverId}_`))
                .map(([name, toolDef]) => ({
                    name,
                    description:
                        (toolDef as { description?: string })?.description ||
                        "No description available",
                    inputSchema: (toolDef as { parameters?: unknown })?.parameters || null
                }));

            return NextResponse.json({
                success: true,
                actions,
                triggers: connection.provider.triggersJson || null
            });
        }

        return NextResponse.json({
            success: true,
            actions: connection.provider.actionsJson || null,
            triggers: connection.provider.triggersJson || null
        });
    } catch (error) {
        console.error("[Integrations Connection Actions] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to load actions"
            },
            { status: 500 }
        );
    }
}
