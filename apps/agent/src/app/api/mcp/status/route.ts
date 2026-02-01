import { NextResponse } from "next/server";
import { MCP_SERVER_CONFIGS, getMcpTools, type McpServerConfig } from "@repo/mastra";
import { getDemoSession } from "@/lib/standalone-auth";

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

/**
 * Check if required environment variables are set for a server
 */
function checkEnvVars(config: McpServerConfig): { configured: boolean; missing: string[] } {
    if (!config.envVars || config.envVars.length === 0) {
        return { configured: true, missing: [] };
    }

    const missing = config.envVars.filter((envVar) => !process.env[envVar]);
    return { configured: missing.length === 0, missing };
}

export async function GET() {
    try {
        const session = await getDemoSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get all tools from MCP client
        let mcpTools: Record<string, unknown> = {};
        let connectionError: string | undefined;

        try {
            mcpTools = await getMcpTools();
        } catch (error) {
            connectionError =
                error instanceof Error ? error.message : "Failed to connect to MCP servers";
        }

        // Map tools to their server IDs (tool names are prefixed with serverId_)
        const toolsByServer: Record<string, McpToolInfo[]> = {};

        for (const [toolName, toolDef] of Object.entries(mcpTools)) {
            // Tool names are formatted as serverId_toolName
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

        // Build server status for each configured server
        const servers: McpServerStatus[] = MCP_SERVER_CONFIGS.map((config) => {
            const envCheck = checkEnvVars(config);
            const serverTools = toolsByServer[config.id] || [];

            let status: McpServerStatus["status"];
            let error: string | undefined;

            if (!envCheck.configured) {
                status = "missing_config";
                error = `Missing environment variables: ${envCheck.missing.join(", ")}`;
            } else if (connectionError) {
                status = "error";
                error = connectionError;
            } else if (serverTools.length > 0) {
                status = "connected";
            } else {
                status = "disconnected";
            }

            return {
                id: config.id,
                name: config.name,
                description: config.description,
                category: config.category,
                status,
                tools: serverTools,
                error,
                requiresAuth: config.requiresAuth,
                missingEnvVars: envCheck.missing.length > 0 ? envCheck.missing : undefined
            };
        });

        const response: McpStatusResponse = {
            servers,
            totalTools: Object.keys(mcpTools).length,
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
