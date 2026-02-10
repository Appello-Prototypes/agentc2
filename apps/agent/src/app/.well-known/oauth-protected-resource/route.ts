import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /.well-known/oauth-protected-resource
 *
 * OAuth 2.0 Protected Resource Metadata (RFC 9728).
 * Claude CoWork discovers this endpoint to find our authorization server.
 *
 * Returns metadata pointing to this same server as the authorization server,
 * since we host both the MCP resource server and the OAuth endpoints.
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

export async function GET(request: NextRequest): Promise<Response> {
    const baseUrl = getPublicBaseUrl(request);

    return new Response(
        JSON.stringify({
            resource: `${baseUrl}/api/mcp/server`,
            authorization_servers: [baseUrl],
            scopes_supported: ["mcp"],
            bearer_methods_supported: ["header"]
        }),
        {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=3600",
                "X-Content-Type-Options": "nosniff"
            }
        }
    );
}
