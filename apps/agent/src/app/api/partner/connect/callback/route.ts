import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@repo/database";
import { getIntegrationProviders } from "@repo/agentc2/mcp";
import { validateOAuthState, getOAuthStateCookieName } from "@/lib/oauth-security";
import { encryptCredentials } from "@/lib/credential-crypto";
import {
    getMicrosoftClientCredentials,
    exchangeCodeForTokens,
    getMicrosoftUserProfile,
    saveMicrosoftTokens
} from "@/lib/microsoft-oauth";

/**
 * GET /api/partner/connect/callback?code=...&state=...
 *
 * Shared OAuth callback for partner-embedded users.
 * Validates the state cookie (same as standard OAuth), exchanges the code,
 * and creates a USER-SCOPED IntegrationConnection (not org-scoped).
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const stateParam = searchParams.get("state");
    const errorParam = searchParams.get("error");

    const successUrl = new URL("/connect/success", request.url);
    const errorUrl = new URL("/connect/success", request.url);

    if (errorParam) {
        errorUrl.searchParams.set("error", "OAuth was cancelled or denied.");
        return NextResponse.redirect(errorUrl);
    }

    if (!code) {
        errorUrl.searchParams.set("error", "Missing authorization code.");
        return NextResponse.redirect(errorUrl);
    }

    try {
        const cookieStore = await cookies();
        const cookieName = getOAuthStateCookieName();
        const cookieValue = cookieStore.get(cookieName)?.value;

        const { organizationId, userId, providerKey, codeVerifier } = validateOAuthState(
            cookieValue,
            stateParam
        );

        cookieStore.delete(cookieName);

        // Ensure provider exists
        await getIntegrationProviders();
        const provider = await prisma.integrationProvider.findUnique({
            where: { key: providerKey }
        });

        if (!provider) {
            errorUrl.searchParams.set("error", `${providerKey} provider not configured.`);
            return NextResponse.redirect(errorUrl);
        }

        if (providerKey === "gmail") {
            // Exchange code using the same redirect URI as the start route
            const callbackUrl = new URL("/api/partner/connect/callback", request.url).toString();
            const clientId = process.env.GOOGLE_CLIENT_ID || process.env.GMAIL_OAUTH_CLIENT_ID;
            const clientSecret =
                process.env.GOOGLE_CLIENT_SECRET || process.env.GMAIL_OAUTH_CLIENT_SECRET;
            if (!clientId || !clientSecret) {
                errorUrl.searchParams.set("error", "Google OAuth not configured.");
                return NextResponse.redirect(errorUrl);
            }

            const client = new OAuth2Client(clientId, clientSecret, callbackUrl);
            const { tokens: rawTokens } = await client.getToken(code);
            client.setCredentials(rawTokens);

            const gmail = google.gmail({ version: "v1", auth: client });
            const profile = await gmail.users.getProfile({ userId: "me" });
            const gmailAddress = profile.data.emailAddress || "unknown";

            const tokens = rawTokens;

            const encrypted = encryptCredentials({
                gmailAddress,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiryDate: tokens.expiry_date,
                scope: tokens.scope,
                tokenType: tokens.token_type
            });

            // Create or update a USER-SCOPED connection
            const existing = await prisma.integrationConnection.findFirst({
                where: {
                    organizationId,
                    providerId: provider.id,
                    scope: "user",
                    userId
                }
            });

            if (existing) {
                await prisma.integrationConnection.update({
                    where: { id: existing.id },
                    data: {
                        credentials: encrypted ? JSON.parse(JSON.stringify(encrypted)) : null,
                        isActive: true,
                        errorMessage: null,
                        name: `Gmail (${gmailAddress})`,
                        metadata: { gmailAddress }
                    }
                });
            } else {
                await prisma.integrationConnection.create({
                    data: {
                        providerId: provider.id,
                        organizationId,
                        userId,
                        scope: "user",
                        name: `Gmail (${gmailAddress})`,
                        isDefault: false,
                        isActive: true,
                        credentials: encrypted ? JSON.parse(JSON.stringify(encrypted)) : null,
                        metadata: { gmailAddress }
                    }
                });
            }

            successUrl.searchParams.set("provider", "Gmail");
            successUrl.searchParams.set("account", gmailAddress);
            return NextResponse.redirect(successUrl);
        }

        if (providerKey === "microsoft") {
            const credentials = getMicrosoftClientCredentials();
            const redirectUri = new URL("/api/partner/connect/callback", request.url).toString();

            const tokens = await exchangeCodeForTokens({
                code,
                codeVerifier,
                redirectUri,
                credentials
            });

            const encrypted = encryptCredentials({
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresAt: tokens.expiresAt,
                scope: tokens.scope,
                tokenType: tokens.tokenType
            });

            const existing = await prisma.integrationConnection.findFirst({
                where: {
                    organizationId,
                    providerId: provider.id,
                    scope: "user",
                    userId
                }
            });

            let connectionId: string;

            if (existing) {
                await prisma.integrationConnection.update({
                    where: { id: existing.id },
                    data: {
                        credentials: encrypted ? JSON.parse(JSON.stringify(encrypted)) : null,
                        isActive: true,
                        errorMessage: null
                    }
                });
                connectionId = existing.id;
            } else {
                const conn = await prisma.integrationConnection.create({
                    data: {
                        providerId: provider.id,
                        organizationId,
                        userId,
                        scope: "user",
                        name: "Microsoft (Outlook)",
                        isDefault: false,
                        isActive: true,
                        credentials: encrypted ? JSON.parse(JSON.stringify(encrypted)) : null,
                        metadata: {}
                    }
                });
                connectionId = conn.id;
            }

            // Resolve user profile to store email
            let email = "Outlook";
            try {
                const profile = await getMicrosoftUserProfile(connectionId);
                email = profile.email || "Outlook";
                tokens.email = profile.email;
                await saveMicrosoftTokens(connectionId, tokens);

                await prisma.integrationConnection.update({
                    where: { id: connectionId },
                    data: {
                        name: `Microsoft (${email})`,
                        metadata: { email: profile.email, displayName: profile.displayName }
                    }
                });
            } catch {
                // Profile fetch is best-effort
            }

            successUrl.searchParams.set("provider", "Microsoft");
            successUrl.searchParams.set("account", email);
            return NextResponse.redirect(successUrl);
        }

        errorUrl.searchParams.set("error", "Unsupported provider.");
        return NextResponse.redirect(errorUrl);
    } catch (error) {
        console.error("[Partner Connect Callback] Error:", error);
        errorUrl.searchParams.set(
            "error",
            error instanceof Error ? error.message : "Failed to complete OAuth"
        );
        return NextResponse.redirect(errorUrl);
    }
}
