import { NextResponse } from "next/server";
import { getIntegrationProviders, getMcpTools } from "@repo/mastra/mcp";
import { prisma } from "@repo/database";
import { getDemoSession } from "@/lib/standalone-auth";
import { getUserOrganizationId } from "@/lib/organization";
import { getConnectionMissingFields, resolveConnectionServerId } from "@/lib/integrations";

export interface McpToolInfo {
    name: string;
    description: string;
    serverId: string;
    inputSchema?: unknown;
}

export interface McpServerStatus {
    id: string;
    name: string;
    description: string;
    category: string;
    status: "connected" | "disconnected" | "error" | "missing_config";
    tools: McpToolInfo[];
    error?: string;
    requiresAuth: boolean;
    missingEnvVars?: string[];
}

export interface McpStatusResponse {
    servers: McpServerStatus[];
    totalTools: number;
    connectedServers: number;
    timestamp: number;
}

export async function GET() {
    try {
        const session = await getDemoSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const organizationId = await getUserOrganizationId(session.user.id);
        if (!organizationId) {
            return NextResponse.json(
                { error: "Organization membership required" },
                { status: 403 }
            );
        }

        let toolSnapshot: Record<string, unknown> = {};
        try {
            const result = await getMcpTools({
                organizationId,
                userId: session.user.id
            });
            toolSnapshot = result.tools;
        } catch (error) {
            console.error("[MCP Status] Failed to load MCP tools:", error);
        }

        const [providers, connections] = await Promise.all([
            getIntegrationProviders(),
            prisma.integrationConnection.findMany({
                where: { organizationId },
                include: { provider: true }
            })
        ]);

        const toolsByServer: Record<string, McpToolInfo[]> = {};
        for (const [toolName, toolDef] of Object.entries(toolSnapshot)) {
            const underscoreIndex = toolName.indexOf("_");
            if (underscoreIndex > 0) {
                const serverId = toolName.substring(0, underscoreIndex);
                const actualToolName = toolName.substring(underscoreIndex + 1);
                if (!toolsByServer[serverId]) {
                    toolsByServer[serverId] = [];
                }
                toolsByServer[serverId].push({
                    name: actualToolName,
                    description:
                        (toolDef as { description?: string })?.description ||
                        "No description available",
                    serverId,
                    inputSchema: (toolDef as { parameters?: unknown })?.parameters
                });
            }
        }

        const servers: McpServerStatus[] = providers.map((provider) => {
            const providerConnections = connections.filter(
                (connection) => connection.providerId === provider.id && connection.isActive
            );
            const defaultConnection =
                providerConnections.find((connection) => connection.isDefault) ||
                providerConnections[0];

            const missingFields = providerConnections.flatMap((connection) =>
                getConnectionMissingFields(connection, provider)
            );

            const hasMissing = missingFields.length > 0;
            const hasConnections = providerConnections.length > 0;

            let status: McpServerStatus["status"] = "disconnected";
            if (provider.authType === "none") {
                status = "connected";
            } else if (!hasConnections) {
                status = "disconnected";
            } else if (hasMissing) {
                status = "missing_config";
            } else {
                status = "connected";
            }

            const serverId = defaultConnection
                ? resolveConnectionServerId(provider.key, defaultConnection)
                : provider.key;
            const serverTools =
                provider.providerType === "mcp" ? toolsByServer[serverId] || [] : [];

            return {
                id: provider.key,
                name: provider.name,
                description: provider.description || "",
                category: provider.category,
                status,
                tools: serverTools,
                requiresAuth: provider.authType !== "none",
                missingEnvVars: hasMissing ? Array.from(new Set(missingFields)) : undefined
            };
        });

        const response: McpStatusResponse = {
            servers,
            totalTools: Object.keys(toolSnapshot).length,
            connectedServers: servers.filter((s) => s.status === "connected").length,
            timestamp: Date.now()
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error("MCP status error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to get MCP status" },
            { status: 500 }
        );
    }
}
