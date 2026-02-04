import { MCPClient, type MastraMCPServerDefinition } from "@mastra/mcp";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { prisma } from "@repo/database";

declare global {
    var mcpClient: MCPClient | undefined;
}

const ORG_MCP_CACHE_TTL = 60000;
const orgMcpClients = new Map<string, { client: MCPClient; loadedAt: number }>();

function getCredentialValue(
    credentials: Record<string, unknown> | undefined,
    keys: string[]
): string | undefined {
    if (!credentials) return undefined;
    for (const key of keys) {
        const value = credentials[key];
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }
    return undefined;
}

function buildServerConfigs(options: {
    credentialsByToolId: Map<string, Record<string, unknown>>;
    allowEnvFallback?: boolean;
}): Record<string, MastraMCPServerDefinition> {
    const { credentialsByToolId, allowEnvFallback = false } = options;
    const servers: Record<string, MastraMCPServerDefinition> = {
        playwright: {
            command: "npx",
            args: ["-y", "@playwright/mcp@latest"]
        }
    };

    const firecrawlKey =
        getCredentialValue(credentialsByToolId.get("firecrawl"), ["FIRECRAWL_API_KEY"]) ||
        (allowEnvFallback ? process.env.FIRECRAWL_API_KEY : undefined);
    if (firecrawlKey) {
        servers.firecrawl = {
            command: "npx",
            args: ["-y", "firecrawl-mcp"],
            env: { FIRECRAWL_API_KEY: firecrawlKey }
        };
    }

    const hubspotToken =
        getCredentialValue(credentialsByToolId.get("hubspot"), [
            "PRIVATE_APP_ACCESS_TOKEN",
            "HUBSPOT_ACCESS_TOKEN"
        ]) || (allowEnvFallback ? process.env.HUBSPOT_ACCESS_TOKEN : undefined);
    if (hubspotToken) {
        servers.hubspot = {
            command: "npx",
            args: ["-y", "@hubspot/mcp-server"],
            env: { PRIVATE_APP_ACCESS_TOKEN: hubspotToken }
        };
    }

    const jiraUrl =
        getCredentialValue(credentialsByToolId.get("jira"), ["JIRA_URL"]) ||
        (allowEnvFallback ? process.env.JIRA_URL : undefined);
    const jiraUsername =
        getCredentialValue(credentialsByToolId.get("jira"), ["JIRA_USERNAME"]) ||
        (allowEnvFallback ? process.env.JIRA_USERNAME : undefined);
    const jiraToken =
        getCredentialValue(credentialsByToolId.get("jira"), ["JIRA_API_TOKEN"]) ||
        (allowEnvFallback ? process.env.JIRA_API_TOKEN : undefined);
    const jiraProjectsFilter =
        getCredentialValue(credentialsByToolId.get("jira"), ["JIRA_PROJECTS_FILTER"]) ||
        (allowEnvFallback ? process.env.JIRA_PROJECTS_FILTER : undefined);
    if (jiraUrl && jiraUsername && jiraToken) {
        servers.jira = {
            command: "uvx",
            args: ["mcp-atlassian"],
            env: {
                JIRA_URL: jiraUrl,
                JIRA_USERNAME: jiraUsername,
                JIRA_API_TOKEN: jiraToken,
                ...(jiraProjectsFilter ? { JIRA_PROJECTS_FILTER: jiraProjectsFilter } : {})
            }
        };
    }

    const justcallToken =
        getCredentialValue(credentialsByToolId.get("justcall"), ["JUSTCALL_AUTH_TOKEN"]) ||
        (allowEnvFallback ? process.env.JUSTCALL_AUTH_TOKEN : undefined);
    if (justcallToken) {
        servers.justcall = {
            url: new URL("https://mcp.justcall.host/mcp"),
            requestInit: {
                headers: { Authorization: `Bearer ${justcallToken}` }
            }
        };
    }

    const atlasUrl =
        getCredentialValue(credentialsByToolId.get("atlas"), ["ATLAS_N8N_SSE_URL"]) ||
        (allowEnvFallback ? process.env.ATLAS_N8N_SSE_URL : undefined);
    if (atlasUrl) {
        servers.atlas = {
            command: "npx",
            args: [
                "-y",
                "supergateway",
                "--sse",
                atlasUrl,
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

    const fathomKey =
        getCredentialValue(credentialsByToolId.get("fathom"), ["FATHOM_API_KEY"]) ||
        (allowEnvFallback ? process.env.FATHOM_API_KEY : undefined);
    if (fathomKey) {
        servers.fathom = {
            command: "node",
            args: [
                resolve(dirname(fileURLToPath(import.meta.url)), "../../../fathom-mcp/index.js")
            ],
            env: { FATHOM_API_KEY: fathomKey }
        };
    }

    const slackToken =
        getCredentialValue(credentialsByToolId.get("slack"), ["SLACK_BOT_TOKEN"]) ||
        (allowEnvFallback ? process.env.SLACK_BOT_TOKEN : undefined);
    const slackTeamId =
        getCredentialValue(credentialsByToolId.get("slack"), ["SLACK_TEAM_ID"]) ||
        (allowEnvFallback ? process.env.SLACK_TEAM_ID : undefined);
    if (slackToken && slackTeamId) {
        servers.slack = {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-slack"],
            env: { SLACK_BOT_TOKEN: slackToken, SLACK_TEAM_ID: slackTeamId }
        };
    }

    const gdriveCredentialsPath =
        getCredentialValue(credentialsByToolId.get("gdrive"), ["GDRIVE_CREDENTIALS_PATH"]) ||
        (allowEnvFallback ? process.env.GDRIVE_CREDENTIALS_PATH : undefined);
    const gdriveOauthPath =
        getCredentialValue(credentialsByToolId.get("gdrive"), ["GDRIVE_OAUTH_PATH"]) ||
        (allowEnvFallback ? process.env.GDRIVE_OAUTH_PATH : undefined);
    if (gdriveCredentialsPath) {
        servers.gdrive = {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-gdrive"],
            env: {
                GDRIVE_CREDENTIALS_PATH: gdriveCredentialsPath,
                ...(gdriveOauthPath ? { GDRIVE_OAUTH_PATH: gdriveOauthPath } : {})
            }
        };
    }

    const githubToken =
        getCredentialValue(credentialsByToolId.get("github"), ["GITHUB_PERSONAL_ACCESS_TOKEN"]) ||
        (allowEnvFallback ? process.env.GITHUB_PERSONAL_ACCESS_TOKEN : undefined);
    if (githubToken) {
        servers.github = {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-github"],
            env: { GITHUB_PERSONAL_ACCESS_TOKEN: githubToken }
        };
    }

    return servers;
}

/**
 * Sanitize JSON Schema to fix common issues that cause OpenAI model validation failures.
 *
 * Known issues fixed:
 * - Array properties missing "items" definition (e.g., HubSpot's search-objects tool)
 * - Empty object schemas
 *
 * @param schema - The JSON schema to sanitize
 * @returns Sanitized schema safe for all LLM providers
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeToolSchema(schema: any): any {
    if (!schema || typeof schema !== "object") {
        return schema;
    }

    // Handle arrays
    if (Array.isArray(schema)) {
        return schema.map(sanitizeToolSchema);
    }

    // Clone the schema to avoid mutations
    const result = { ...schema };

    // Fix: Array type missing items definition
    if (result.type === "array" && !result.items) {
        result.items = { type: "string" }; // Default to string array
    }

    // Recursively sanitize nested schemas
    if (result.properties && typeof result.properties === "object") {
        result.properties = Object.fromEntries(
            Object.entries(result.properties).map(([key, value]) => [
                key,
                sanitizeToolSchema(value)
            ])
        );
    }

    if (result.items && typeof result.items === "object") {
        result.items = sanitizeToolSchema(result.items);
    }

    if (result.additionalProperties && typeof result.additionalProperties === "object") {
        result.additionalProperties = sanitizeToolSchema(result.additionalProperties);
    }

    // Handle allOf, anyOf, oneOf
    for (const keyword of ["allOf", "anyOf", "oneOf"]) {
        if (Array.isArray(result[keyword])) {
            result[keyword] = result[keyword].map(sanitizeToolSchema);
        }
    }

    return result;
}

/**
 * Sanitize all tools returned from MCP to ensure schema compatibility with all LLM providers.
 *
 * @param tools - Record of tool name to tool instance
 * @returns Sanitized tools with fixed schemas
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeMcpTools(tools: Record<string, any>): Record<string, any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sanitized: Record<string, any> = {};

    for (const [name, tool] of Object.entries(tools)) {
        if (tool && typeof tool === "object") {
            // Clone the tool
            const sanitizedTool = { ...tool };

            // Sanitize inputSchema if present
            if (sanitizedTool.inputSchema) {
                sanitizedTool.inputSchema = sanitizeToolSchema(sanitizedTool.inputSchema);
            }

            // Also check for schema property (some tools use this)
            if (sanitizedTool.schema) {
                sanitizedTool.schema = sanitizeToolSchema(sanitizedTool.schema);
            }

            // Check for parameters (another common property name)
            if (sanitizedTool.parameters) {
                sanitizedTool.parameters = sanitizeToolSchema(sanitizedTool.parameters);
            }

            sanitized[name] = sanitizedTool;
        } else {
            sanitized[name] = tool;
        }
    }

    return sanitized;
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
    },
    {
        id: "fathom",
        name: "Fathom",
        description: "Meeting recordings, transcripts, and summaries from Fathom AI",
        category: "knowledge",
        requiresAuth: true,
        envVars: ["FATHOM_API_KEY"]
    },
    {
        id: "slack",
        name: "Slack",
        description: "Workspace messaging - channels, messages, users, and search",
        category: "communication",
        requiresAuth: true,
        envVars: ["SLACK_BOT_TOKEN", "SLACK_TEAM_ID"]
    },
    {
        id: "gdrive",
        name: "Google Drive",
        description: "File storage - search, list, and read Google Drive files",
        category: "productivity",
        requiresAuth: true,
        envVars: ["GDRIVE_CREDENTIALS_PATH"]
    },
    {
        id: "github",
        name: "GitHub",
        description: "Repository management - issues, PRs, code, and actions",
        category: "productivity",
        requiresAuth: true,
        envVars: ["GITHUB_PERSONAL_ACCESS_TOKEN"]
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
        const servers = buildServerConfigs({
            credentialsByToolId: new Map(),
            allowEnvFallback: true
        });

        global.mcpClient = new MCPClient({
            id: "mastra-mcp-client",
            servers,
            timeout: 60000 // 60 second timeout
        });
    }

    return global.mcpClient;
}

export const mcpClient = getMcpClient();

async function getMcpClientForOrganization(organizationId?: string | null): Promise<MCPClient> {
    if (!organizationId) {
        return mcpClient;
    }

    const cached = orgMcpClients.get(organizationId);
    const now = Date.now();
    if (cached && now - cached.loadedAt < ORG_MCP_CACHE_TTL) {
        return cached.client;
    }

    const credentials = await prisma.toolCredential.findMany({
        where: { organizationId, isActive: true }
    });

    const credentialsByToolId = new Map<string, Record<string, unknown>>(
        credentials.map((credential) => [
            credential.toolId,
            (credential.credentials || {}) as Record<string, unknown>
        ])
    );

    const servers = buildServerConfigs({
        credentialsByToolId,
        allowEnvFallback: true
    });

    const client = new MCPClient({
        id: `mastra-mcp-client-${organizationId}`,
        servers,
        timeout: 60000
    });

    orgMcpClients.set(organizationId, { client, loadedAt: now });
    return client;
}

/**
 * Get all available MCP tools
 * Use this when configuring an agent with static tools
 *
 * Tools are sanitized to fix schema issues that cause validation failures
 * with strict LLM providers like OpenAI GPT-4o-mini.
 */
export async function getMcpTools(organizationId?: string | null) {
    const client = await getMcpClientForOrganization(organizationId);
    const tools = await client.listTools();
    return sanitizeMcpTools(tools);
}

/**
 * Get MCP toolsets for dynamic per-request configuration
 * Use this when tools need to vary by request (e.g., different API keys per user)
 *
 * Toolsets are sanitized to fix schema issues that cause validation failures
 * with strict LLM providers like OpenAI GPT-4o-mini.
 */
export async function getMcpToolsets() {
    const toolsets = await mcpClient.listToolsets();
    return sanitizeMcpTools(toolsets);
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
    parameters: Record<string, unknown>,
    options?: { organizationId?: string | null }
): Promise<McpToolExecutionResult> {
    try {
        const client = await getMcpClientForOrganization(options?.organizationId);
        const toolsets = await client.listToolsets();

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
export async function listMcpToolDefinitions(
    organizationId?: string | null
): Promise<McpToolDefinition[]> {
    const client = await getMcpClientForOrganization(organizationId);
    const tools = await client.listTools();
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
