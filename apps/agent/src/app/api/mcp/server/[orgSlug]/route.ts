import { NextRequest } from "next/server";
import { prisma } from "@repo/database";
import { buildMcpServer } from "@/lib/mcp-server";
import { toReqRes, toFetchResponse } from "fetch-to-node";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Remote MCP Server Endpoint (Streamable HTTP) -- Organization-scoped, OAuth-protected
 *
 * Exposes Mastra agents, workflows, and networks as a proper MCP server
 * using the Streamable HTTP transport. This endpoint is designed for
 * remote MCP clients like Claude CoWork (Custom Connectors).
 *
 * URL: /api/mcp/server/{orgSlug}
 *
 * Authentication:
 * - Bearer token via Authorization header (required)
 * - Token is the org's MCP API key, obtained via the OAuth flow
 * - Claude CoWork handles the OAuth flow automatically when Client ID + Secret are provided
 *
 * OAuth flow:
 * 1. Claude discovers /.well-known/oauth-protected-resource → authorization server
 * 2. Claude discovers /.well-known/oauth-authorization-server → authorize + token URLs
 * 3. Claude redirects to /authorize → auto-approves, returns auth code
 * 4. Claude exchanges code at /token (with client_secret = MCP API key) → gets access_token
 * 5. Claude sends Bearer token on all MCP requests
 *
 * Protocol: MCP Streamable HTTP (spec version 2025-03-26)
 */

type RouteContext = { params: Promise<{ orgSlug: string }> };

/**
 * Validate Bearer token against the org's stored MCP API key.
 * Returns organizationId + auth headers for the internal gateway, or null if invalid.
 */
async function authenticateRequest(
    orgSlug: string,
    request: NextRequest
): Promise<{ organizationId: string; authHeaders: Record<string, string> } | null> {
    // Look up the organization
    const org = await prisma.organization.findUnique({
        where: { slug: orgSlug },
        select: { id: true }
    });
    if (!org) return null;

    // Extract Bearer token
    const token =
        request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
        request.headers.get("x-api-key");

    if (!token) return null;

    // Validate against org-specific MCP API key
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

    if (credential?.isActive && storedKey && storedKey === token) {
        return {
            organizationId: org.id,
            authHeaders: {
                "X-API-Key": token,
                "X-Organization-Slug": orgSlug
            }
        };
    }

    // Also accept global MCP_API_KEY
    const globalKey = process.env.MCP_API_KEY;
    if (globalKey && token === globalKey) {
        return {
            organizationId: org.id,
            authHeaders: {
                "X-API-Key": token,
                "X-Organization-Slug": orgSlug
            }
        };
    }

    return null;
}

/**
 * Build a 401 response with proper WWW-Authenticate header
 * that points Claude to our OAuth discovery metadata.
 */
function getPublicBaseUrl(request: NextRequest): string {
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
    if (forwardedHost) {
        return `${forwardedProto}://${forwardedHost}`;
    }
    const url = new URL(request.url);
    return `${url.protocol}//${url.host}`;
}

function unauthorizedResponse(request: NextRequest, orgSlug: string): Response {
    const baseUrl = getPublicBaseUrl(request);
    const resourceMetadataUrl = `${baseUrl}/.well-known/oauth-protected-resource`;

    return new Response(
        JSON.stringify({
            jsonrpc: "2.0",
            error: {
                code: -32001,
                message: `Authentication required for organization "${orgSlug}".`
            },
            id: null
        }),
        {
            status: 401,
            headers: {
                "Content-Type": "application/json",
                "WWW-Authenticate": `Bearer resource_metadata="${resourceMetadataUrl}"`
            }
        }
    );
}

/**
 * Handle MCP Streamable HTTP requests.
 */
async function handleMcpRequest(request: NextRequest, context: RouteContext): Promise<Response> {
    const { orgSlug } = await context.params;

    // Authenticate
    const authResult = await authenticateRequest(orgSlug, request);
    if (!authResult) {
        return unauthorizedResponse(request, orgSlug);
    }

    try {
        const { organizationId, authHeaders } = authResult;

        // Build the MCPServer with tools for this organization
        const mcpServer = await buildMcpServer(organizationId, authHeaders);

        // Convert the Next.js Request to Node.js req/res
        const { req: nodeReq, res: nodeRes } = toReqRes(request);

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
 */
export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
    return handleMcpRequest(request, context);
}

/**
 * GET /api/mcp/server/{orgSlug}
 */
export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
    const { orgSlug } = await context.params;

    // Check if this is an MCP protocol request (SSE)
    const accept = request.headers.get("accept") || "";
    if (accept.includes("text/event-stream")) {
        return handleMcpRequest(request, context);
    }

    // For non-SSE GET without auth, return discovery info with auth hint
    const authResult = await authenticateRequest(orgSlug, request);
    if (!authResult) {
        return unauthorizedResponse(request, orgSlug);
    }

    return new Response(
        JSON.stringify({
            name: "Mastra Agents MCP Server",
            version: "1.0.0",
            protocol: "mcp-streamable-http",
            organization: orgSlug,
            description: `Remote MCP server for organization "${orgSlug}".`,
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
 */
export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
    return handleMcpRequest(request, context);
}
