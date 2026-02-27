import { NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { getMcpToolsForServer } from "@repo/agentc2/mcp";
import { rediscoverToolsForConnection } from "@repo/agentc2/integrations";
import { requireUserWithOrg } from "@/lib/authz/require-auth";
import { resolveConnectionServerId } from "@/lib/integrations";

/**
 * GET /api/integrations/providers/[providerKey]/tools
 *
 * List tool counts for a single provider. Connects only to the provider's servers.
 */
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ providerKey: string }> }
) {
    try {
        const authResult = await requireUserWithOrg();
        if (authResult.response) return authResult.response;

        const { userId, organizationId } = authResult.context;

        const { providerKey } = await params;
        const provider = await prisma.integrationProvider.findFirst({
            where: { key: providerKey, isActive: true }
        });
        if (!provider) {
            return NextResponse.json(
                { success: false, error: "Provider not found" },
                { status: 404 }
            );
        }

        const connections = await prisma.integrationConnection.findMany({
            where: {
                organizationId,
                providerId: provider.id,
                isActive: true,
                OR: [{ scope: "org" }, { scope: "user", userId }]
            },
            orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
        });

        const results = [];
        let totalTools = 0;

        if (connections.length > 0) {
            for (const connection of connections) {
                const serverId = resolveConnectionServerId(provider.key, connection);
                const tools = await getMcpToolsForServer({
                    serverId,
                    organizationId,
                    userId,
                    allowEnvFallback: false
                }).catch(() => ({}));
                const toolNames = Object.keys(tools);
                const toolCount = toolNames.length;
                totalTools += toolCount;
                results.push({
                    connectionId: connection.id,
                    connectionName: connection.name,
                    serverId,
                    toolCount,
                    sampleTools: toolNames.slice(0, 5)
                });
            }
        } else if (provider.providerType === "mcp" || provider.providerType === "custom") {
            const tools = await getMcpToolsForServer({
                serverId: provider.key,
                organizationId,
                userId,
                allowEnvFallback: true
            }).catch(() => ({}));
            const toolNames = Object.keys(tools);
            const toolCount = toolNames.length;
            totalTools += toolCount;
            results.push({
                connectionId: null,
                connectionName: null,
                serverId: provider.key,
                toolCount,
                sampleTools: toolNames.slice(0, 5)
            });
        }

        return NextResponse.json({
            success: true,
            providerKey: provider.key,
            totalTools,
            servers: results
        });
    } catch (error) {
        console.error("[Integrations Providers] Tool list error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list provider tools"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/integrations/providers/[providerKey]/tools
 *
 * Trigger manual tool re-discovery for a provider's active connections.
 */
export async function POST(
    _request: Request,
    { params }: { params: Promise<{ providerKey: string }> }
) {
    try {
        const authResult = await requireUserWithOrg();
        if (authResult.response) return authResult.response;

        const { userId, organizationId } = authResult.context;

        const { providerKey } = await params;
        const provider = await prisma.integrationProvider.findFirst({
            where: { key: providerKey, isActive: true }
        });
        if (!provider) {
            return NextResponse.json(
                { success: false, error: "Provider not found" },
                { status: 404 }
            );
        }

        const connections = await prisma.integrationConnection.findMany({
            where: {
                organizationId,
                providerId: provider.id,
                isActive: true,
                OR: [{ scope: "org" }, { scope: "user", userId }]
            }
        });

        if (connections.length === 0) {
            return NextResponse.json(
                { success: false, error: "No active connections for this provider" },
                { status: 404 }
            );
        }

        const results = [];
        for (const connection of connections) {
            const result = await rediscoverToolsForConnection(connection.id);
            if (result) {
                results.push(result);
            }
        }

        return NextResponse.json({
            success: true,
            providerKey: provider.key,
            rediscovery: results
        });
    } catch (error) {
        console.error("[Integrations Providers] Tool rediscovery error:", error);
        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error ? error.message : "Failed to rediscover provider tools"
            },
            { status: 500 }
        );
    }
}
