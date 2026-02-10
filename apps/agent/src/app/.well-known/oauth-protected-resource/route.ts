import { NextRequest } from "next/server";
import { getPublicBaseUrl } from "@/lib/mcp-oauth";

export const dynamic = "force-dynamic";

/**
 * GET /.well-known/oauth-protected-resource
 *
 * OAuth 2.0 Protected Resource Metadata (RFC 9728).
 * Claude CoWork discovers this endpoint to find our authorization server.
 */
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
