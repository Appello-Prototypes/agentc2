import { MCPClient } from "@mastra/mcp";
import { apiClientRegistry, getApiClient } from "./api-clients";
import type {
    McpServerConfig,
    ToolResult,
    ToolExecutionContext,
    UnifiedToolDefinition,
    ServerConnectionStatus
} from "./types";

declare global {
    var mcpClient: MCPClient | undefined;
    var mcpClientMode: "mcp" | "api" | "hybrid" | undefined;
}

/**
 * Detect if running in a serverless environment (Vercel, AWS Lambda, etc.)
 * Serverless environments cannot spawn and maintain child processes for stdio-based MCP servers.
 */
export function isServerlessEnvironment(): boolean {
    return !!(
        process.env.VERCEL === "1" ||
        process.env.VERCEL ||
        process.env.AWS_LAMBDA_FUNCTION_NAME ||
        process.env.NETLIFY ||
        process.env.FUNCTION_TARGET || // Google Cloud Functions
        process.env.FUNCTIONS_WORKER_RUNTIME // Azure Functions
    );
}

/**
 * MCP Server Configuration
 *
 * Defines all available MCP servers and their metadata.
 * This is the single source of truth for server configuration.
 */
export const MCP_SERVER_CONFIGS: McpServerConfig[] = [
    {
        id: "playwright",
        name: "Playwright",
        description: "Browser automation - navigate, click, screenshot, interact with web pages",
        category: "web",
        requiresAuth: false,
        transport: "stdio",
        hasApiFallback: true // Limited fallback via Browserless.io
    },
    {
        id: "firecrawl",
        name: "Firecrawl",
        description: "Web scraping and crawling - extract data from websites",
        category: "web",
        requiresAuth: true,
        envVars: ["FIRECRAWL_API_KEY"],
        transport: "stdio",
        hasApiFallback: true
    },
    {
        id: "hubspot",
        name: "HubSpot",
        description: "CRM integration - contacts, companies, deals, and pipeline",
        category: "crm",
        requiresAuth: true,
        envVars: ["HUBSPOT_ACCESS_TOKEN"],
        transport: "stdio",
        hasApiFallback: true
    },
    {
        id: "jira",
        name: "Jira",
        description: "Project management - issues, sprints, and project tracking",
        category: "productivity",
        requiresAuth: true,
        envVars: ["JIRA_URL", "JIRA_USERNAME", "JIRA_API_TOKEN"],
        transport: "stdio",
        hasApiFallback: true
    },
    {
        id: "justcall",
        name: "JustCall",
        description: "Phone and SMS communication - call logs and messaging",
        category: "communication",
        requiresAuth: true,
        envVars: ["JUSTCALL_AUTH_TOKEN"],
        transport: "http",
        hasApiFallback: false // Already uses HTTP, no fallback needed
    },
    {
        id: "atlas",
        name: "ATLAS",
        description: "Custom n8n workflow automation and business processes",
        category: "automation",
        requiresAuth: true,
        envVars: ["ATLAS_N8N_SSE_URL"],
        transport: "stdio",
        hasApiFallback: true
    }
];

/**
 * MCP Client Configuration - Dual Mode Architecture
 *
 * Local Development: Uses stdio-based MCP servers via npx
 * Production/Serverless: Uses direct API calls to underlying services
 *
 * The system automatically detects the environment and uses the appropriate mode.
 */
function getMcpClient(): MCPClient {
    if (!global.mcpClient) {
        const isServerless = isServerlessEnvironment();

        // In serverless, we still create a minimal MCP client for HTTP-based servers
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const servers: Record<string, any> = {};

        // JustCall MCP Server - Phone/SMS communication via HTTP/SSE
        // Works in both local and serverless environments
        if (process.env.JUSTCALL_AUTH_TOKEN) {
            servers.justcall = {
                url: new URL("https://mcp.justcall.host/mcp"),
                requestInit: {
                    headers: {
                        Authorization: `Bearer ${process.env.JUSTCALL_AUTH_TOKEN}`
                    }
                }
            };
        }

        // Stdio-based servers only work in non-serverless environments
        if (!isServerless) {
            // Playwright MCP Server - Browser automation
            servers.playwright = {
                command: "npx",
                args: ["-y", "@playwright/mcp@latest"]
            };

            // Firecrawl MCP Server - Web scraping
            if (process.env.FIRECRAWL_API_KEY) {
                servers.firecrawl = {
                    command: "npx",
                    args: ["-y", "firecrawl-mcp"],
                    env: {
                        FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY
                    }
                };
            }

            // HubSpot MCP Server - CRM integration
            if (process.env.HUBSPOT_ACCESS_TOKEN) {
                servers.hubspot = {
                    command: "npx",
                    args: ["-y", "@hubspot/mcp-server"],
                    env: {
                        PRIVATE_APP_ACCESS_TOKEN: process.env.HUBSPOT_ACCESS_TOKEN
                    }
                };
            }

            // Jira MCP Server - Project management
            if (process.env.JIRA_API_TOKEN && process.env.JIRA_URL && process.env.JIRA_USERNAME) {
                servers.jira = {
                    command: "npx",
                    args: [
                        "-y",
                        "@timbreeding/jira-mcp-server@latest",
                        `--jira-base-url=${process.env.JIRA_URL}`,
                        `--jira-username=${process.env.JIRA_USERNAME}`,
                        `--jira-api-token=${process.env.JIRA_API_TOKEN}`
                    ]
                };
            }

            // ATLAS MCP Server - n8n workflows
            if (process.env.ATLAS_N8N_SSE_URL) {
                servers.atlas = {
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
                };
            }
        }

        // Set the mode for status reporting
        global.mcpClientMode = isServerless ? "api" : "mcp";

        global.mcpClient = new MCPClient({
            id: "mastra-mcp-client",
            servers,
            timeout: 60000
        });
    }

    return global.mcpClient;
}

export const mcpClient = getMcpClient();

/**
 * Get the current MCP client mode
 */
export function getMcpMode(): "mcp" | "api" | "hybrid" {
    return global.mcpClientMode || (isServerlessEnvironment() ? "api" : "mcp");
}

/**
 * Normalize a tool's input schema to ensure it has required fields
 * Mastra's Agent class requires inputSchema.type and custom.input_schema.type to be present
 * The error "tools.N.custom.input_schema.type: Field required" comes from Anthropic's API
 * when a tool schema is missing the required 'type' field
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeToolSchema(tool: any): any {
    if (!tool) return tool;
    
    // Ensure inputSchema exists and has a type
    if (tool.inputSchema) {
        if (!tool.inputSchema.type) {
            tool.inputSchema.type = "object";
        }
        // Ensure properties exists
        if (!tool.inputSchema.properties) {
            tool.inputSchema.properties = {};
        }
    } else if (tool.parameters) {
        // If using parameters instead of inputSchema, create inputSchema
        tool.inputSchema = {
            type: "object",
            properties: tool.parameters,
            required: []
        };
    } else {
        // No schema at all, create a minimal one
        tool.inputSchema = {
            type: "object",
            properties: {},
            required: []
        };
    }
    
    // Also check custom.input_schema (used by Mastra when sending to AI providers)
    if (tool.custom) {
        if (tool.custom.input_schema) {
            if (!tool.custom.input_schema.type) {
                tool.custom.input_schema.type = "object";
            }
            if (!tool.custom.input_schema.properties) {
                tool.custom.input_schema.properties = {};
            }
        } else {
            // Create custom.input_schema from inputSchema
            tool.custom.input_schema = {
                type: "object",
                properties: tool.inputSchema?.properties || {},
                required: tool.inputSchema?.required || []
            };
        }
    }
    
    return tool;
}

/**
 * Get all available MCP tools - unified interface
 *
 * In local mode: Returns tools from MCP servers
 * In serverless mode: Returns tools from API clients (wrapped as executable tools)
 * In hybrid mode: Returns both
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getMcpTools(): Promise<Record<string, any>> {
    const isServerless = isServerlessEnvironment();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools: Record<string, any> = {};

    // Try to get MCP tools (works in local, may partially work in serverless for HTTP servers)
    try {
        const mcpTools = await mcpClient.listTools();
        // Normalize each tool's schema to ensure required fields are present
        for (const [name, tool] of Object.entries(mcpTools)) {
            tools[name] = normalizeToolSchema(tool);
        }
    } catch (error) {
        // In serverless, MCP tools may not be available - that's expected
        if (!isServerless) {
            console.warn("Failed to get MCP tools:", error);
        }
    }

    // In serverless mode, add tools from API clients as executable wrappers
    if (isServerless) {
        for (const [serverId, client] of Object.entries(apiClientRegistry)) {
            if (client.isConfigured()) {
                try {
                    const apiTools = await client.listTools();
                    for (const tool of apiTools) {
                        // Create an executable tool wrapper that matches MCP tool structure
                        // Tool names from API clients may already have server prefix (e.g., "jira-search-issues")
                        // Normalize to underscore format: "jira_search_issues"
                        let toolName: string;
                        if (
                            tool.name.startsWith(`${serverId}-`) ||
                            tool.name.startsWith(`${serverId}_`)
                        ) {
                            // Already has prefix, just normalize hyphens to underscores
                            toolName = tool.name.replace(/-/g, "_");
                        } else {
                            // Add server prefix
                            toolName = `${serverId}_${tool.name.replace(/-/g, "_")}`;
                        }

                        tools[toolName] = {
                            description: tool.description,
                            parameters: tool.parameters,
                            // Ensure inputSchema is present with required type field
                            inputSchema: {
                                type: "object",
                                properties: tool.parameters || {},
                                required: []
                            },
                            // Create an execute function that calls the API client
                            execute: async (params: { context: ToolExecutionContext }) => {
                                const result = await client.executeTool(tool.name, params.context);
                                return result.data;
                            },
                            _apiClient: true,
                            _serverId: serverId
                        };
                    }
                } catch (error) {
                    console.warn(`Failed to get API tools for ${serverId}:`, error);
                }
            }
        }
    }

    return tools;
}

/**
 * Get MCP toolsets for dynamic per-request configuration
 */
export async function getMcpToolsets() {
    return await mcpClient.listToolsets();
}

/**
 * Disconnect MCP client
 */
export async function disconnectMcp() {
    await mcpClient.disconnect();
}

/**
 * Tool execution result - re-exported from types
 */
export type { ToolResult as McpToolExecutionResult } from "./types";

/**
 * Tool definition for external use
 */
export interface McpToolDefinition {
    name: string;
    description: string;
    server: string;
    parameters: Record<string, unknown>;
    usingApi?: boolean;
}

/**
 * Execute an MCP tool directly by name - with automatic API fallback
 *
 * In local mode: Uses MCP server
 * In serverless mode: Uses API client fallback
 *
 * Tool names can be in formats:
 * - Normalized: "jira_search_issues" (underscores, single prefix)
 * - MCP style: "jira.jira-search-issues" or "jira_jira-search-issues"
 */
export async function executeMcpTool(
    toolName: string,
    parameters: Record<string, unknown>
): Promise<ToolResult> {
    const startTime = Date.now();
    const isServerless = isServerlessEnvironment();

    // Parse server ID from tool name (first segment before _ or .)
    const parts = toolName.split(/[_.]/, 2);
    const serverId = parts[0];

    // Extract the tool name part after the server prefix
    let actualToolName = toolName.includes("_")
        ? toolName.substring(toolName.indexOf("_") + 1)
        : toolName.includes(".")
          ? toolName.substring(toolName.indexOf(".") + 1)
          : toolName;

    // Convert underscores back to hyphens for API client format
    // e.g., "search_issues" -> "search-issues", then prepend server ID if needed
    // API clients expect names like "jira-search-issues", "hubspot-get-contacts"
    const hyphenatedToolName = actualToolName.replace(/_/g, "-");
    const apiToolName = hyphenatedToolName.startsWith(`${serverId}-`)
        ? hyphenatedToolName
        : `${serverId}-${hyphenatedToolName}`;

    // In serverless mode, try API client first
    if (isServerless) {
        const apiClient = getApiClient(serverId);
        if (apiClient?.isConfigured()) {
            try {
                // Try the hyphenated format first (e.g., "jira-search-issues")
                const result = await apiClient.executeTool(apiToolName, parameters);
                return result;
            } catch (error) {
                // If that fails, try the original format
                try {
                    const fallbackResult = await apiClient.executeTool(actualToolName, parameters);
                    return fallbackResult;
                } catch {
                    return {
                        success: false,
                        error: error instanceof Error ? error.message : "Unknown API error",
                        metadata: {
                            mode: "api",
                            executionTime: Date.now() - startTime,
                            serverId
                        }
                    };
                }
            }
        }
    }

    // Try MCP transport (works in local, may work for HTTP servers in serverless)
    try {
        const toolsets = await mcpClient.listToolsets();

        // Try multiple name formats
        const namesToTry = [
            toolName,
            toolName.replace("_", "."),
            toolName.replace(".", "_"),
            `${serverId}.${actualToolName}`
        ];

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
            // In serverless, if MCP fails, try API fallback
            if (isServerless) {
                const apiClient = getApiClient(serverId);
                if (apiClient) {
                    return {
                        success: false,
                        error: `Tool not found via MCP or API: ${toolName}. API client configured: ${apiClient.isConfigured()}`,
                        metadata: {
                            mode: "api",
                            executionTime: Date.now() - startTime,
                            serverId
                        }
                    };
                }
            }

            const availableTools = Object.keys(toolsets).slice(0, 10).join(", ");
            return {
                success: false,
                error: `Tool not found: ${toolName}. First 10 available: ${availableTools}...`,
                metadata: {
                    mode: "mcp",
                    executionTime: Date.now() - startTime,
                    serverId
                }
            };
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (tool as any).execute({ context: parameters });

        return {
            success: true,
            data: result,
            metadata: {
                mode: "mcp",
                executionTime: Date.now() - startTime,
                serverId
            }
        };
    } catch (error) {
        // If MCP fails in serverless, try API fallback
        if (isServerless) {
            const apiClient = getApiClient(serverId);
            if (apiClient?.isConfigured()) {
                try {
                    return await apiClient.executeTool(actualToolName, parameters);
                } catch {
                    // Both failed
                }
            }
        }

        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error executing tool",
            metadata: {
                mode: "mcp",
                executionTime: Date.now() - startTime,
                serverId
            }
        };
    }
}

/**
 * List all available MCP tool definitions - unified interface
 */
export async function listMcpToolDefinitions(): Promise<McpToolDefinition[]> {
    const tools = await getMcpTools();
    const definitions: McpToolDefinition[] = [];
    const isServerless = isServerlessEnvironment();

    for (const [name, tool] of Object.entries(tools)) {
        const parts = name.split("_");
        const serverName = parts[0];
        const toolName = parts.slice(1).join("_");

        const toolDef = tool as {
            description?: string;
            inputSchema?: { shape?: Record<string, unknown> };
            parameters?: Record<string, unknown>;
            _apiClient?: boolean;
        };

        definitions.push({
            name,
            description: toolDef.description || `Tool: ${toolName}`,
            server: serverName,
            parameters: toolDef.inputSchema?.shape || toolDef.parameters || {},
            usingApi: isServerless && toolDef._apiClient
        });
    }

    return definitions;
}

/**
 * Get detailed status for all MCP servers
 */
export async function getMcpServerStatus(): Promise<ServerConnectionStatus[]> {
    const isServerless = isServerlessEnvironment();
    const statuses: ServerConnectionStatus[] = [];

    // Get MCP tools if available
    let mcpTools: Record<string, unknown> = {};
    try {
        mcpTools = await mcpClient.listTools();
    } catch {
        // Expected in serverless for stdio servers
    }

    for (const config of MCP_SERVER_CONFIGS) {
        // Check env vars
        const missingEnvVars = config.envVars?.filter((v) => !process.env[v]) || [];
        const envConfigured = missingEnvVars.length === 0;

        // Check if MCP is connected (has tools)
        const mcpToolCount = Object.keys(mcpTools).filter((t) =>
            t.startsWith(`${config.id}_`)
        ).length;
        const mcpConnected = mcpToolCount > 0;

        // Check if API client is available
        const apiClient = getApiClient(config.id);
        const apiConfigured = apiClient?.isConfigured() || false;
        let apiToolCount = 0;
        if (apiConfigured && isServerless) {
            try {
                const apiTools = await apiClient!.listTools();
                apiToolCount = apiTools.length;
            } catch {
                // API client failed
            }
        }

        // Determine status
        let connected = false;
        let available = false;
        let usingApi = false;
        let error: string | undefined;

        if (!envConfigured && config.requiresAuth) {
            error = `Missing environment variables: ${missingEnvVars.join(", ")}`;
        } else if (isServerless && config.transport === "stdio") {
            // Serverless with stdio server
            if (apiConfigured && apiToolCount > 0) {
                available = true;
                usingApi = true;
            } else if (config.hasApiFallback) {
                error = "API fallback available but not configured. Check environment variables.";
            } else {
                error = "Stdio transport not available in serverless. No API fallback configured.";
            }
        } else if (mcpConnected) {
            connected = true;
            available = true;
        } else if (config.transport === "http" && envConfigured) {
            // HTTP server should connect
            error = "HTTP server configured but not connected";
        }

        statuses.push({
            id: config.id,
            name: config.name,
            description: config.description,
            category: config.category,
            connected,
            available,
            usingApi,
            serverless: isServerless,
            toolCount: usingApi ? apiToolCount : mcpToolCount,
            error,
            requiredEnvVars: config.envVars,
            missingEnvVars: missingEnvVars.length > 0 ? missingEnvVars : undefined
        });
    }

    return statuses;
}

// Re-export types
export type { McpServerConfig, UnifiedToolDefinition, ServerConnectionStatus } from "./types";
