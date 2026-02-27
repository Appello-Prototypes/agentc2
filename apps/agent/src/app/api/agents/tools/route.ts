import { NextRequest, NextResponse } from "next/server";
import { getAvailableModelsAsync } from "@repo/agentc2/agents";
import { listMcpToolDefinitions } from "@repo/agentc2/mcp";
import { listAvailableTools, toolCategoryOrder } from "@repo/agentc2/tools";

import { authenticateRequest } from "@/lib/api-auth";

/**
 * GET /api/agents/tools
 *
 * List all available tools, models, and scorers for agent configuration
 * Includes both static tools from the registry and dynamic MCP tools.
 * Uses the same auth context as Integrations (authenticateRequest) so
 * org- and user-scoped MCP connections are included when listing tools.
 */
export async function GET(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);

        // Same org + user context as Integrations API so MCP connections match
        const mcpOptions = authContext
            ? { organizationId: authContext.organizationId, userId: authContext.userId }
            : null;

        // Get static tools from registry
        const staticTools = listAvailableTools();

        // Get MCP tools (dynamic, from org/user integration connections or global env)
        // Per-server isolation: one failing server does not block the rest
        let mcpTools: { id: string; name: string; description: string; source: string }[] = [];
        let mcpError: string | null = null;
        let serverErrors: Record<string, string> = {};
        const mcpServerStatus: Record<string, { connected: boolean; toolCount: number }> = {};
        try {
            const result = await listMcpToolDefinitions(mcpOptions);
            const mcpDefinitions = result.definitions;
            serverErrors = result.serverErrors;

            mcpTools = mcpDefinitions.map((def) => ({
                id: def.name, // Full namespaced name: serverName_toolName
                name: def.name,
                description: def.description,
                source: `mcp:${def.server}`
            }));

            // Build per-server status from successfully loaded tools
            for (const def of mcpDefinitions) {
                if (!mcpServerStatus[def.server]) {
                    mcpServerStatus[def.server] = { connected: true, toolCount: 0 };
                }
                mcpServerStatus[def.server]!.toolCount++;
            }

            // Mark errored servers as disconnected
            for (const serverId of Object.keys(serverErrors)) {
                if (!mcpServerStatus[serverId]) {
                    mcpServerStatus[serverId] = { connected: false, toolCount: 0 };
                }
            }

            // Surface a summary mcpError if any servers failed
            const errorCount = Object.keys(serverErrors).length;
            if (errorCount > 0) {
                mcpError = `${errorCount} MCP server(s) failed to load`;
            }
        } catch (err) {
            // MCP tools are optional - log but don't fail
            mcpError = err instanceof Error ? err.message : "MCP tools not available";
            console.warn("[Agents Tools] MCP tools not available:", err);
        }

        // Combine all tools, marking source for UI differentiation
        const allTools = [...staticTools.map((t) => ({ ...t, source: "registry" })), ...mcpTools];

        const models = await getAvailableModelsAsync(authContext?.organizationId ?? null);

        return NextResponse.json({
            success: true,
            tools: allTools,
            models,
            mcpServerStatus,
            mcpError,
            serverErrors,
            hasOrgContext: !!authContext,
            toolCategoryOrder
        });
    } catch (error) {
        console.error("[Agents Tools] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list tools"
            },
            { status: 500 }
        );
    }
}
