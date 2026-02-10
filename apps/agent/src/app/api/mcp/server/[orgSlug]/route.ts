import { NextRequest } from "next/server";
import { prisma } from "@repo/database";
import { buildMcpServer } from "@/lib/mcp-server";
import { toReqRes, toFetchResponse } from "fetch-to-node";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Remote MCP Server Endpoint (Streamable HTTP) -- Organization-scoped
 *
 * Exposes Mastra agents, workflows, and networks as a proper MCP server
 * using the Streamable HTTP transport. This endpoint is designed for
 * remote MCP clients like Claude CoWork (Custom Connectors).
 *
 * URL: /api/mcp/server/{orgSlug}
 *
 * The org slug is embedded in the URL so each organization gets a unique
 * MCP server endpoint. This mirrors how the Cursor setup uses
 * MASTRA_ORGANIZATION_SLUG to scope which agents are visible.
 *
 * Authentication:
 * - API Key via Authorization: Bearer header (recommended)
 *   Claude CoWork sends this when you fill in the "OAuth Client Secret" field.
 * - Also accepts X-API-Key header for direct usage.
 * - The API key is validated against the org's stored MCP API key in the DB.
 * - Falls back to global MCP_API_KEY from env if no org-specific key matches.
 *
 * Protocol: MCP Streamable HTTP (spec version 2025-03-26)
 *
 * Claude CoWork users add this as a Custom Connector with the URL:
 *   https://mastra.useappello.app/agent/api/mcp/server/{orgSlug}
 */

type RouteContext = { params: Promise<{ orgSlug: string }> };

/**
 * Resolve and authenticate the organization from the URL slug + optional API key.
 */
async function resolveOrganization(
    orgSlug: string,
    request: NextRequest
): Promise<{ organizationId: string; authHeaders: Record<string, string> } | null> {
    // Look up the organization by slug
    const org = await prisma.organization.findUnique({
        where: { slug: orgSlug },
        select: { id: true }
    });
    if (!org) {
        return null;
    }

    const apiKey =
        request.headers.get("x-api-key") ||
        request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

    const authHeaders: Record<string, string> = {
        "X-Organization-Slug": orgSlug
    };

    // If the caller provided an API key, validate it
    if (apiKey) {
        // Check org-specific MCP API key stored in ToolCredential
        const credential = await prisma.toolCredential.findUnique({
            where: {
                organizationId_toolId: {
                    organizationId: org.id,
                    toolId: "mastra-mcp-api"
                }
            },
            select: { credentials: true, isActive: true }
        });
        const credentialPayload = credential?.credentials;
        const storedKey =
            credentialPayload &&
            typeof credentialPayload === "object" &&
            !Array.isArray(credentialPayload)
                ? (credentialPayload as { apiKey?: string }).apiKey
                : undefined;

        if (credential?.isActive && storedKey && storedKey === apiKey) {
            authHeaders["X-API-Key"] = apiKey;
            return { organizationId: org.id, authHeaders };
        }

        // Check global MCP_API_KEY from env
        const globalKey = process.env.MCP_API_KEY;
        if (globalKey && apiKey === globalKey) {
            authHeaders["X-API-Key"] = apiKey;
            return { organizationId: org.id, authHeaders };
        }

        // API key was provided but didn't match -- reject
        return null;
    }

    // No API key provided -- allow if a global key exists (inject it for
    // the internal gateway call) so the endpoint is usable in authless mode
    // during initial testing. In production you should require a key.
    const globalKey = process.env.MCP_API_KEY;
    if (globalKey) {
        authHeaders["X-API-Key"] = globalKey;
    }

    return { organizationId: org.id, authHeaders };
}

/**
 * Handle MCP Streamable HTTP requests.
 * Converts Next.js Request/Response to Node.js IncomingMessage/ServerResponse
 * using fetch-to-node, then delegates to MCPServer.startHTTP().
 */
async function handleMcpRequest(request: NextRequest, context: RouteContext): Promise<Response> {
    const { orgSlug } = await context.params;

    try {
        const orgContext = await resolveOrganization(orgSlug, request);
        if (!orgContext) {
            return new Response(
                JSON.stringify({
                    jsonrpc: "2.0",
                    error: {
                        code: -32001,
                        message: `Organization "${orgSlug}" not found or API key is invalid.`
                    },
                    id: null
                }),
                {
                    status: 401,
                    headers: { "Content-Type": "application/json" }
                }
            );
        }

        const { organizationId, authHeaders } = orgContext;

        // Build the MCPServer with tools for this organization
        const mcpServer = await buildMcpServer(organizationId, authHeaders);

        // Convert the Next.js Request to Node.js req/res
        const { req: nodeReq, res: nodeRes } = toReqRes(request);

        // Determine the MCP path
        const url = new URL(request.url);

        // Start the Streamable HTTP handler in serverless mode
        await mcpServer.startHTTP({
            url,
            httpPath: url.pathname,
            req: nodeReq,
            res: nodeRes,
            options: {
                serverless: true
            }
        });

        // Convert the Node.js response back to a Fetch Response
        return await toFetchResponse(nodeRes);
    } catch (error) {
        console.error(`[MCP Server/${orgSlug}] Error handling request:`, error);
        return new Response(
            JSON.stringify({
                jsonrpc: "2.0",
                error: {
                    code: -32603,
                    message: error instanceof Error ? error.message : "Internal server error"
                },
                id: null
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" }
            }
        );
    }
}

/**
 * POST /api/mcp/server/{orgSlug}
 *
 * Main MCP Streamable HTTP endpoint. Handles JSON-RPC messages from
 * MCP clients (initialize, tools/list, tools/call, etc.)
 */
export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
    return handleMcpRequest(request, context);
}

/**
 * GET /api/mcp/server/{orgSlug}
 *
 * Handles SSE stream connections for MCP Streamable HTTP.
 * Also serves as a health check / discovery endpoint.
 */
export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
    const { orgSlug } = await context.params;

    // Check if this is an MCP protocol request (has Accept header for SSE)
    const accept = request.headers.get("accept") || "";
    if (accept.includes("text/event-stream")) {
        return handleMcpRequest(request, context);
    }

    // Otherwise return server info for discovery
    return new Response(
        JSON.stringify({
            name: "Mastra Agents MCP Server",
            version: "1.0.0",
            protocol: "mcp-streamable-http",
            organization: orgSlug,
            description: `Remote MCP server for organization "${orgSlug}". Exposes agents, workflows, and networks as MCP tools.`,
            endpoints: {
                mcp: `/api/mcp/server/${orgSlug}`
            },
            docs: "https://mastra.useappello.app/mcp/setup"
        }),
        {
            status: 200,
            headers: { "Content-Type": "application/json" }
        }
    );
}

/**
 * DELETE /api/mcp/server/{orgSlug}
 *
 * Handles session termination for MCP Streamable HTTP.
 */
export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
    return handleMcpRequest(request, context);
}
