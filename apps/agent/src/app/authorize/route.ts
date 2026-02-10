import { NextRequest } from "next/server";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

/**
 * In-memory auth code store. Codes expire after 60 seconds.
 * Key: auth code string
 * Value: { clientId, codeChallenge, codeChallengeMethod, redirectUri, expiresAt }
 */
const authCodes = new Map<
    string,
    {
        clientId: string;
        codeChallenge: string;
        codeChallengeMethod: string;
        redirectUri: string;
        expiresAt: number;
    }
>();

// Export for use by the token endpoint
export { authCodes };

/**
 * GET /authorize
 *
 * OAuth 2.1 Authorization Endpoint.
 * Auto-approves and redirects back with an authorization code.
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

    // Validate required parameters
    if (responseType !== "code") {
        return new Response(JSON.stringify({ error: "unsupported_response_type" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    }
    if (!clientId || !redirectUri || !codeChallenge) {
        return new Response(
            JSON.stringify({
                error: "invalid_request",
                error_description: "Missing required parameters"
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    // Generate a short-lived authorization code
    const code = randomBytes(32).toString("hex");

    // Store the code with metadata for validation at the token endpoint
    authCodes.set(code, {
        clientId,
        codeChallenge,
        codeChallengeMethod,
        redirectUri,
        expiresAt: Date.now() + 60_000 // 60 seconds
    });

    // Clean up expired codes
    for (const [key, value] of authCodes.entries()) {
        if (value.expiresAt < Date.now()) {
            authCodes.delete(key);
        }
    }

    // Auto-approve: redirect back with the code
    const redirect = new URL(redirectUri);
    redirect.searchParams.set("code", code);
    if (state) {
        redirect.searchParams.set("state", state);
    }

    return Response.redirect(redirect.toString(), 302);
}
