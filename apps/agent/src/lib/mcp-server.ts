/**
 * MCPServer Factory for Claude CoWork (Remote Streamable HTTP)
 *
 * Creates an MCPServer instance that exposes the same tools as the
 * "Mastra Agents" MCP server in Cursor -- platform management tools
 * (agent_, workflow_, network_, rag_, integration_, etc.) plus
 * database agents, workflows, and networks.
 *
 * Tools are fetched from the /api/mcp gateway and execution delegates
 * back to the same gateway. This is the server-side equivalent of
 * scripts/mcp-server/index.js (the Cursor stdio MCP server).
 *
 * External MCP tools (HubSpot, Jira, Slack, GitHub, etc.) are NOT
 * included here -- those are separate MCP servers that users configure
 * independently in their Cursor mcp.json or as separate Claude connectors.
 */

import { createTool } from "@mastra/core/tools";
import { MCPServer } from "@mastra/mcp";
import { z, ZodTypeAny } from "zod";

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
 * Convert a JSON Schema property definition to a Zod type.
 */
function jsonSchemaPropertyToZod(prop: Record<string, unknown>): ZodTypeAny {
    const type = prop.type as string | undefined;
    const description = prop.description as string | undefined;
    const enumValues = prop.enum as string[] | undefined;

    let schema: ZodTypeAny;

    if (enumValues && type === "string") {
        schema = z.enum(enumValues as [string, ...string[]]);
    } else if (type === "string") {
        schema = z.string();
    } else if (type === "number" || type === "integer") {
        schema = z.number();
    } else if (type === "boolean") {
        schema = z.boolean();
    } else if (type === "array") {
        const items = prop.items as Record<string, unknown> | undefined;
        if (items) {
            schema = z.array(jsonSchemaPropertyToZod(items));
        } else {
            schema = z.array(z.unknown());
        }
    } else if (type === "object") {
        const properties = prop.properties as Record<string, Record<string, unknown>> | undefined;
        if (properties) {
            schema = jsonSchemaToZod(prop);
        } else if (prop.additionalProperties) {
            schema = z.record(z.string(), z.unknown());
        } else {
            schema = z.record(z.string(), z.unknown());
        }
    } else if (prop.oneOf) {
        // For oneOf, accept unknown (these are complex union types)
        schema = z.unknown();
    } else {
        schema = z.unknown();
    }

    if (description) {
        schema = schema.describe(description);
    }

    return schema;
}

/**
 * Convert a JSON Schema object to a Zod object schema.
 * Handles the simple schemas used by MCP tool definitions:
 * { type: "object", properties: { ... }, required: [...] }
 */
function jsonSchemaToZod(
    jsonSchema: Record<string, unknown>
): z.ZodObject<Record<string, ZodTypeAny>> {
    const properties = jsonSchema.properties as Record<string, Record<string, unknown>> | undefined;
    const required = (jsonSchema.required as string[]) || [];

    if (!properties || Object.keys(properties).length === 0) {
        // Empty schema -- no properties
        return z.object({});
    }

    const shape: Record<string, ZodTypeAny> = {};

    for (const [key, prop] of Object.entries(properties)) {
        let fieldSchema = jsonSchemaPropertyToZod(prop);

        if (!required.includes(key)) {
            fieldSchema = fieldSchema.optional();
        }

        shape[key] = fieldSchema;
    }

    if (jsonSchema.additionalProperties) {
        return z.object(shape).passthrough();
    }

    return z.object(shape);
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
 * Build an MCPServer from the /api/mcp gateway tool list.
 *
 * This is the server-side equivalent of scripts/mcp-server/index.js.
 * Same tools, same invocation path, just over Streamable HTTP instead
 * of stdio.
 *
 * @param organizationId - The organization ID (for logging)
 * @param authHeaders - Headers to forward to the /api/mcp gateway
 */
export async function buildMcpServer(
    organizationId: string,
    authHeaders: Record<string, string>
): Promise<MCPServer> {
    const gatewayTools = await fetchToolsFromGateway(authHeaders);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools: Record<string, any> = {};

    for (const gwTool of gatewayTools) {
        // Sanitize name (same as Cursor stdio server does)
        const safeName = gwTool.name.replace(/[.-]/g, "_");
        const originalName = gwTool.name;

        const inputSchema = gwTool.inputSchema ? jsonSchemaToZod(gwTool.inputSchema) : z.object({});

        tools[safeName] = createTool({
            id: safeName,
            description: gwTool.description || `Invoke ${originalName}`,
            inputSchema,
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

    console.log(
        `[MCP Server] Built server for org ${organizationId}: ${Object.keys(tools).length} tools`
    );

    return new MCPServer({
        id: "mastra-remote-mcp",
        name: "Mastra Agents",
        version: "1.0.0",
        description:
            "Mastra AI Agent platform tools - agents, workflows, networks, and platform operations",
        tools
    });
}
