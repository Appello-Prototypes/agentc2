// Main MCP client exports
export {
    mcpClient,
    getMcpTools,
    getMcpToolsets,
    disconnectMcp,
    executeMcpTool,
    listMcpToolDefinitions,
    isServerlessEnvironment,
    getMcpMode,
    getMcpServerStatus,
    MCP_SERVER_CONFIGS,
    type McpServerConfig,
    type McpToolExecutionResult,
    type McpToolDefinition,
    type ServerConnectionStatus
} from "./client";

// API clients for serverless fallback
export {
    apiClientRegistry,
    getApiClient,
    getConfiguredApiClients,
    hasApiClient,
    hubspotApiClient,
    firecrawlApiClient,
    jiraApiClient,
    atlasApiClient,
    playwrightApiClient
} from "./api-clients";

// Types
export type {
    ToolExecutionContext,
    ToolResult,
    UnifiedToolDefinition,
    McpApiClient,
    TransportMode
} from "./types";
