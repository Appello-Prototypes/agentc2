import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { consumeAuthCode, issueAccessToken, validateClientCredentials } from "@/lib/mcp-oauth";

export const dynamic = "force-dynamic";

/**
 * Verify PKCE code_verifier against stored code_challenge.
 * S256: BASE64URL(SHA256(code_verifier)) === code_challenge
 */
function verifyPkce(codeVerifier: string, codeChallenge: string, method: string): boolean {
    if (method === "S256") {
        const hash = createHash("sha256").update(codeVerifier).digest("base64url");
        return hash === codeChallenge;
    }
    // Plain method fallback
    return codeVerifier === codeChallenge;
}

/**
 * Extract client credentials from the request body and/or Authorization header.
 * Supports both client_secret_post and client_secret_basic auth methods.
 */
function resolveClientCredentials(
    params: Record<string, string>,
    authHeader: string | null
): { clientId: string; clientSecret: string } {
    let clientId = params.client_id || "";
    let clientSecret = params.client_secret || "";

    // client_secret_basic: Authorization: Basic base64(client_id:client_secret)
    if (authHeader?.startsWith("Basic ")) {
        const decoded = Buffer.from(authHeader.slice(6), "base64").toString();
        const colonIndex = decoded.indexOf(":");
        if (colonIndex > 0) {
            const basicId = decoded.substring(0, colonIndex);
            const basicSecret = decoded.substring(colonIndex + 1);
            if (!clientId) clientId = basicId;
            if (!clientSecret) clientSecret = basicSecret;
        }
    }

    return { clientId, clientSecret };
}

/**
 * POST /token
 *
 * OAuth 2.1 Token Endpoint.
 *
 * grant_type=authorization_code:
 *   - Consumes the single-use authorization code
 *   - Validates PKCE code_verifier
 *   - Validates client_id + client_secret (MCP API key) -- REQUIRED
 *   - Returns access_token = the MCP API key (so the MCP endpoint can validate it)
 *
 * grant_type=refresh_token:
 *   - Re-validates client credentials
 *   - Re-issues the same access token
 */
export async function POST(request: NextRequest): Promise<Response> {
    // Parse request body (form-encoded or JSON)
    const contentType = request.headers.get("content-type") || "";
    let params: Record<string, string>;

    if (contentType.includes("application/x-www-form-urlencoded")) {
        const formData = await request.formData();
        params = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, String(v)]));
    } else {
        try {
            params = await request.json();
        } catch {
            return new Response(
                JSON.stringify({
                    error: "invalid_request",
                    error_description: "Invalid request body"
                }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }
    }

    const grantType = params.grant_type;
    const authHeader = request.headers.get("authorization");
    const { clientId, clientSecret } = resolveClientCredentials(params, authHeader);

    // ── authorization_code grant ──

    if (grantType === "authorization_code") {
        const code = params.code;
        const codeVerifier = params.code_verifier;
        const redirectUri = params.redirect_uri;

        if (!code || !clientId) {
            return new Response(
                JSON.stringify({
                    error: "invalid_request",
                    error_description: "Missing code or client_id"
                }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Consume the single-use auth code
        const storedCode = consumeAuthCode(code);
        if (!storedCode) {
            return new Response(
                JSON.stringify({
                    error: "invalid_grant",
                    error_description: "Invalid or expired authorization code"
                }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Validate client_id matches
        if (storedCode.clientId !== clientId) {
            return new Response(
                JSON.stringify({
                    error: "invalid_grant",
                    error_description: "Client ID mismatch"
                }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Validate redirect_uri matches (if provided)
        if (redirectUri && storedCode.redirectUri !== redirectUri) {
            return new Response(
                JSON.stringify({
                    error: "invalid_grant",
                    error_description: "Redirect URI mismatch"
                }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Validate PKCE code_verifier (if provided)
        if (codeVerifier) {
            if (
                !verifyPkce(codeVerifier, storedCode.codeChallenge, storedCode.codeChallengeMethod)
            ) {
                return new Response(
                    JSON.stringify({
                        error: "invalid_grant",
                        error_description: "PKCE verification failed"
                    }),
                    { status: 400, headers: { "Content-Type": "application/json" } }
                );
            }
        }

        // Always require client_secret -- this is the MCP API key
        if (!clientSecret) {
            return new Response(
                JSON.stringify({
                    error: "invalid_client",
                    error_description: "Client secret is required"
                }),
                { status: 401, headers: { "Content-Type": "application/json" } }
            );
        }

        const validation = await validateClientCredentials(clientId, clientSecret);
        if (!validation) {
            return new Response(
                JSON.stringify({
                    error: "invalid_client",
                    error_description: "Invalid client credentials"
                }),
                { status: 401, headers: { "Content-Type": "application/json" } }
            );
        }

        // Issue a short-lived opaque access token instead of returning the client secret.
        const accessToken = issueAccessToken(validation.organizationId);
        return new Response(
            JSON.stringify({
                access_token: accessToken,
                token_type: "Bearer",
                expires_in: 86400,
                scope: "mcp"
            }),
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "no-store"
                }
            }
        );
    }

    // ── refresh_token grant ──

    if (grantType === "refresh_token") {
        if (!clientId || !clientSecret) {
            return new Response(
                JSON.stringify({
                    error: "invalid_request",
                    error_description: "Missing client credentials"
                }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        const validation = await validateClientCredentials(clientId, clientSecret);
        if (!validation) {
            return new Response(JSON.stringify({ error: "invalid_client" }), {
                status: 401,
                headers: { "Content-Type": "application/json" }
            });
        }

        const accessToken = issueAccessToken(validation.organizationId);
        return new Response(
            JSON.stringify({
                access_token: accessToken,
                token_type: "Bearer",
                expires_in: 86400,
                scope: "mcp"
            }),
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "no-store"
                }
            }
        );
    }

    return new Response(JSON.stringify({ error: "unsupported_grant_type" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
    });
}
