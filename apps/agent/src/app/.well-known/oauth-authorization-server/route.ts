import { NextRequest } from "next/server";
import { getPublicBaseUrl } from "@/lib/mcp-oauth";

export const dynamic = "force-dynamic";

/**
 * GET /.well-known/oauth-authorization-server
 *
 * OAuth 2.0 Authorization Server Metadata (RFC 8414).
 * Claude CoWork discovers this to find our authorize and token endpoints.
 */
export async function GET(request: NextRequest): Promise<Response> {
    const baseUrl = getPublicBaseUrl(request);

    return new Response(
        JSON.stringify({
            issuer: baseUrl,
            authorization_endpoint: `${baseUrl}/authorize`,
            token_endpoint: `${baseUrl}/token`,
            response_types_supported: ["code"],
            grant_types_supported: ["authorization_code", "refresh_token"],
            code_challenge_methods_supported: ["S256"],
            token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
            scopes_supported: ["mcp"]
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
