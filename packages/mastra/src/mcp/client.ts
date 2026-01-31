import { MCPClient } from "@mastra/mcp";

declare global {
    var mcpClient: MCPClient | undefined;
}

/**
 * MCP Client Configuration
 *
 * Connects to external MCP servers to provide additional tools.
 * Currently configured:
 * - Wikipedia: Search and retrieve Wikipedia articles
 * - Sequential Thinking: Break down complex reasoning
 */
function getMcpClient(): MCPClient {
    if (!global.mcpClient) {
        global.mcpClient = new MCPClient({
            id: "mastra-mcp-client",
            servers: {
                // Wikipedia MCP Server - Free, no API key required
                wikipedia: {
                    command: "npx",
                    args: ["-y", "wikipedia-mcp"]
                },

                // Sequential Thinking MCP Server (via Smithery)
                sequentialThinking: {
                    command: "npx",
                    args: [
                        "-y",
                        "@smithery/cli@latest",
                        "run",
                        "@smithery-ai/server-sequential-thinking",
                        "--config",
                        "{}"
                    ]
                }
            },
            timeout: 60000 // 60 second timeout
        });
    }

    return global.mcpClient;
}

export const mcpClient = getMcpClient();

/**
 * Get all available MCP tools
 * Use this when configuring an agent with static tools
 */
export async function getMcpTools() {
    return await mcpClient.listTools();
}

/**
 * Get MCP toolsets for dynamic per-request configuration
 * Use this when tools need to vary by request (e.g., different API keys per user)
 */
export async function getMcpToolsets() {
    return await mcpClient.listToolsets();
}

/**
 * Disconnect MCP client
 * Call when shutting down the application
 */
export async function disconnectMcp() {
    await mcpClient.disconnect();
}
