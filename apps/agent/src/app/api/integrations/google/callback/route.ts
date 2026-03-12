import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
    validateOAuthState,
    getOAuthStateCookieName,
    consumeReturnUrlCookie
} from "@/lib/oauth-security";
import {
    getGoogleClientCredentials,
    exchangeGoogleCodeForTokens,
    getGoogleUserEmail,
    getGoogleRedirectUri
} from "@/lib/google-oauth";
import { saveGmailCredentials, syncSiblingGoogleConnections } from "@/lib/gmail";

/**
 * GET /api/integrations/google/callback
 *
 * OAuth callback from Google. Validates state, exchanges code for tokens,
 * creates/updates IntegrationConnection records for Gmail + siblings
 * (Calendar, Drive, Search Console), then redirects to setup page.
 *
 * This bypasses Better Auth entirely — tokens go directly into
 * IntegrationConnection (org-scoped), not the Account table.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const stateParam = searchParams.get("state");
    const errorParam = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    const cookieStore = await cookies();

    const customReturn = consumeReturnUrlCookie(cookieStore);
    const appBase = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    const setupUrl = new URL(customReturn || "/mcp/gmail", appBase);

    if (errorParam) {
        const msg =
            errorDescription || errorParam === "access_denied"
                ? "Google OAuth was cancelled or denied."
                : `Google OAuth error: ${errorParam}`;
        setupUrl.searchParams.set("error", msg);
        return NextResponse.redirect(setupUrl);
    }

    if (!code) {
        setupUrl.searchParams.set("error", "Missing authorization code from Google.");
        return NextResponse.redirect(setupUrl);
    }

    try {
        const cookieName = getOAuthStateCookieName();
        const cookieValue = cookieStore.get(cookieName)?.value;

        const { organizationId, codeVerifier } = validateOAuthState(cookieValue, stateParam);

        cookieStore.delete(cookieName);

        const credentials = getGoogleClientCredentials();
        const redirectUri = getGoogleRedirectUri();

        const tokens = await exchangeGoogleCodeForTokens({
            code,
            codeVerifier,
            redirectUri,
            credentials
        });

        const gmailAddress = await getGoogleUserEmail(tokens.accessToken);

        const tokenPayload = {
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
            expiry_date: tokens.expiresAt,
            scope: tokens.scope
        };

        await saveGmailCredentials(organizationId, gmailAddress, tokenPayload);

        try {
            await syncSiblingGoogleConnections(organizationId, gmailAddress, tokenPayload);
        } catch (err) {
            console.warn(
                "[Google OAuth] Sibling sync failed (non-fatal):",
                err instanceof Error ? err.message : err
            );
        }

        setupUrl.searchParams.set("success", "true");
        return NextResponse.redirect(setupUrl);
    } catch (error) {
        console.error("[Google OAuth Callback] Error:", error);
        setupUrl.searchParams.set(
            "error",
            error instanceof Error ? error.message : "Failed to complete Google OAuth"
        );
        return NextResponse.redirect(setupUrl);
    }
}
