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
        // We provide a generic tool interface that forwards to n8n
        return [
            {
                name: "atlas-execute-workflow",
                description: "Execute an n8n workflow with custom parameters",
                serverId: this.serverId,
                parameters: {
                    workflowId: { type: "string", description: "Workflow ID or name" },
                    parameters: {
                        type: "object",
                        description: "Parameters to pass to the workflow"
                    }
                },
                hasApiFallback: true
            },
            {
                name: "atlas-trigger",
                description: "Trigger an ATLAS automation with input data",
                serverId: this.serverId,
                parameters: {
                    action: { type: "string", description: "Action to trigger", required: true },
                    data: { type: "object", description: "Data to pass to the action" }
                },
                hasApiFallback: true
            },
            {
                name: "atlas-query",
                description: "Query ATLAS for information or status",
                serverId: this.serverId,
                parameters: {
                    query: { type: "string", description: "Query string", required: true },
                    context: { type: "object", description: "Additional context" }
                },
                hasApiFallback: true
            }
        ];
    }

    async executeTool(toolName: string, params: ToolExecutionContext): Promise<ToolResult> {
        const startTime = Date.now();

        try {
            let result: { success: boolean; data?: unknown; error?: string };

            switch (toolName) {
                case "atlas-execute-workflow":
                    result = await this.executeWorkflow(params);
                    break;
                case "atlas-trigger":
                    result = await this.trigger(params);
                    break;
                case "atlas-query":
                    result = await this.query(params);
                    break;
                default:
                    // For dynamic tools from n8n, forward the request
                    result = await this.forwardToN8n(toolName, params);
            }

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

    private async executeWorkflow(params: ToolExecutionContext) {
        return this.apiRequest({
            jsonrpc: "2.0",
            method: "tools/call",
            params: {
                name: "execute_workflow",
                arguments: {
                    workflowId: params.workflowId,
                    parameters: params.parameters
                }
            },
            id: Date.now()
        });
    }

    private async trigger(params: ToolExecutionContext) {
        return this.apiRequest({
            jsonrpc: "2.0",
            method: "tools/call",
            params: {
                name: params.action as string,
                arguments: params.data || {}
            },
            id: Date.now()
        });
    }

    private async query(params: ToolExecutionContext) {
        return this.apiRequest({
            jsonrpc: "2.0",
            method: "tools/call",
            params: {
                name: "query",
                arguments: {
                    query: params.query,
                    context: params.context
                }
            },
            id: Date.now()
        });
    }

    private async forwardToN8n(toolName: string, params: ToolExecutionContext) {
        // Forward any tool call to n8n using JSON-RPC
        return this.apiRequest({
            jsonrpc: "2.0",
            method: "tools/call",
            params: {
                name: toolName.replace("atlas-", ""),
                arguments: params
            },
            id: Date.now()
        });
    }
}

export const atlasApiClient = new AtlasApiClient();
