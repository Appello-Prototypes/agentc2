/**
 * Microsoft OAuth Helper
 *
 * Shared OAuth2 helper for Microsoft Graph (Outlook Mail + Calendar).
 * Uses raw fetch (no MSAL SDK dependency).
 *
 * Features:
 * - Authorization URL with PKCE + state
 * - Token exchange (code → tokens)
 * - Token refresh with interaction_required / invalid_grant handling
 * - Graph API client factory with auto-refresh
 * - Per-org OAuth app credential override support
 */

import { prisma } from "@repo/database";
import { encryptCredentials, decryptCredentials } from "@/lib/credential-crypto";

// ── Constants ──────────────────────────────────────────────────────

const DEFAULT_TENANT = "common";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

const DEFAULT_SCOPES = [
    "Mail.Read",
    "Mail.ReadWrite",
    "Mail.Send",
    "Calendars.Read",
    "Calendars.ReadWrite",
    "offline_access",
    "User.Read"
];

// ── Types ──────────────────────────────────────────────────────────

export type MicrosoftTokens = {
    accessToken: string;
    refreshToken?: string;
    expiresAt: number; // Unix timestamp in ms
    scope?: string;
    tokenType?: string;
    email?: string; // User principal name / email
};

export type MicrosoftClientCredentials = {
    clientId: string;
    clientSecret: string;
    tenantId: string;
};

type TokenResponse = {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
    token_type?: string;
};

type TokenErrorResponse = {
    error: string;
    error_description?: string;
    error_codes?: number[];
    correlation_id?: string;
};

// ── Credential Resolution ──────────────────────────────────────────

/**
 * Get Microsoft OAuth client credentials, checking connection metadata
 * first (per-org override) then falling back to environment variables.
 */
export function getMicrosoftClientCredentials(
    connectionMetadata?: Record<string, unknown> | null
): MicrosoftClientCredentials {
    const meta = connectionMetadata || {};
    const clientId =
        (typeof meta.microsoftClientId === "string" && meta.microsoftClientId) ||
        process.env.MICROSOFT_CLIENT_ID;
    const clientSecret =
        (typeof meta.microsoftClientSecret === "string" && meta.microsoftClientSecret) ||
        process.env.MICROSOFT_CLIENT_SECRET;
    const tenantId =
        (typeof meta.microsoftTenantId === "string" && meta.microsoftTenantId) ||
        process.env.MICROSOFT_TENANT_ID ||
        DEFAULT_TENANT;

    if (!clientId || !clientSecret) {
        throw new Error(
            "Microsoft OAuth not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET."
        );
    }

    return { clientId, clientSecret, tenantId };
}

// ── URL Builders ───────────────────────────────────────────────────

function getAuthorizationEndpoint(tenantId: string): string {
    return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`;
}

function getTokenEndpoint(tenantId: string): string {
    return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
}

/**
 * Build Microsoft OAuth authorization URL.
 */
export function buildAuthorizationUrl(params: {
    clientId: string;
    tenantId: string;
    redirectUri: string;
    state: string;
    codeChallenge: string;
    scopes?: string[];
}): string {
    const { clientId, tenantId, redirectUri, state, codeChallenge, scopes } = params;
    const scopeString = (scopes || DEFAULT_SCOPES).join(" ");
    const url = new URL(getAuthorizationEndpoint(tenantId));

    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", scopeString);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("response_mode", "query");
    url.searchParams.set("prompt", "consent");

    return url.toString();
}

// ── Token Exchange ─────────────────────────────────────────────────

/**
 * Exchange authorization code for tokens.
 */
export async function exchangeCodeForTokens(params: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
    credentials: MicrosoftClientCredentials;
}): Promise<MicrosoftTokens> {
    const { code, codeVerifier, redirectUri, credentials } = params;

    const body = new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: codeVerifier
    });

    const response = await fetch(getTokenEndpoint(credentials.tenantId), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString()
    });

    if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as TokenErrorResponse;
        const msg = errorData.error_description || errorData.error || `HTTP ${response.status}`;
        throw new Error(`Microsoft token exchange failed: ${msg}`);
    }

    const data = (await response.json()) as TokenResponse;

    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
        scope: data.scope,
        tokenType: data.token_type
    };
}

// ── Token Refresh ──────────────────────────────────────────────────

/**
 * Errors that indicate the refresh token is permanently invalid.
 * User must re-authenticate.
 */
const PERMANENT_REFRESH_ERRORS = [
    "invalid_grant",
    "interaction_required",
    "consent_required",
    "login_required"
];

export function isRefreshPermanentlyFailed(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;
    const msg = (error as { message?: string }).message || "";
    return PERMANENT_REFRESH_ERRORS.some((code) => msg.toLowerCase().includes(code));
}

/**
 * Refresh an expired access token.
 */
export async function refreshAccessToken(params: {
    refreshToken: string;
    credentials: MicrosoftClientCredentials;
}): Promise<MicrosoftTokens> {
    const { refreshToken, credentials } = params;

    const body = new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
        scope: DEFAULT_SCOPES.join(" ")
    });

    const response = await fetch(getTokenEndpoint(credentials.tenantId), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString()
    });

    if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as TokenErrorResponse;
        const msg = errorData.error_description || errorData.error || `HTTP ${response.status}`;
        throw new Error(`Microsoft token refresh failed: ${msg}`);
    }

    const data = (await response.json()) as TokenResponse;

    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken, // Keep old if not returned
        expiresAt: Date.now() + data.expires_in * 1000,
        scope: data.scope,
        tokenType: data.token_type
    };
}

// ── Connection Helpers ─────────────────────────────────────────────

/**
 * Load and decrypt Microsoft tokens from an IntegrationConnection.
 */
export async function loadMicrosoftTokens(
    connectionId: string
): Promise<{ tokens: MicrosoftTokens; connectionMetadata: Record<string, unknown> | null }> {
    const connection = await prisma.integrationConnection.findUnique({
        where: { id: connectionId }
    });

    if (!connection || !connection.isActive) {
        throw new Error("Microsoft connection not found or inactive");
    }

    const decrypted = decryptCredentials(connection.credentials);
    if (!decrypted || typeof decrypted !== "object" || Array.isArray(decrypted)) {
        throw new Error("Failed to decrypt Microsoft credentials");
    }

    const creds = decrypted as Record<string, unknown>;
    const tokens: MicrosoftTokens = {
        accessToken: (creds.accessToken as string) || "",
        refreshToken: creds.refreshToken as string | undefined,
        expiresAt: (creds.expiresAt as number) || 0,
        scope: creds.scope as string | undefined,
        email: creds.email as string | undefined
    };

    const connectionMetadata =
        connection.metadata && typeof connection.metadata === "object"
            ? (connection.metadata as Record<string, unknown>)
            : null;

    return { tokens, connectionMetadata };
}

/**
 * Save (encrypted) tokens back to an IntegrationConnection.
 */
export async function saveMicrosoftTokens(
    connectionId: string,
    tokens: MicrosoftTokens
): Promise<void> {
    const connection = await prisma.integrationConnection.findUnique({
        where: { id: connectionId }
    });

    const existingCreds =
        connection?.credentials && typeof connection.credentials === "object"
            ? (decryptCredentials(connection.credentials) as Record<string, unknown>)
            : {};

    const merged = {
        ...existingCreds,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken || existingCreds?.refreshToken,
        expiresAt: tokens.expiresAt,
        scope: tokens.scope || existingCreds?.scope,
        tokenType: tokens.tokenType || existingCreds?.tokenType,
        email: tokens.email || existingCreds?.email
    };

    const encrypted = encryptCredentials(merged);

    await prisma.integrationConnection.update({
        where: { id: connectionId },
        data: {
            credentials: encrypted ? JSON.parse(JSON.stringify(encrypted)) : null,
            lastUsedAt: new Date(),
            errorMessage: null,
            isActive: true
        }
    });
}

// ── Graph API Client ───────────────────────────────────────────────

/**
 * Call Microsoft Graph API with automatic token refresh.
 *
 * On 401: attempts token refresh and retries once.
 * On permanent refresh failure: marks connection inactive.
 */
export async function callGraphApi<T = unknown>(params: {
    connectionId: string;
    path: string;
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
}): Promise<T> {
    const { connectionId, path, method = "GET", body, headers: extraHeaders } = params;

    const makeRequest = async (accessToken: string): Promise<Response> => {
        const url = path.startsWith("http") ? path : `${GRAPH_BASE}${path}`;
        const headers: Record<string, string> = {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            ...extraHeaders
        };
        return fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });
    };

    // Load tokens
    const { tokens, connectionMetadata } = await loadMicrosoftTokens(connectionId);
    const credentials = getMicrosoftClientCredentials(connectionMetadata);

    // Check if token is expired (with 5-min buffer)
    const isExpired = Date.now() > tokens.expiresAt - 5 * 60 * 1000;

    let accessToken = tokens.accessToken;

    // Pre-emptively refresh if expired
    if (isExpired && tokens.refreshToken) {
        try {
            const newTokens = await refreshAccessToken({
                refreshToken: tokens.refreshToken,
                credentials
            });
            newTokens.email = tokens.email;
            await saveMicrosoftTokens(connectionId, newTokens);
            accessToken = newTokens.accessToken;
        } catch (refreshError) {
            if (isRefreshPermanentlyFailed(refreshError)) {
                await prisma.integrationConnection.update({
                    where: { id: connectionId },
                    data: {
                        isActive: false,
                        errorMessage: `Token refresh failed: ${(refreshError as Error).message}. Re-authentication required.`
                    }
                });
            }
            throw refreshError;
        }
    }

    // Make the request
    let response = await makeRequest(accessToken);

    // Retry on 401 with token refresh
    if (response.status === 401 && tokens.refreshToken) {
        try {
            const newTokens = await refreshAccessToken({
                refreshToken: tokens.refreshToken,
                credentials
            });
            newTokens.email = tokens.email;
            await saveMicrosoftTokens(connectionId, newTokens);
            response = await makeRequest(newTokens.accessToken);
        } catch (refreshError) {
            if (isRefreshPermanentlyFailed(refreshError)) {
                await prisma.integrationConnection.update({
                    where: { id: connectionId },
                    data: {
                        isActive: false,
                        errorMessage: `Token refresh failed: ${(refreshError as Error).message}. Re-authentication required.`
                    }
                });
            }
            throw refreshError;
        }
    }

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`Graph API ${method} ${path} failed (${response.status}): ${errorText}`);
    }

    // Some endpoints return 204 No Content
    if (response.status === 204) {
        return {} as T;
    }

    return (await response.json()) as T;
}

/**
 * Get the user's profile (email, display name) from Graph.
 */
export async function getMicrosoftUserProfile(connectionId: string): Promise<{
    email: string;
    displayName: string;
}> {
    const profile = await callGraphApi<{
        mail?: string;
        userPrincipalName?: string;
        displayName?: string;
    }>({
        connectionId,
        path: "/me"
    });

    return {
        email: profile.mail || profile.userPrincipalName || "",
        displayName: profile.displayName || ""
    };
}

/**
 * Get the redirect URI for the Microsoft OAuth callback.
 */
export function getMicrosoftRedirectUri(): string {
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    // In production (behind Caddy), routes include /agent basePath
    // In development, no basePath
    const isProduction = process.env.NODE_ENV === "production";
    const prefix = isProduction ? "/agent" : "";
    return `${base}${prefix}/api/integrations/microsoft/callback`;
}
