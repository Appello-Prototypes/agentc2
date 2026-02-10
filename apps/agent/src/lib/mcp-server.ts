/**
 * MCP Server Factory for Claude CoWork (Remote Streamable HTTP)
 *
 * Creates an MCP Server instance that exposes the same tools as the
 * "Mastra Agents" MCP server in Cursor -- platform management tools
 * (agent_, workflow_, network_, rag_, integration_, etc.) plus
 * database agents, workflows, and networks.
 *
 * Tools are fetched from the /api/mcp gateway and execution delegates
 * back to the same gateway.
 *
 * IMPORTANT: This uses @modelcontextprotocol/sdk Server directly and
 * passes JSON Schema from the gateway without any Zod roundtrip.
 * This mirrors scripts/mcp-server/index.js (the Cursor stdio server)
 * exactly, avoiding the JSON Schema -> Zod -> AI SDK Schema -> JSON
 * Schema conversion that was causing empty schemas in production.
 *
 * External MCP tools (HubSpot, Jira, Slack, GitHub, etc.) are NOT
 * included here -- those are separate MCP servers that users configure
 * independently in their Cursor mcp.json or as separate Claude connectors.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

/**
 * Internal base URL for calling the /api/mcp gateway.
 * In production we use localhost to avoid DNS/SSL round-trips.
 */
function getInternalBaseUrl(): string {
    if (process.env.NODE_ENV === "production") {
        return "http://localhost:3001";
    }
    return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
}

interface GatewayTool {
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
}

/**
 * Fetch the tool list from the /api/mcp gateway.
 */
async function fetchToolsFromGateway(authHeaders: Record<string, string>): Promise<GatewayTool[]> {
    const response = await fetch(`${getInternalBaseUrl()}/api/mcp`, {
        headers: {
            "Content-Type": "application/json",
            ...authHeaders
        }
    });

    const data = await response.json();

    if (!data.success) {
        console.error("[MCP Server] Failed to fetch tools from gateway:", data.error);
        return [];
    }

    return data.tools || [];
}

/**
 * Invoke a tool via the /api/mcp gateway.
 */
async function invokeMcpGatewayTool(
    toolName: string,
    params: Record<string, unknown>,
    authHeaders: Record<string, string>
): Promise<unknown> {
    const response = await fetch(`${getInternalBaseUrl()}/api/mcp`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...authHeaders
        },
        body: JSON.stringify({
            method: "tools/call",
            tool: toolName,
            params
        })
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || "Tool invocation failed");
    }

    return data.result;
}

/**
 * Format a tool result into a human-readable string.
 */
function formatResult(result: unknown): string {
    if (typeof result === "string") {
        return result;
    }
    const r = result as Record<string, unknown>;
    if (r?.output) {
        return typeof r.output === "string" ? r.output : JSON.stringify(r.output, null, 2);
    }
    if (r?.outputText) {
        return String(r.outputText);
    }
    return JSON.stringify(result, null, 2);
}

/**
 * Result type returned by buildMcpServer().
 * Contains the raw @modelcontextprotocol/sdk Server and the tool name mapping.
 */
export interface BuiltMcpServer {
    server: Server;
    toolNameMap: Map<string, string>;
    toolCount: number;
}

/**
 * Build an MCP Server from the /api/mcp gateway tool list.
 *
 * Uses @modelcontextprotocol/sdk Server directly (same as the Cursor
 * stdio server in scripts/mcp-server/index.js). JSON Schema from the
 * gateway is passed through to MCP clients without any conversion,
 * avoiding the Zod roundtrip that was causing empty schemas.
 *
 * @param organizationId - The organization ID (for logging)
 * @param authHeaders - Headers to forward to the /api/mcp gateway
 */
export async function buildMcpServer(
    organizationId: string,
    authHeaders: Record<string, string>
): Promise<BuiltMcpServer> {
    const gatewayTools = await fetchToolsFromGateway(authHeaders);
    const toolNameMap = new Map<string, string>();

    const server = new Server(
        {
            name: "Mastra Agents",
            version: "1.0.0"
        },
        {
            capabilities: {
                tools: {}
            }
        }
    );

    // Handle tools/list -- pass JSON Schema from gateway directly (no Zod conversion)
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: gatewayTools.map((tool) => {
                const safeName = tool.name.replace(/[.-]/g, "_");
                toolNameMap.set(safeName, tool.name);

                return {
                    name: safeName,
                    description: tool.description || `Invoke ${tool.name}`,
                    inputSchema: tool.inputSchema || {
                        type: "object" as const,
                        properties: {}
                    }
                };
            })
        };
    });

    // Handle tools/call -- delegate to the /api/mcp gateway
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        const originalName = toolNameMap.get(name) || name;

        try {
            const result = await invokeMcpGatewayTool(originalName, args || {}, authHeaders);

            let outputText = "";
            if (typeof result === "string") {
                outputText = result;
            } else {
                outputText = formatResult(result);
            }

            const content: Array<{ type: "text"; text: string }> = [
                {
                    type: "text",
                    text: outputText
                }
            ];

            const r = result as Record<string, unknown> | null;
            const runId = r?.runId || r?.run_id;
            if (runId || r?.status || r?.duration_ms || r?.durationMs) {
                content.push({
                    type: "text",
                    text: `\n---\nRun ID: ${runId || "n/a"}\nStatus: ${r?.status || "n/a"}`
                });
            }

            return { content };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error invoking tool: ${error instanceof Error ? error.message : String(error)}`
                    }
                ],
                isError: true
            };
        }
    });

    console.log(
        `[MCP Server] Built server for org ${organizationId}: ${gatewayTools.length} tools`
    );

    return { server, toolNameMap, toolCount: gatewayTools.length };
}
