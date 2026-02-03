/**
 * ATLAS (n8n) Direct API Client
 *
 * Provides direct HTTP access to n8n workflows when MCP stdio transport is unavailable.
 * Communicates directly with the n8n webhook endpoint.
 */

import type {
    McpApiClient,
    ToolExecutionContext,
    ToolResult,
    UnifiedToolDefinition
} from "../types";

/**
 * ATLAS API Client for serverless environments
 *
 * n8n's MCP endpoint typically expects SSE connections, but for serverless
 * we can make direct HTTP POST calls to trigger workflows.
 */
export class AtlasApiClient implements McpApiClient {
    serverId = "atlas";
    private sseUrl: string | undefined;

    constructor() {
        this.sseUrl = process.env.ATLAS_N8N_SSE_URL;
    }

    isConfigured(): boolean {
        return !!this.sseUrl;
    }

    /**
     * Convert SSE URL to HTTP endpoint
     * n8n MCP SSE URLs typically look like: https://xxx.app.n8n.cloud/mcp/xxx/sse
     * We convert to the message endpoint: https://xxx.app.n8n.cloud/mcp/xxx/message
     */
    private getMessageUrl(): string {
        if (!this.sseUrl) return "";
        // Replace /sse with /message for direct HTTP calls
        return this.sseUrl.replace(/\/sse$/, "/message");
    }

    private async apiRequest(
        body: Record<string, unknown>
    ): Promise<{ success: boolean; data?: unknown; error?: string }> {
        if (!this.isConfigured()) {
            return { success: false, error: "ATLAS_N8N_SSE_URL not configured" };
        }

        try {
            const messageUrl = this.getMessageUrl();
            const response = await fetch(messageUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorText = await response.text();
                return {
                    success: false,
                    error: `n8n API error ${response.status}: ${errorText}`
                };
            }

            const data = await response.json();
            return { success: true, data };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    async listTools(): Promise<UnifiedToolDefinition[]> {
        // ATLAS/n8n tools are dynamically defined in n8n
        // We provide a single generic tool that forwards requests to n8n
        // The actual tool name will be passed through when executing
        return [
            {
                name: "atlas-call",
                description:
                    "Execute an ATLAS/n8n workflow tool. Pass the tool name and arguments to forward to your n8n MCP endpoint.",
                serverId: this.serverId,
                parameters: {
                    toolName: {
                        type: "string",
                        description: "The n8n tool name to call",
                        required: true
                    },
                    arguments: {
                        type: "object",
                        description: "Arguments to pass to the n8n tool"
                    }
                },
                hasApiFallback: true
            }
        ];
    }

    async executeTool(toolName: string, params: ToolExecutionContext): Promise<ToolResult> {
        const startTime = Date.now();

        try {
            // For atlas-call, extract the actual tool name and arguments
            // For any other tool name, forward directly to n8n
            const n8nToolName =
                toolName === "atlas-call"
                    ? (params.toolName as string)
                    : toolName.replace("atlas-", "").replace("atlas_", "");

            const n8nArguments =
                toolName === "atlas-call" ? (params.arguments as Record<string, unknown>) || {} : params;

            const result = await this.forwardToN8n(n8nToolName, n8nArguments);

            return {
                ...result,
                metadata: {
                    mode: "api",
                    executionTime: Date.now() - startTime,
                    serverId: this.serverId
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
                metadata: {
                    mode: "api",
                    executionTime: Date.now() - startTime,
                    serverId: this.serverId
                }
            };
        }
    }

    private async forwardToN8n(toolName: string, args: Record<string, unknown>) {
        // Forward tool call to n8n using JSON-RPC
        return this.apiRequest({
            jsonrpc: "2.0",
            method: "tools/call",
            params: {
                name: toolName,
                arguments: args
            },
            id: Date.now()
        });
    }
}

export const atlasApiClient = new AtlasApiClient();
