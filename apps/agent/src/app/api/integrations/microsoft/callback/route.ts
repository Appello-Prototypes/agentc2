import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@repo/database";
import { getIntegrationProviders } from "@repo/mastra";
import { validateOAuthState, getOAuthStateCookieName } from "@/lib/oauth-security";
import { encryptCredentials } from "@/lib/credential-crypto";
import {
    getMicrosoftClientCredentials,
    exchangeCodeForTokens,
    getMicrosoftRedirectUri,
    getMicrosoftUserProfile,
    saveMicrosoftTokens
} from "@/lib/microsoft-oauth";

/**
 * GET /api/integrations/microsoft/callback
 *
 * OAuth callback from Microsoft. Validates state, exchanges code
 * for tokens, creates/updates IntegrationConnection, resolves
 * user profile (email), then redirects to setup page.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const stateParam = searchParams.get("state");
    const errorParam = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    // Determine redirect target for success/error
    const setupUrl = new URL("/mcp/microsoft", request.url);

    if (errorParam) {
        const msg =
            errorDescription || errorParam === "access_denied"
                ? "Microsoft OAuth was cancelled or denied."
                : `Microsoft OAuth error: ${errorParam}`;
        setupUrl.searchParams.set("error", msg);
        return NextResponse.redirect(setupUrl);
    }

    if (!code) {
        setupUrl.searchParams.set("error", "Missing authorization code from Microsoft.");
        return NextResponse.redirect(setupUrl);
    }

    try {
        // Validate CSRF state
        const cookieStore = await cookies();
        const cookieName = getOAuthStateCookieName();
        const cookieValue = cookieStore.get(cookieName)?.value;

        const { organizationId, userId, codeVerifier } = validateOAuthState(
            cookieValue,
            stateParam
        );

        // Clear the state cookie
        cookieStore.delete(cookieName);

        // Exchange code for tokens
        const credentials = getMicrosoftClientCredentials();
        const redirectUri = getMicrosoftRedirectUri();

        const tokens = await exchangeCodeForTokens({
            code,
            codeVerifier,
            redirectUri,
            credentials
        });

        // Ensure provider exists
        await getIntegrationProviders();
        const provider = await prisma.integrationProvider.findUnique({
            where: { key: "microsoft" }
        });

        if (!provider) {
            setupUrl.searchParams.set("error", "Microsoft provider not configured.");
            return NextResponse.redirect(setupUrl);
        }

        // Create or update IntegrationConnection
        const encrypted = encryptCredentials({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.expiresAt,
            scope: tokens.scope,
            tokenType: tokens.tokenType
        });

        // Check for existing connection for this org
        const existing = await prisma.integrationConnection.findFirst({
            where: {
                organizationId,
                providerId: provider.id,
                scope: "org"
            }
        });

        let connectionId: string;

        if (existing) {
            await prisma.integrationConnection.update({
                where: { id: existing.id },
                data: {
                    credentials: encrypted ? JSON.parse(JSON.stringify(encrypted)) : null,
                    isActive: true,
                    errorMessage: null,
                    userId
                }
            });
            connectionId = existing.id;
        } else {
            // Ensure this is the default connection
            const connection = await prisma.integrationConnection.create({
                data: {
                    providerId: provider.id,
                    organizationId,
                    userId,
                    scope: "org",
                    name: "Microsoft (Outlook)",
                    isDefault: true,
                    isActive: true,
                    credentials: encrypted ? JSON.parse(JSON.stringify(encrypted)) : null,
                    metadata: {}
                }
            });
            connectionId = connection.id;
        }

        // Resolve user profile to store email
        try {
            const profile = await getMicrosoftUserProfile(connectionId);
            tokens.email = profile.email;
            await saveMicrosoftTokens(connectionId, tokens);

            await prisma.integrationConnection.update({
                where: { id: connectionId },
                data: {
                    name: `Microsoft (${profile.email || "Outlook"})`,
                    metadata: {
                        email: profile.email,
                        displayName: profile.displayName
                    }
                }
            });
        } catch {
            // Profile fetch is best-effort; tokens are already saved
        }

        setupUrl.searchParams.set("success", "true");
        return NextResponse.redirect(setupUrl);
    } catch (error) {
        console.error("[Microsoft OAuth Callback] Error:", error);
        setupUrl.searchParams.set(
            "error",
            error instanceof Error ? error.message : "Failed to complete Microsoft OAuth"
        );
        return NextResponse.redirect(setupUrl);
    }
}
