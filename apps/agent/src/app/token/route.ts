import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@repo/database";
import { authCodes } from "@/app/authorize/route";

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
    // Plain method (not recommended but handle it)
    return codeVerifier === codeChallenge;
}

/**
 * Validate client_id (org slug) + client_secret (MCP API key) against the database.
 */
async function validateClientCredentials(clientId: string, clientSecret: string): Promise<boolean> {
    // client_id is the org slug
    const org = await prisma.organization.findUnique({
        where: { slug: clientId },
        select: { id: true }
    });
    if (!org) return false;

    // client_secret is the MCP API key -- check against the org's stored key
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

    if (credential?.isActive && storedKey && storedKey === clientSecret) {
        return true;
    }

    // Also accept global MCP_API_KEY
    const globalKey = process.env.MCP_API_KEY;
    if (globalKey && clientSecret === globalKey) {
        return true;
    }

    return false;
}

/**
 * POST /token
 *
 * OAuth 2.1 Token Endpoint.
 *
 * Supports grant_type=authorization_code:
 *   - Validates the authorization code
 *   - Validates PKCE code_verifier
 *   - Validates client_id + client_secret against the org's MCP API key
 *   - Returns an access token (the MCP API key itself)
 *
 * Also supports grant_type=refresh_token for token refresh.
 */
export async function POST(request: NextRequest): Promise<Response> {
    // Token requests can be application/x-www-form-urlencoded or JSON
    const contentType = request.headers.get("content-type") || "";
    let params: Record<string, string>;

    if (contentType.includes("application/x-www-form-urlencoded")) {
        const formData = await request.formData();
        params = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, String(v)]));
    } else {
        params = await request.json();
    }

    const grantType = params.grant_type;
    const clientId = params.client_id;
    const clientSecret = params.client_secret;

    // Also check for client credentials in the Authorization header (Basic auth)
    let headerClientId = clientId;
    let headerClientSecret = clientSecret;
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Basic ")) {
        const decoded = Buffer.from(authHeader.slice(6), "base64").toString();
        const [id, secret] = decoded.split(":");
        if (id && !headerClientId) headerClientId = id;
        if (secret && !headerClientSecret) headerClientSecret = secret;
    }

    const resolvedClientId = headerClientId || "";
    const resolvedClientSecret = headerClientSecret || "";

    if (grantType === "authorization_code") {
        const code = params.code;
        const codeVerifier = params.code_verifier;
        const redirectUri = params.redirect_uri;

        if (!code || !resolvedClientId) {
            return new Response(JSON.stringify({ error: "invalid_request" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        // Look up the stored auth code
        const storedCode = authCodes.get(code);
        if (!storedCode) {
            return new Response(
                JSON.stringify({
                    error: "invalid_grant",
                    error_description: "Invalid or expired authorization code"
                }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Delete the code (one-time use)
        authCodes.delete(code);

        // Check expiration
        if (storedCode.expiresAt < Date.now()) {
            return new Response(
                JSON.stringify({
                    error: "invalid_grant",
                    error_description: "Authorization code expired"
                }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Validate client_id matches
        if (storedCode.clientId !== resolvedClientId) {
            return new Response(
                JSON.stringify({ error: "invalid_grant", error_description: "Client ID mismatch" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Validate redirect_uri matches
        if (redirectUri && storedCode.redirectUri !== redirectUri) {
            return new Response(
                JSON.stringify({
                    error: "invalid_grant",
                    error_description: "Redirect URI mismatch"
                }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Validate PKCE code_verifier
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

        // Validate client credentials (client_secret = MCP API key)
        if (resolvedClientSecret) {
            const valid = await validateClientCredentials(resolvedClientId, resolvedClientSecret);
            if (!valid) {
                return new Response(
                    JSON.stringify({
                        error: "invalid_client",
                        error_description: "Invalid client credentials"
                    }),
                    { status: 401, headers: { "Content-Type": "application/json" } }
                );
            }
        }

        // Issue access token -- use the client_secret (MCP API key) as the token
        // so the MCP endpoint can validate it against the same DB credential
        const accessToken = resolvedClientSecret || resolvedClientId;
        return new Response(
            JSON.stringify({
                access_token: accessToken,
                token_type: "Bearer",
                expires_in: 86400, // 24 hours
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

    if (grantType === "refresh_token") {
        // For refresh, just re-validate and re-issue
        if (!resolvedClientId || !resolvedClientSecret) {
            return new Response(JSON.stringify({ error: "invalid_request" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        const valid = await validateClientCredentials(resolvedClientId, resolvedClientSecret);
        if (!valid) {
            return new Response(JSON.stringify({ error: "invalid_client" }), {
                status: 401,
                headers: { "Content-Type": "application/json" }
            });
        }

        return new Response(
            JSON.stringify({
                access_token: resolvedClientSecret,
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
