/**
 * MCP Dual-Mode Architecture Types
 *
 * Supports both stdio-based MCP servers (local development) and
 * direct API calls (production environments).
 */

/**
 * Tool execution context for both MCP and API modes
 */
export interface ToolExecutionContext {
    [key: string]: unknown;
}

/**
 * Standardized tool result format
 */
export interface ToolResult {
    success: boolean;
    data?: unknown;
    error?: string;
    metadata?: {
        mode: "mcp" | "api";
        executionTime?: number;
        serverId: string;
    };
}

/**
 * Tool definition for unified interface
 */
export interface UnifiedToolDefinition {
    name: string;
    description: string;
    serverId: string;
    parameters: Record<string, unknown>;
    /** Whether this tool has an API fallback */
    hasApiFallback: boolean;
}

/**
 * Server connection status with mode information
 */
export interface ServerConnectionStatus {
    id: string;
    name: string;
    description: string;
    category: string;
    /** Whether MCP transport is active */
    connected: boolean;
    /** Whether tools are available (via MCP or API) */
    available: boolean;
    /** Whether using direct API instead of MCP */
    usingApi: boolean;
    /** Whether running in serverless environment */
    serverless: boolean;
    /** Number of tools accessible */
    toolCount: number;
    /** Error message if any */
    error?: string;
    /** Required env vars for this server */
    requiredEnvVars?: string[];
    /** Missing env vars */
    missingEnvVars?: string[];
}

/**
 * API client interface that each integration must implement
 */
export interface McpApiClient {
    /** Server identifier */
    serverId: string;

    /** Check if this client is configured (has required env vars) */
    isConfigured(): boolean;

    /** Get list of available tools */
    listTools(): Promise<UnifiedToolDefinition[]>;

    /** Execute a tool by name */
    executeTool(toolName: string, params: ToolExecutionContext): Promise<ToolResult>;
}

/**
 * Transport mode for MCP servers
 */
export type TransportMode = "stdio" | "http" | "sse";

/**
 * Server configuration with transport info
 */
export interface McpServerConfig {
    id: string;
    name: string;
    description: string;
    category: "knowledge" | "web" | "crm" | "productivity" | "communication" | "automation";
    requiresAuth: boolean;
    envVars?: string[];
    /** Transport type - "stdio" requires child processes */
    transport: TransportMode;
    /** Whether this server has an API fallback for serverless */
    hasApiFallback: boolean;
}
