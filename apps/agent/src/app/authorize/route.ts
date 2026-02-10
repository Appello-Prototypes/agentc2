import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { storeAuthCode, validateClientId, AUTH_CODE_TTL_MS } from "@/lib/mcp-oauth";

export const dynamic = "force-dynamic";

/**
 * GET /authorize
 *
 * OAuth 2.1 Authorization Endpoint for the MCP server.
 * Validates the client_id against the database, then auto-approves
 * and redirects back with an authorization code.
 *
 * Claude CoWork sends:
 *   ?response_type=code
 *   &client_id=<orgSlug>
 *   &redirect_uri=https://claude.ai/api/mcp/auth_callback
 *   &code_challenge=<S256 challenge>
 *   &code_challenge_method=S256
 *   &state=<random state>
 *   &scope=<scope>
 */
export async function GET(request: NextRequest): Promise<Response> {
    const url = new URL(request.url);
    const responseType = url.searchParams.get("response_type");
    const clientId = url.searchParams.get("client_id");
    const redirectUri = url.searchParams.get("redirect_uri");
    const codeChallenge = url.searchParams.get("code_challenge");
    const codeChallengeMethod = url.searchParams.get("code_challenge_method") || "S256";
    const state = url.searchParams.get("state");

    // Validate response_type
    if (responseType !== "code") {
        return new Response(JSON.stringify({ error: "unsupported_response_type" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    }

    // Validate required parameters
    if (!clientId || !redirectUri || !codeChallenge) {
        return new Response(
            JSON.stringify({
                error: "invalid_request",
                error_description:
                    "Missing required parameters: client_id, redirect_uri, code_challenge"
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    // Validate client_id is a real organization (defense in depth)
    const validClient = await validateClientId(clientId);
    if (!validClient) {
        return new Response(
            JSON.stringify({
                error: "invalid_client",
                error_description: `Unknown client_id: ${clientId}`
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    // Generate a short-lived, single-use authorization code
    const code = randomBytes(32).toString("hex");

    storeAuthCode(code, {
        clientId,
        codeChallenge,
        codeChallengeMethod,
        redirectUri,
        expiresAt: Date.now() + AUTH_CODE_TTL_MS
    });

    // Auto-approve: redirect back with the code
    const redirect = new URL(redirectUri);
    redirect.searchParams.set("code", code);
    if (state) {
        redirect.searchParams.set("state", state);
    }

    return Response.redirect(redirect.toString(), 302);
}
