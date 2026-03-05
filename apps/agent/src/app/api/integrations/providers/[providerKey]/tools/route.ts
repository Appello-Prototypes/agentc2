import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { getMcpToolsForServer } from "@repo/agentc2/mcp";
import {
    rediscoverToolsForConnection,
    syncIntegrationToolRecords
} from "@repo/agentc2/integrations";
import { getUserOrganizationId } from "@/lib/organization";
import { resolveConnectionServerId } from "@/lib/integrations";

/**
 * GET /api/integrations/providers/[providerKey]/tools
 *
 * Returns full IntegrationTool details (with enablement status) for this provider.
 * Falls back to live MCP tool discovery if no IntegrationTool records exist yet.
 */
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ providerKey: string }> }
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
                OR: [{ scope: "org" }, { scope: "user", userId: session.user.id }]
            },
            orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
        });

        // Try to load IntegrationTool records first
        const connectionIds = connections.map((c) => c.id);
        let integrationTools =
            connectionIds.length > 0
                ? await prisma.integrationTool.findMany({
                      where: { connectionId: { in: connectionIds } },
                      orderBy: [{ isEnabled: "desc" }, { name: "asc" }]
                  })
                : [];

        // If no IntegrationTool records exist, fall back to live MCP discovery and auto-populate
        if (integrationTools.length === 0 && connections.length > 0) {
            const defaultConn = connections.find((c) => c.isDefault) || connections[0];
            const serverId = resolveConnectionServerId(provider.key, defaultConn);
            const liveTools = await getMcpToolsForServer({
                serverId,
                organizationId,
                userId: session.user.id,
                allowEnvFallback: false
            }).catch(() => ({}));

            const toolEntries = Object.entries(liveTools);
            if (toolEntries.length > 0) {
                const defs = toolEntries.map(([name, tool]) => {
                    const t = tool as {
                        description?: string;
                        inputSchema?: { shape?: Record<string, unknown> };
                    };
                    return {
                        toolId: name,
                        name: t.description || name,
                        description: t.description || "",
                        inputSchema: t.inputSchema?.shape || null
                    };
                });
                await syncIntegrationToolRecords(defaultConn.id, provider.key, defs);
                integrationTools = await prisma.integrationTool.findMany({
                    where: { connectionId: defaultConn.id },
                    orderBy: [{ isEnabled: "desc" }, { name: "asc" }]
                });
            }
        }

        // Count agent usage per tool
        const toolIds = integrationTools.map((t) => t.toolId);
        const agentToolCounts =
            toolIds.length > 0
                ? await prisma.agentTool.groupBy({
                      by: ["toolId"],
                      where: { toolId: { in: toolIds } },
                      _count: true
                  })
                : [];
        const usageMap = new Map(agentToolCounts.map((r) => [r.toolId, r._count]));

        const enabledCount = integrationTools.filter((t) => t.isEnabled).length;

        return NextResponse.json({
            success: true,
            providerKey: provider.key,
            totalTools: integrationTools.length,
            enabledTools: enabledCount,
            tools: integrationTools.map((t) => ({
                id: t.id,
                toolId: t.toolId,
                name: t.name,
                description: t.description,
                isEnabled: t.isEnabled,
                validationStatus: t.validationStatus,
                lastValidatedAt: t.lastValidatedAt?.toISOString() ?? null,
                errorMessage: t.errorMessage,
                usedByCount: usageMap.get(t.toolId) ?? 0
            }))
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
                OR: [{ scope: "org" }, { scope: "user", userId: session.user.id }]
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

/**
 * PATCH /api/integrations/providers/[providerKey]/tools
 *
 * Toggle tool enablement for one or more tools.
 * Body: { toolIds: string[], isEnabled: boolean }
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ providerKey: string }> }
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

        const { providerKey } = await params;
        const body = await request.json();
        const { toolIds, isEnabled } = body as { toolIds: string[]; isEnabled: boolean };

        if (!Array.isArray(toolIds) || typeof isEnabled !== "boolean") {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid request: toolIds (array) and isEnabled (boolean) required"
                },
                { status: 400 }
            );
        }

        // Verify org ownership of the tools
        const tools = await prisma.integrationTool.findMany({
            where: {
                toolId: { in: toolIds },
                providerKey,
                connection: { organizationId }
            },
            select: { id: true, toolId: true }
        });

        if (tools.length === 0) {
            return NextResponse.json(
                { success: false, error: "No matching tools found" },
                { status: 404 }
            );
        }

        await prisma.integrationTool.updateMany({
            where: { id: { in: tools.map((t) => t.id) } },
            data: { isEnabled }
        });

        // Warn if disabling tools used by active agents
        let warnings: string[] = [];
        if (!isEnabled) {
            const affectedAgents = await prisma.agentTool.findMany({
                where: { toolId: { in: toolIds } },
                include: { agent: { select: { name: true, slug: true } } }
            });
            if (affectedAgents.length > 0) {
                const uniqueAgents = [...new Set(affectedAgents.map((a) => a.agent.name))];
                warnings = [
                    `${uniqueAgents.length} agent(s) use these tools: ${uniqueAgents.join(", ")}`
                ];
            }
        }

        return NextResponse.json({
            success: true,
            updated: tools.length,
            isEnabled,
            warnings
        });
    } catch (error) {
        console.error("[Integrations Providers] Tool toggle error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to toggle tools"
            },
            { status: 500 }
        );
    }
}
