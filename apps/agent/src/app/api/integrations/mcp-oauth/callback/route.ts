/**
 * MCP OAuth2.1 Callback Route
 *
 * GET /api/integrations/mcp-oauth/callback?code=<code>&state=<state>
 *
 * Handles the OAuth2.1 callback from MCP servers. Exchanges the authorization
 * code for tokens, encrypts and stores them in IntegrationConnection, and
 * triggers the auto-provisioner.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@repo/database";
import { resetMcpClients, invalidateMcpCacheForOrg } from "@repo/agentc2/mcp";
import { invalidateMcpToolsCacheForOrg } from "@repo/agentc2/tools";
import { exchangeMcpCodeForTokens } from "@repo/agentc2/integrations/mcp-oauth";
import {
    validateOAuthState,
    getOAuthStateCookieName,
    consumeReturnUrlCookie
} from "@/lib/oauth-security";
import { encryptCredentials } from "@/lib/credential-crypto";

function getMcpOAuthRedirectUri(): string {
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    return `${base}/api/integrations/mcp-oauth/callback`;
}

function getSetupPageUrl(): string {
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    return `${base}/mcp/setup`;
}

export async function GET(request: NextRequest) {
    const cookieStore = await cookies();
    const customReturn = consumeReturnUrlCookie(cookieStore);

    const buildRedirectUrl = () => {
        if (customReturn) {
            return new URL(customReturn, request.url);
        }
        return new URL(getSetupPageUrl());
    };

    const setupUrl = buildRedirectUrl();

    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get("code");
        const stateParam = searchParams.get("state");
        const errorParam = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");

        // 1. Handle OAuth errors from provider
        if (errorParam) {
            console.error(
                `[MCP OAuth Callback] Error from provider: ${errorParam} - ${errorDescription}`
            );
            setupUrl.searchParams.set("error", errorDescription || errorParam);
            return NextResponse.redirect(setupUrl);
        }

        if (!code) {
            setupUrl.searchParams.set("error", "No authorization code received");
            return NextResponse.redirect(setupUrl);
        }

        // 2. Validate state (CSRF protection + PKCE verifier extraction)
        const cookieValue = cookieStore.get(getOAuthStateCookieName())?.value;

        let validatedState;
        try {
            validatedState = validateOAuthState(cookieValue, stateParam);
        } catch (stateError) {
            console.error("[MCP OAuth Callback] State validation failed:", stateError);
            setupUrl.searchParams.set(
                "error",
                stateError instanceof Error ? stateError.message : "State validation failed"
            );
            return NextResponse.redirect(setupUrl);
        }

        const { organizationId, userId, providerKey, codeVerifier } = validatedState;

        // 3. Get token endpoint from metadata cookie
        const metaCookieValue = cookieStore.get("__mcp_oauth_meta")?.value;
        if (!metaCookieValue) {
            setupUrl.searchParams.set("error", "MCP OAuth metadata cookie missing");
            return NextResponse.redirect(setupUrl);
        }

        let meta: {
            tokenEndpoint: string;
            hostedMcpUrl: string;
            providerKey: string;
            oauthClientId: string;
        };
        try {
            meta = JSON.parse(metaCookieValue);
        } catch {
            setupUrl.searchParams.set("error", "Invalid MCP OAuth metadata");
            return NextResponse.redirect(setupUrl);
        }

        // 4. Clear state cookies
        cookieStore.delete(getOAuthStateCookieName());
        cookieStore.delete("__mcp_oauth_meta");

        // 5. Look up the provider
        const provider = await prisma.integrationProvider.findFirst({
            where: { key: providerKey }
        });
        if (!provider) {
            setupUrl.searchParams.set("error", `Provider not found: ${providerKey}`);
            return NextResponse.redirect(setupUrl);
        }

        // 6. Extract client secret if configured
        const configJson =
            provider.configJson && typeof provider.configJson === "object"
                ? (provider.configJson as Record<string, unknown>)
                : null;
        const oauthClientSecret = configJson?.oauthClientSecret as string | undefined;

        // 7. Exchange code for tokens
        const tokens = await exchangeMcpCodeForTokens({
            metadata: {
                issuer: new URL(meta.hostedMcpUrl).origin,
                authorization_endpoint: "", // Not needed for exchange
                token_endpoint: meta.tokenEndpoint
            },
            code,
            codeVerifier,
            clientId: meta.oauthClientId,
            clientSecret: oauthClientSecret,
            redirectUri: getMcpOAuthRedirectUri()
        });

        // 8. Encrypt tokens for storage
        const encrypted = encryptCredentials({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken || null,
            expiresAt: tokens.expiresAt || null,
            tokenType: tokens.tokenType,
            scope: tokens.scope || null,
            // Store token endpoint for future refresh
            tokenEndpoint: meta.tokenEndpoint,
            oauthClientId: meta.oauthClientId
        });

        // 9. Upsert IntegrationConnection
        const existingConnection = await prisma.integrationConnection.findFirst({
            where: {
                organizationId,
                providerId: provider.id,
                scope: "org"
            }
        });

        let connectionId: string;
        if (existingConnection) {
            await prisma.integrationConnection.update({
                where: { id: existingConnection.id },
                data: {
                    credentials: encrypted ? JSON.parse(JSON.stringify(encrypted)) : null,
                    isActive: true,
                    errorMessage: null,
                    lastTestedAt: new Date()
                }
            });
            connectionId = existingConnection.id;
        } else {
            const created = await prisma.integrationConnection.create({
                data: {
                    providerId: provider.id,
                    organizationId,
                    userId,
                    scope: "org",
                    name: `${provider.name} (OAuth)`,
                    credentials: encrypted ? JSON.parse(JSON.stringify(encrypted)) : null,
                    isActive: true,
                    lastTestedAt: new Date()
                }
            });
            connectionId = created.id;
        }

        // 10. Invalidate MCP caches so the new connection is picked up
        resetMcpClients();
        invalidateMcpCacheForOrg(organizationId);
        invalidateMcpToolsCacheForOrg(organizationId);

        // 11. Auto-provision Skill + Agent
        try {
            const { provisionIntegration, hasBlueprint } = await import("@repo/agentc2");
            if (hasBlueprint(providerKey)) {
                const workspace = await prisma.workspace.findFirst({
                    where: { organizationId, isDefault: true },
                    select: { id: true }
                });
                if (workspace) {
                    const result = await provisionIntegration(connectionId, {
                        workspaceId: workspace.id,
                        userId
                    });
                    console.log(
                        `[MCP OAuth] Auto-provisioned ${providerKey}: ` +
                            `skill=${result.skillId || "none"}, ` +
                            `agent=${result.agentId || "none"}`
                    );
                }
            }
        } catch (provisionError) {
            console.error("[MCP OAuth] Auto-provisioning failed:", provisionError);
        }

        // 12. Redirect to setup page with success
        setupUrl.searchParams.set("success", "true");
        setupUrl.searchParams.set("provider", providerKey);
        return NextResponse.redirect(setupUrl);
    } catch (error) {
        console.error("[MCP OAuth Callback]", error);
        setupUrl.searchParams.set(
            "error",
            error instanceof Error ? error.message : "OAuth callback failed"
        );
        return NextResponse.redirect(setupUrl);
    }
}
