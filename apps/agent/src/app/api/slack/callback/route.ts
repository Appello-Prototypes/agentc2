import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@repo/database";
import { getIntegrationProviders } from "@repo/mastra";
import { validateOAuthState, getOAuthStateCookieName } from "@/lib/oauth-security";
import { encryptCredentials } from "@/lib/credential-crypto";

/**
 * GET /api/slack/callback
 *
 * OAuth V2 callback from Slack after a user authorizes the app.
 * Exchanges the authorization code for tokens, creates/updates
 * an IntegrationConnection for the org, and redirects back to the UI.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const stateParam = searchParams.get("state");
    const errorParam = searchParams.get("error");

    // Redirect destination after completion
    const setupUrl = new URL("/mcp/providers/slack", request.url);

    if (errorParam) {
        setupUrl.searchParams.set("error", `Slack OAuth error: ${errorParam}`);
        return NextResponse.redirect(setupUrl);
    }

    if (!code) {
        setupUrl.searchParams.set("error", "Missing authorization code from Slack.");
        return NextResponse.redirect(setupUrl);
    }

    try {
        // Validate CSRF state
        const cookieStore = await cookies();
        const cookieName = getOAuthStateCookieName();
        const cookieValue = cookieStore.get(cookieName)?.value;

        const { organizationId } = validateOAuthState(cookieValue, stateParam);

        cookieStore.delete(cookieName);

        // Exchange code for tokens via oauth.v2.access
        const clientId = process.env.SLACK_CLIENT_ID;
        const clientSecret = process.env.SLACK_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
            throw new Error("SLACK_CLIENT_ID or SLACK_CLIENT_SECRET not configured");
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
        const redirectUri = `${appUrl}/agent/api/slack/callback`;

        const tokenResponse = await fetch("https://slack.com/api/oauth.v2.access", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                redirect_uri: redirectUri
            })
        });

        const tokenData = (await tokenResponse.json()) as {
            ok: boolean;
            access_token?: string;
            refresh_token?: string;
            expires_in?: number;
            token_type?: string;
            scope?: string;
            bot_user_id?: string;
            app_id?: string;
            team?: { id: string; name: string };
            enterprise?: { id: string; name: string } | null;
            authed_user?: { id: string };
            is_enterprise_install?: boolean;
            error?: string;
        };

        if (!tokenData.ok || !tokenData.access_token) {
            throw new Error(`Slack token exchange failed: ${tokenData.error || "unknown error"}`);
        }

        // Ensure provider exists
        await getIntegrationProviders();
        const provider = await prisma.integrationProvider.findUnique({
            where: { key: "slack" }
        });

        if (!provider) {
            throw new Error("Slack provider not configured in database.");
        }

        // Encrypt credentials
        const encrypted = encryptCredentials({
            botToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token || null,
            botUserId: tokenData.bot_user_id || ""
        });

        // Build metadata (plaintext -- no secrets)
        const metadata = {
            teamId: tokenData.team?.id || "",
            teamName: tokenData.team?.name || "",
            enterpriseId: tokenData.enterprise?.id || null,
            enterpriseName: tokenData.enterprise?.name || null,
            isEnterpriseInstall: tokenData.is_enterprise_install || false,
            scope: tokenData.scope || "",
            appId: tokenData.app_id || "",
            installedBy: tokenData.authed_user?.id || "",
            tokenExpiresAt: tokenData.expires_in
                ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
                : null,
            defaultAgentSlug: "assistant",
            alertsChannelId: null
        };

        // Check if a connection already exists for this org + provider
        const existing = await prisma.integrationConnection.findFirst({
            where: {
                organizationId,
                providerId: provider.id,
                scope: "org"
            }
        });

        if (existing) {
            // Update existing connection (re-install)
            await prisma.integrationConnection.update({
                where: { id: existing.id },
                data: {
                    credentials: encrypted ? JSON.parse(JSON.stringify(encrypted)) : null,
                    metadata,
                    isActive: true,
                    errorMessage: null,
                    name: `Slack (${metadata.teamName || metadata.teamId})`
                }
            });
        } else {
            // Create new connection
            await prisma.integrationConnection.create({
                data: {
                    providerId: provider.id,
                    organizationId,
                    scope: "org",
                    name: `Slack (${metadata.teamName || metadata.teamId})`,
                    isDefault: true,
                    isActive: true,
                    credentials: encrypted ? JSON.parse(JSON.stringify(encrypted)) : null,
                    metadata
                }
            });
        }

        setupUrl.searchParams.set("success", "true");
        return NextResponse.redirect(setupUrl);
    } catch (error) {
        console.error("[Slack OAuth Callback] Error:", error);
        setupUrl.searchParams.set(
            "error",
            error instanceof Error ? error.message : "Failed to complete Slack OAuth"
        );
        return NextResponse.redirect(setupUrl);
    }
}
