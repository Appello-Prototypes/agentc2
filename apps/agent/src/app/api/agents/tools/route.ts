import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
    listAvailableTools,
    getAvailableModels,
    listAvailableScorers,
    listMcpToolDefinitions
} from "@repo/mastra";
import { auth } from "@repo/auth";
import { getUserOrganizationId } from "@/lib/organization";

/**
 * GET /api/agents/tools
 *
 * List all available tools, models, and scorers for agent configuration
 * Includes both static tools from the registry and dynamic MCP tools
 */
export async function GET() {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });
        const organizationId = session?.user ? await getUserOrganizationId(session.user.id) : null;

        // Get static tools from registry
        const staticTools = listAvailableTools();

        // Get MCP tools (dynamic, from connected MCP servers)
        let mcpTools: { id: string; name: string; description: string; source: string }[] = [];
        try {
            const mcpDefinitions = await listMcpToolDefinitions(organizationId);
            mcpTools = mcpDefinitions.map((def) => ({
                id: def.name, // Full namespaced name: serverName_toolName
                name: def.name,
                description: def.description,
                source: `mcp:${def.server}`
            }));
        } catch (mcpError) {
            // MCP tools are optional - log but don't fail
            console.warn("[Agents Tools] MCP tools not available:", mcpError);
        }

        // Combine all tools, marking source for UI differentiation
        const allTools = [...staticTools.map((t) => ({ ...t, source: "registry" })), ...mcpTools];

        const models = getAvailableModels();
        const scorers = listAvailableScorers();

        return NextResponse.json({
            success: true,
            tools: allTools,
            models,
            scorers
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
