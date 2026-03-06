import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@repo/database";
import { getMcpTools } from "@repo/agentc2/mcp";
import { authenticateRequest } from "@/lib/api-auth";
import { resolveConnectionServerId, computeEffectiveDefault } from "@/lib/integrations";

/**
 * GET /api/integrations/connections/[connectionId]/actions
 *
 * List actions and triggers for a connection.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ connectionId: string }> }
) {
    try {
        const authContext = await authenticateRequest(request as NextRequest);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }
        const organizationId = authContext.organizationId;

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
            const isEffectiveDefault = await computeEffectiveDefault(
                connection,
                connection.provider.key
            );
            const serverId = resolveConnectionServerId(
                connection.provider.key,
                connection,
                isEffectiveDefault
            );
            const { tools } = await getMcpTools({
                organizationId,
                userId: authContext.userId
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
