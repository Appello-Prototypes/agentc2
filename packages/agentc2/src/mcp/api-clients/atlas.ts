/**
 * ATLAS (n8n) Direct API Client
 *
 * Provides direct API access to n8n workflows when MCP stdio transport is unavailable.
 * ATLAS uses n8n for workflow automation.
 *
 * Note: n8n workflows are typically triggered via webhooks, so the API client
 * provides a simplified interface for triggering workflows.
 */

import type {
    McpApiClient,
    ToolExecutionContext,
    ToolResult,
    UnifiedToolDefinition
} from "../types";

/**
 * ATLAS (n8n) API Client for serverless environments
 *
 * Since n8n MCP uses SSE transport with long-running connections,
 * this client provides an alternative for triggering workflows
 * via n8n's webhook triggers.
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
     * Extract the n8n base URL from the SSE URL
     * SSE URL format: https://your-n8n.app.n8n.cloud/mcp/.../sse
     */
    private getBaseUrl(): string | null {
        if (!this.sseUrl) return null;
        try {
            const url = new URL(this.sseUrl);
            return `${url.protocol}//${url.host}`;
        } catch {
            return null;
        }
    }

    async listTools(): Promise<UnifiedToolDefinition[]> {
        // ATLAS/n8n MCP typically exposes workflow-specific tools
        // Since we can't connect to the SSE endpoint in serverless,
        // we provide a generic workflow trigger capability
        return [
            {
                name: "atlas-trigger-workflow",
                description:
                    "Trigger an n8n workflow via webhook. Requires the workflow to have a webhook trigger configured.",
                serverId: this.serverId,
                parameters: {
                    webhookPath: {
                        type: "string",
                        description: "The webhook path (e.g., /webhook/my-workflow)",
                        required: true
                    },
                    method: {
                        type: "string",
                        description: "HTTP method (GET, POST)",
                        required: false
                    },
                    data: {
                        type: "object",
                        description: "Data to send to the workflow",
                        required: false
                    }
                },
                hasApiFallback: true
            },
            {
                name: "atlas-check-status",
                description: "Check if the n8n instance is accessible",
                serverId: this.serverId,
                parameters: {},
                hasApiFallback: true
            }
        ];
    }

    async executeTool(toolName: string, params: ToolExecutionContext): Promise<ToolResult> {
        const startTime = Date.now();

        try {
            let result: { success: boolean; data?: unknown; error?: string };

            switch (toolName) {
                case "atlas-trigger-workflow":
                    result = await this.triggerWorkflow(params);
                    break;
                case "atlas-check-status":
                    result = await this.checkStatus();
                    break;
                default:
                    result = { success: false, error: `Unknown tool: ${toolName}` };
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

    /**
     * Trigger an n8n workflow via webhook
     */
    private async triggerWorkflow(
        params: ToolExecutionContext
    ): Promise<{ success: boolean; data?: unknown; error?: string }> {
        const baseUrl = this.getBaseUrl();
        if (!baseUrl) {
            return { success: false, error: "ATLAS_N8N_SSE_URL not configured or invalid" };
        }

        const webhookPath = params.webhookPath as string;
        if (!webhookPath) {
            return { success: false, error: "webhookPath is required" };
        }

        const method = (params.method as string) || "POST";
        const data = params.data as Record<string, unknown> | undefined;

        try {
            const url = `${baseUrl}${webhookPath.startsWith("/") ? webhookPath : `/${webhookPath}`}`;

            const response = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json"
                },
                ...(data && method !== "GET" && { body: JSON.stringify(data) })
            });

            if (!response.ok) {
                const errorText = await response.text();
                return {
                    success: false,
                    error: `n8n webhook error ${response.status}: ${errorText}`
                };
            }

            // Try to parse JSON, fall back to text
            let responseData: unknown;
            const contentType = response.headers.get("content-type");
            if (contentType?.includes("application/json")) {
                responseData = await response.json();
            } else {
                responseData = await response.text();
            }

            return { success: true, data: responseData };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Failed to trigger workflow"
            };
        }
    }

    /**
     * Check if the n8n instance is accessible
     */
    private async checkStatus(): Promise<{ success: boolean; data?: unknown; error?: string }> {
        const baseUrl = this.getBaseUrl();
        if (!baseUrl) {
            return { success: false, error: "ATLAS_N8N_SSE_URL not configured or invalid" };
        }

        try {
            // Try to access the n8n health endpoint
            const response = await fetch(`${baseUrl}/healthz`, {
                method: "GET",
                signal: AbortSignal.timeout(5000) // 5 second timeout
            });

            if (response.ok) {
                return {
                    success: true,
                    data: {
                        status: "healthy",
                        baseUrl
                    }
                };
            } else {
                return {
                    success: false,
                    error: `n8n returned status ${response.status}`
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Failed to check n8n status"
            };
        }
    }
}

export const atlasApiClient = new AtlasApiClient();
