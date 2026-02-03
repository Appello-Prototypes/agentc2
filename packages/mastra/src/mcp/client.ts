import { MCPClient } from "@mastra/mcp";

declare global {
    var mcpClient: MCPClient | undefined;
}

/**
 * MCP Server Configuration
 *
 * Defines all available MCP servers and their metadata.
 * This is the single source of truth for server configuration.
 */
export interface McpServerConfig {
    id: string;
    name: string;
    description: string;
    category: "knowledge" | "web" | "crm" | "productivity" | "communication" | "automation";
    requiresAuth: boolean;
    envVars?: string[];
}

export const MCP_SERVER_CONFIGS: McpServerConfig[] = [
    {
        id: "playwright",
        name: "Playwright",
        description: "Browser automation - navigate, click, screenshot, interact with web pages",
        category: "web",
        requiresAuth: false
    },
    {
        id: "firecrawl",
        name: "Firecrawl",
        description: "Web scraping and crawling - extract data from websites",
        category: "web",
        requiresAuth: true,
        envVars: ["FIRECRAWL_API_KEY"]
    },
    {
        id: "hubspot",
        name: "HubSpot",
        description: "CRM integration - contacts, companies, deals, and pipeline",
        category: "crm",
        requiresAuth: true,
        envVars: ["HUBSPOT_ACCESS_TOKEN"]
    },
    {
        id: "jira",
        name: "Jira",
        description: "Project management - issues, sprints, and project tracking",
        category: "productivity",
        requiresAuth: true,
        envVars: ["JIRA_URL", "JIRA_USERNAME", "JIRA_API_TOKEN"]
    },
    {
        id: "justcall",
        name: "JustCall",
        description: "Phone and SMS communication - call logs and messaging",
        category: "communication",
        requiresAuth: true,
        envVars: ["JUSTCALL_AUTH_TOKEN"]
    },
    {
        id: "atlas",
        name: "ATLAS",
        description: "Custom n8n workflow automation and business processes",
        category: "automation",
        requiresAuth: true,
        envVars: ["ATLAS_N8N_SSE_URL"]
    }
];

/**
 * MCP Client Configuration
 *
 * Connects to external MCP servers to provide additional tools.
 * All servers use npx for easy installation without local dependencies.
 */
function getMcpClient(): MCPClient {
    if (!global.mcpClient) {
        global.mcpClient = new MCPClient({
            id: "mastra-mcp-client",
            servers: {
                // Playwright MCP Server - Browser automation, no API key required
                // https://www.npmjs.com/package/@playwright/mcp
                playwright: {
                    command: "npx",
                    args: ["-y", "@playwright/mcp@latest"]
                },

                // Firecrawl MCP Server - Web scraping and crawling
                // https://www.npmjs.com/package/firecrawl-mcp
                ...(process.env.FIRECRAWL_API_KEY
                    ? {
                          firecrawl: {
                              command: "npx",
                              args: ["-y", "firecrawl-mcp"],
                              env: {
                                  FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY
                              }
                          }
                      }
                    : {}),

                // HubSpot MCP Server - CRM integration
                // https://www.npmjs.com/package/@hubspot/mcp-server
                ...(process.env.HUBSPOT_ACCESS_TOKEN
                    ? {
                          hubspot: {
                              command: "npx",
                              args: ["-y", "@hubspot/mcp-server"],
                              env: {
                                  PRIVATE_APP_ACCESS_TOKEN: process.env.HUBSPOT_ACCESS_TOKEN
                              }
                          }
                      }
                    : {}),

                // Jira MCP Server - Project management and issue tracking
                // Uses mcp-atlassian (Python) via uvx for better API compatibility
                // https://github.com/sooperset/mcp-atlassian
                ...(process.env.JIRA_API_TOKEN && process.env.JIRA_URL && process.env.JIRA_USERNAME
                    ? {
                          jira: {
                              command: "uvx",
                              args: ["mcp-atlassian"],
                              env: {
                                  JIRA_URL: process.env.JIRA_URL,
                                  JIRA_USERNAME: process.env.JIRA_USERNAME,
                                  JIRA_API_TOKEN: process.env.JIRA_API_TOKEN,
                                  ...(process.env.JIRA_PROJECTS_FILTER
                                      ? { JIRA_PROJECTS_FILTER: process.env.JIRA_PROJECTS_FILTER }
                                      : {})
                              }
                          }
                      }
                    : {}),

                // JustCall MCP Server - Phone/SMS communication via HTTP/SSE
                // https://mcp.justcall.host
                ...(process.env.JUSTCALL_AUTH_TOKEN
                    ? {
                          justcall: {
                              url: new URL("https://mcp.justcall.host/mcp"),
                              requestInit: {
                                  headers: {
                                      Authorization: `Bearer ${process.env.JUSTCALL_AUTH_TOKEN}`
                                  }
                              }
                          }
                      }
                    : {}),

                // ATLAS MCP Server - Custom n8n workflow tools via SSE
                // Uses supergateway to connect to n8n SSE endpoint
                ...(process.env.ATLAS_N8N_SSE_URL
                    ? {
                          atlas: {
                              command: "npx",
                              args: [
                                  "-y",
                                  "supergateway",
                                  "--sse",
                                  process.env.ATLAS_N8N_SSE_URL,
                                  "--timeout",
                                  "600000",
                                  "--keep-alive-timeout",
                                  "600000",
                                  "--retry-after-disconnect",
                                  "--reconnect-interval",
                                  "1000"
                              ]
                          }
                      }
                    : {})
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

/**
 * Tool execution result
 */
export interface McpToolExecutionResult {
    success: boolean;
    toolName: string;
    result?: unknown;
    error?: string;
}

/**
 * Tool definition for external use (e.g., ElevenLabs webhook configuration)
 */
export interface McpToolDefinition {
    name: string;
    description: string;
    server: string;
    parameters: Record<string, unknown>;
}

/**
 * Execute an MCP tool directly by name
 *
 * Tool names can be in either format:
 * - Underscore: "serverName_toolName" (e.g., "hubspot_hubspot-get-user-details")
 * - Dot: "serverName.toolName" (e.g., "hubspot.hubspot-get-user-details")
 *
 * Use listMcpToolDefinitions() to get available tool names.
 *
 * @param toolName - The namespaced tool name
 * @param parameters - The parameters to pass to the tool
 * @returns The result of the tool execution
 */
export async function executeMcpTool(
    toolName: string,
    parameters: Record<string, unknown>
): Promise<McpToolExecutionResult> {
    try {
        const toolsets = await mcpClient.listToolsets();

        // Try multiple name formats to find the tool
        // listToolsets() uses dot notation: serverName.toolName
        // listTools() uses underscore: serverName_toolName
        const namesToTry = [
            toolName,
            toolName.replace("_", "."), // Convert underscore to dot (first occurrence only for server name)
            toolName.replace(".", "_") // Convert dot to underscore
        ];

        // For tools like "hubspot_hubspot-get-user-details", convert to "hubspot.hubspot-get-user-details"
        const parts = toolName.split("_");
        if (parts.length >= 2) {
            const serverName = parts[0];
            const restOfName = parts.slice(1).join("_");
            namesToTry.push(`${serverName}.${restOfName}`);
        }

        let tool = null;
        let matchedName = toolName;

        for (const name of namesToTry) {
            if (toolsets[name]) {
                tool = toolsets[name];
                matchedName = name;
                break;
            }
        }

        if (!tool) {
            const availableTools = Object.keys(toolsets).slice(0, 10).join(", ");
            return {
                success: false,
                toolName,
                error: `Tool not found: ${toolName}. First 10 available: ${availableTools}...`
            };
        }

        // Execute the tool - toolsets return Tool objects that are callable
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (tool as any).execute({ context: parameters });

        return {
            success: true,
            toolName: matchedName,
            result
        };
    } catch (error) {
        return {
            success: false,
            toolName,
            error: error instanceof Error ? error.message : "Unknown error executing tool"
        };
    }
}

/**
 * List all available MCP tool definitions
 *
 * Returns tool metadata suitable for configuring external systems
 * like ElevenLabs webhook tools.
 */
export async function listMcpToolDefinitions(): Promise<McpToolDefinition[]> {
    const tools = await mcpClient.listTools();
    const definitions: McpToolDefinition[] = [];

    for (const [name, tool] of Object.entries(tools)) {
        // Parse server name from tool name (format: serverName_toolName)
        const parts = name.split("_");
        const serverName = parts[0];
        const toolName = parts.slice(1).join("_");

        // Type assertion for tool properties
        const toolDef = tool as {
            description?: string;
            inputSchema?: { shape?: Record<string, unknown> };
        };

        definitions.push({
            name,
            description: toolDef.description || `Tool: ${toolName}`,
            server: serverName,
            parameters: toolDef.inputSchema?.shape || {}
        });
    }

    return definitions;
}
