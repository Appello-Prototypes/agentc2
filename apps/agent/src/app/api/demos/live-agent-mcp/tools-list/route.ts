import { NextResponse } from "next/server";
import { listMcpToolDefinitions } from "@repo/mastra/mcp";

/**
 * GET /api/demos/live-agent-mcp/tools-list
 *
 * Lists all available MCP tools grouped by server.
 */
export async function GET() {
    try {
        // Get all tool definitions
        const { definitions: tools } = await listMcpToolDefinitions();

        // Group tools by server (extract server from tool name prefix)
        const toolsByServer: Record<
            string,
            Array<{
                name: string;
                description: string;
                parameters?: Record<string, unknown>;
            }>
        > = {};

        for (const tool of tools) {
            // Tool names are formatted as "server_toolName" or "server-toolName"
            const parts = tool.name.split(/[_-]/);
            const server = parts[0] || "unknown";

            if (!toolsByServer[server]) {
                toolsByServer[server] = [];
            }

            toolsByServer[server].push({
                name: tool.name,
                description: tool.description || "",
                parameters: tool.parameters as Record<string, unknown>
            });
        }

        // Get server info
        const servers = Object.keys(toolsByServer).map((server) => ({
            name: server,
            toolCount: toolsByServer[server].length,
            tools: toolsByServer[server]
        }));

        return NextResponse.json({
            success: true,
            totalTools: tools.length,
            serverCount: servers.length,
            servers
        });
    } catch (error) {
        console.error("[Tools List] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list tools"
            },
            { status: 500 }
        );
    }
}
