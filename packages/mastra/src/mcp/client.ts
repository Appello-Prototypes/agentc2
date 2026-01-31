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
        id: "wikipedia",
        name: "Wikipedia",
        description: "Search and retrieve Wikipedia articles for factual information",
        category: "knowledge",
        requiresAuth: false
    },
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
        id: "fathom",
        name: "Fathom",
        description: "Meeting intelligence - transcripts, summaries, and action items",
        category: "productivity",
        requiresAuth: true,
        envVars: ["FATHOM_API_KEY"]
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
        requiresAuth: false,
        envVars: ["ATLAS_N8N_SSE_URL"]
    }
];

/**
 * MCP Client Configuration
 *
 * Connects to external MCP servers to provide additional tools.
 * Note: Sequential Thinking server removed due to Smithery auth redirect issues.
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

                // Playwright MCP Server - Browser automation, no API key required
                playwright: {
                    command: "npx",
                    args: ["-y", "@playwright/mcp@latest"]
                },

                // Firecrawl MCP Server - Web scraping and crawling
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

                // ATLAS MCP Server - Custom n8n workflow tools via SSE
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
                    : {}),

                // Hubspot MCP Server - CRM integration
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

                // Fathom MCP Server - Meeting transcripts and summaries
                ...(process.env.FATHOM_API_KEY && process.env.FATHOM_MCP_PATH
                    ? {
                          fathom: {
                              command: "node",
                              args: [process.env.FATHOM_MCP_PATH],
                              env: {
                                  FATHOM_API_KEY: process.env.FATHOM_API_KEY
                              }
                          }
                      }
                    : {}),

                // JustCall MCP Server - Phone/SMS communication via SSE
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

                // Jira MCP Server - Project management and issue tracking
                ...(process.env.JIRA_API_TOKEN && process.env.JIRA_MCP_PATH
                    ? {
                          jira: {
                              command: "node",
                              args: [process.env.JIRA_MCP_PATH],
                              env: {
                                  JIRA_URL: process.env.JIRA_URL || "",
                                  JIRA_USERNAME: process.env.JIRA_USERNAME || "",
                                  JIRA_API_TOKEN: process.env.JIRA_API_TOKEN,
                                  JIRA_PROJECTS_FILTER: process.env.JIRA_PROJECTS_FILTER || ""
                              }
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
