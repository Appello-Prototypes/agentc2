/**
 * MCP OAuth2.1 Client Flow
 *
 * Handles the client side of MCP OAuth2.1 authorization for remote MCP servers.
 * Follows the MCP Authorization Spec (2025-03-26):
 * https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/authorization/
 *
 * Flow:
 * 1. Discovery: GET <mcpUrl>/.well-known/oauth-authorization-server
 * 2. Generate authorization URL with PKCE
 * 3. Callback: exchange auth code for tokens
 * 4. Token refresh when approaching expiry
 */

import crypto from "crypto";

// ── Types ────────────────────────────────────────────────────────────────────

export interface McpAuthServerMetadata {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    registration_endpoint?: string;
    scopes_supported?: string[];
    response_types_supported?: string[];
    grant_types_supported?: string[];
    code_challenge_methods_supported?: string[];
}

export interface McpOAuthTokens {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number; // Unix timestamp in milliseconds
    tokenType: string;
    scope?: string;
}

export interface McpOAuthStartResult {
    authorizationUrl: string;
    state: string;
    codeVerifier: string;
    metadata: McpAuthServerMetadata;
}

// ── Discovery ────────────────────────────────────────────────────────────────

/**
 * Discover the OAuth2.1 authorization server metadata for a remote MCP server.
 *
 * Per the MCP spec, the server exposes metadata at:
 *   <mcpUrl>/.well-known/oauth-authorization-server
 *
 * If the MCP URL is https://mcp.stripe.com/ then the discovery URL is:
 *   https://mcp.stripe.com/.well-known/oauth-authorization-server
 */
export async function discoverAuthServer(mcpUrl: string): Promise<McpAuthServerMetadata | null> {
    try {
        const url = new URL(mcpUrl);
        // Build discovery URL from the origin
        const discoveryUrl = `${url.origin}/.well-known/oauth-authorization-server`;

        const response = await fetch(discoveryUrl, {
            method: "GET",
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            console.warn(
                `[MCP OAuth] Discovery failed for ${mcpUrl}: ${response.status} ${response.statusText}`
            );
            return null;
        }

        const metadata = (await response.json()) as McpAuthServerMetadata;
        return metadata;
    } catch (error) {
        console.warn(
            `[MCP OAuth] Discovery error for ${mcpUrl}:`,
            error instanceof Error ? error.message : error
        );
        return null;
    }
}

// ── PKCE Helpers ─────────────────────────────────────────────────────────────

/**
 * Generate a PKCE code verifier (high-entropy random string).
 */
export function generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString("base64url");
}

/**
 * Generate a PKCE code challenge from a code verifier (SHA-256 hash, base64url).
 */
export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = crypto.createHash("sha256").update(data).digest();
    return Buffer.from(digest).toString("base64url");
}

// ── Authorization URL ────────────────────────────────────────────────────────

/**
 * Build the MCP OAuth2.1 authorization URL with PKCE.
 *
 * @param metadata - The authorization server metadata from discovery
 * @param clientId - The OAuth client ID (from provider configJson or dynamic registration)
 * @param redirectUri - The callback URL (our /api/integrations/mcp-oauth/callback)
 * @param scopes - Optional scopes to request
 * @returns The authorization URL, state, and code verifier
 */
export async function buildMcpAuthorizationUrl(options: {
    metadata: McpAuthServerMetadata;
    clientId: string;
    redirectUri: string;
    scopes?: string[];
    extraParams?: Record<string, string>;
}): Promise<McpOAuthStartResult> {
    const { metadata, clientId, redirectUri, scopes, extraParams } = options;

    const state = crypto.randomBytes(16).toString("hex");
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256"
    });

    if (scopes && scopes.length > 0) {
        params.set("scope", scopes.join(" "));
    }

    // Add any extra provider-specific params
    if (extraParams) {
        for (const [key, value] of Object.entries(extraParams)) {
            params.set(key, value);
        }
    }

    const authorizationUrl = `${metadata.authorization_endpoint}?${params.toString()}`;

    return {
        authorizationUrl,
        state,
        codeVerifier,
        metadata
    };
}

// ── Token Exchange ───────────────────────────────────────────────────────────

/**
 * Exchange an authorization code for tokens at the MCP server's token endpoint.
 */
export async function exchangeMcpCodeForTokens(options: {
    metadata: McpAuthServerMetadata;
    code: string;
    codeVerifier: string;
    clientId: string;
    clientSecret?: string;
    redirectUri: string;
}): Promise<McpOAuthTokens> {
    const { metadata, code, codeVerifier, clientId, clientSecret, redirectUri } = options;

    const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: codeVerifier
    });

    if (clientSecret) {
        body.set("client_secret", clientSecret);
    }

    const response = await fetch(metadata.token_endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "unknown error");
        throw new Error(
            `MCP OAuth token exchange failed: ${response.status} ${response.statusText} - ${errorText}`
        );
    }

    const data = (await response.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        token_type?: string;
        scope?: string;
    };

    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
        tokenType: data.token_type || "Bearer",
        scope: data.scope
    };
}

// ── Token Refresh ────────────────────────────────────────────────────────────

/**
 * Refresh an access token using the refresh token.
 */
export async function refreshMcpAccessToken(options: {
    tokenEndpoint: string;
    refreshToken: string;
    clientId: string;
    clientSecret?: string;
}): Promise<McpOAuthTokens> {
    const { tokenEndpoint, refreshToken, clientId, clientSecret } = options;

    const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId
    });

    if (clientSecret) {
        body.set("client_secret", clientSecret);
    }

    const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "unknown error");
        throw new Error(
            `MCP OAuth token refresh failed: ${response.status} ${response.statusText} - ${errorText}`
        );
    }

    const data = (await response.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        token_type?: string;
        scope?: string;
    };

    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken, // Keep old refresh token if not rotated
        expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
        tokenType: data.token_type || "Bearer",
        scope: data.scope
    };
}

// ── Token Validity Check ─────────────────────────────────────────────────────

/**
 * Check if tokens need refreshing (within 5-minute buffer).
 */
export function tokenNeedsRefresh(tokens: McpOAuthTokens): boolean {
    if (!tokens.expiresAt) return false;
    const BUFFER_MS = 5 * 60 * 1000; // 5 minutes
    return Date.now() > tokens.expiresAt - BUFFER_MS;
}

/**
 * Check if tokens are fully expired (no buffer).
 */
export function tokenIsExpired(tokens: McpOAuthTokens): boolean {
    if (!tokens.expiresAt) return false;
    return Date.now() > tokens.expiresAt;
}
