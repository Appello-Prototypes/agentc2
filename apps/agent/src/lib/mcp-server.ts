/**
 * MCPServer Factory for Claude CoWork (Remote Streamable HTTP)
 *
 * Creates an MCPServer instance that exposes ALL tools accessible to the
 * organization via the Streamable HTTP transport:
 *
 * 1. Platform tools -- agents, workflows, networks, and static platform ops
 *    (fetched from the /api/mcp gateway, same source as Cursor's Mastra Agents)
 *
 * 2. External MCP tools -- HubSpot, Jira, Slack, GitHub, Fathom, etc.
 *    (loaded via getMcpClientForOrganization / listMcpToolDefinitions)
 *
 * This gives Claude CoWork full parity with what Cursor sees across all 13+
 * MCP servers, but through a single remote endpoint.
 */

import { createTool } from "@mastra/core/tools";
import { MCPServer } from "@mastra/mcp";
import { z } from "zod";
import { listMcpToolDefinitions, executeMcpTool } from "@repo/mastra";

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

// ── Gateway tools (platform agents, workflows, networks, static ops) ──

interface GatewayTool {
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
}

/**
 * Fetch the complete tool list from the /api/mcp gateway.
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

// ── Result formatting ──

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

// ── Main builder ──

/**
 * Build an MCPServer instance that exposes ALL tools for a given organization:
 * - Platform tools from /api/mcp (agents, workflows, networks, static ops)
 * - External MCP tools (HubSpot, Jira, Slack, GitHub, etc.)
 *
 * @param organizationId - The organization ID
 * @param authHeaders - Headers to forward to the internal /api/mcp gateway
 */
export async function buildMcpServer(
    organizationId: string,
    authHeaders: Record<string, string>
): Promise<MCPServer> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools: Record<string, any> = {};
    const toolNames = new Set<string>();

    // ── 1. Platform tools from /api/mcp gateway ──
    const gatewayTools = await fetchToolsFromGateway(authHeaders);

    for (const gwTool of gatewayTools) {
        const safeName = gwTool.name.replace(/[.-]/g, "_");
        const originalName = gwTool.name;

        if (toolNames.has(safeName)) continue;
        toolNames.add(safeName);

        tools[safeName] = createTool({
            id: safeName,
            description: gwTool.description || `Invoke ${originalName}`,
            inputSchema: z.record(z.unknown()).describe("Tool parameters"),
            execute: async (inputData) => {
                const result = await invokeMcpGatewayTool(
                    originalName,
                    inputData as Record<string, unknown>,
                    authHeaders
                );
                return formatResult(result);
            }
        });
    }

    // ── 2. External MCP tools (HubSpot, Jira, Slack, GitHub, etc.) ──
    try {
        const externalTools = await listMcpToolDefinitions({ organizationId });

        for (const extTool of externalTools) {
            const safeName = extTool.name.replace(/[.-]/g, "_");

            // Skip if already registered from gateway (avoid duplicates)
            if (toolNames.has(safeName)) continue;
            toolNames.add(safeName);

            const extToolName = extTool.name;

            tools[safeName] = createTool({
                id: safeName,
                description:
                    extTool.description || `External tool: ${extTool.name} (${extTool.server})`,
                inputSchema: z.record(z.unknown()).describe("Tool parameters"),
                execute: async (inputData) => {
                    const result = await executeMcpTool(
                        extToolName,
                        inputData as Record<string, unknown>,
                        { organizationId }
                    );
                    if (!result.success) {
                        throw new Error(result.error || "Tool execution failed");
                    }
                    return formatResult(result.result);
                }
            });
        }

        console.log(
            `[MCP Server] Built server for org ${organizationId}: ` +
                `${gatewayTools.length} platform tools + ${externalTools.length} external tools = ` +
                `${toolNames.size} total (after dedup)`
        );
    } catch (error) {
        // External MCP tools may fail if servers are not configured -- that's OK,
        // we still expose the platform tools
        console.warn(
            `[MCP Server] Failed to load external MCP tools for org ${organizationId}:`,
            error instanceof Error ? error.message : error
        );
        console.log(
            `[MCP Server] Built server for org ${organizationId}: ` +
                `${gatewayTools.length} platform tools (external tools unavailable)`
        );
    }

    const server = new MCPServer({
        id: "mastra-remote-mcp",
        name: "Mastra Agents",
        version: "1.0.0",
        description:
            "Mastra AI Agent platform - exposes agents, workflows, networks, and all integrated MCP tools",
        tools
    });

    return server;
}
