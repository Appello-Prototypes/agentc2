/**
 * Google OAuth Helper
 *
 * Standalone OAuth2 helper for Google services (Gmail, Calendar, Drive,
 * Search Console). Uses raw fetch — no googleapis SDK dependency.
 *
 * This module mirrors the Microsoft OAuth helper pattern and bypasses
 * Better Auth's Account table entirely. Tokens are stored directly in
 * IntegrationConnection (org-scoped), allowing the same Google account
 * to be connected as an integration on multiple organizations.
 */

import { GOOGLE_OAUTH_SCOPES } from "@repo/auth/google-scopes";

// ── Constants ──────────────────────────────────────────────────────

const AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GMAIL_PROFILE_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/profile";

// ── Types ──────────────────────────────────────────────────────────

export type GoogleTokens = {
    accessToken: string;
    refreshToken?: string;
    expiresAt: number;
    scope?: string;
    tokenType?: string;
    gmailAddress?: string;
};

export type GoogleClientCredentials = {
    clientId: string;
    clientSecret: string;
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
};

// ── Credential Resolution ──────────────────────────────────────────

export function getGoogleClientCredentials(): GoogleClientCredentials {
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.GMAIL_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GMAIL_OAUTH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error(
            "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
        );
    }

    return { clientId, clientSecret };
}

// ── URL Builder ────────────────────────────────────────────────────

export function buildGoogleAuthorizationUrl(params: {
    clientId: string;
    redirectUri: string;
    state: string;
    codeChallenge: string;
    scopes?: readonly string[];
}): string {
    const { clientId, redirectUri, state, codeChallenge, scopes } = params;
    const scopeString = (scopes || GOOGLE_OAUTH_SCOPES).join(" ");
    const url = new URL(AUTHORIZATION_ENDPOINT);

    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", scopeString);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");

    return url.toString();
}

// ── Token Exchange ─────────────────────────────────────────────────

export async function exchangeGoogleCodeForTokens(params: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
    credentials: GoogleClientCredentials;
}): Promise<GoogleTokens> {
    const { code, codeVerifier, redirectUri, credentials } = params;

    const body = new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: codeVerifier
    });

    const response = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString()
    });

    if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as TokenErrorResponse;
        const msg = errorData.error_description || errorData.error || `HTTP ${response.status}`;
        throw new Error(`Google token exchange failed: ${msg}`);
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

// ── Profile Resolution ─────────────────────────────────────────────

/**
 * Resolve the authenticated user's Gmail address from the Gmail API.
 */
export async function getGoogleUserEmail(accessToken: string): Promise<string> {
    const response = await fetch(GMAIL_PROFILE_ENDPOINT, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
        throw new Error(`Gmail profile fetch failed (${response.status})`);
    }

    const data = (await response.json()) as { emailAddress?: string };
    if (!data.emailAddress) {
        throw new Error("Failed to resolve Gmail address from profile");
    }

    return data.emailAddress;
}

// ── Redirect URI ───────────────────────────────────────────────────

export function getGoogleRedirectUri(): string {
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    const isProduction = process.env.NODE_ENV === "production";
    const prefix = isProduction ? "/agent" : "";
    return `${base}${prefix}/api/integrations/google/callback`;
}
