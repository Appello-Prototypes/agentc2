/**
 * MCP OAuth2.1 Start Route
 *
 * GET /api/integrations/mcp-oauth/start?provider=<providerKey>
 *
 * Discovers the MCP server's OAuth2.1 authorization server metadata,
 * generates PKCE state, and redirects the user to authorize.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { headers } from "next/headers";
import { discoverAuthServer, buildMcpAuthorizationUrl } from "@repo/mastra/integrations/mcp-oauth";
import { generateOAuthState, getOAuthStateCookieName } from "@/lib/oauth-security";
import { getUserOrganizationId } from "@/lib/organization";

function getMcpOAuthRedirectUri(): string {
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    const isProduction = process.env.NODE_ENV === "production";
    const prefix = isProduction ? "/agent" : "";
    return `${base}${prefix}/api/integrations/mcp-oauth/callback`;
}

export async function GET(request: NextRequest) {
    try {
        // 1. Authenticate
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const organizationId = await getUserOrganizationId(session.user.id);
        if (!organizationId) {
            return NextResponse.json({ error: "No organization found" }, { status: 400 });
        }

        // 2. Get provider key from query params
        const { searchParams } = new URL(request.url);
        const providerKey = searchParams.get("provider");
        if (!providerKey) {
            return NextResponse.json(
                { error: "provider query param is required" },
                { status: 400 }
            );
        }

        // 3. Look up the provider
        const provider = await prisma.integrationProvider.findFirst({
            where: { key: providerKey }
        });
        if (!provider) {
            return NextResponse.json(
                { error: `Provider not found: ${providerKey}` },
                { status: 404 }
            );
        }

        // 4. Extract MCP URL and OAuth config from configJson
        const configJson =
            provider.configJson && typeof provider.configJson === "object"
                ? (provider.configJson as Record<string, unknown>)
                : null;

        const hostedMcpUrl = configJson?.hostedMcpUrl as string | undefined;
        if (!hostedMcpUrl) {
            return NextResponse.json(
                { error: `Provider ${providerKey} has no hostedMcpUrl` },
                { status: 400 }
            );
        }

        // 5. Check for provider-specific OAuth client ID
        const oauthClientId = (configJson?.oauthClientId as string) || providerKey;
        const oauthScopes = (configJson?.oauthScopes as string[]) || [];

        // 6. Discover the auth server metadata
        const metadata = await discoverAuthServer(hostedMcpUrl);
        if (!metadata) {
            return NextResponse.json(
                {
                    error: `Could not discover OAuth metadata for ${providerKey}. The MCP server may not support OAuth2.1.`
                },
                { status: 502 }
            );
        }

        // 7. Generate PKCE state using our existing security module
        const { state, codeChallenge, codeVerifier, cookieValue, cookieName } = generateOAuthState({
            organizationId,
            userId: session.user.id,
            providerKey
        });

        // 8. Build the authorization URL
        const { authorizationUrl } = await buildMcpAuthorizationUrl({
            metadata,
            clientId: oauthClientId,
            redirectUri: getMcpOAuthRedirectUri(),
            scopes: oauthScopes
        });

        // Override with our own state + code_challenge (from our security module)
        const authUrl = new URL(authorizationUrl);
        authUrl.searchParams.set("state", state);
        authUrl.searchParams.set("code_challenge", codeChallenge);
        authUrl.searchParams.set("code_challenge_method", "S256");

        // 9. Store metadata in cookie for the callback
        // We extend the cookie value to include the token endpoint
        const cookieStore = await cookies();
        cookieStore.set(cookieName, cookieValue, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 600, // 10 minutes
            path: "/"
        });

        // Store the token endpoint separately (needed in callback)
        cookieStore.set(
            "__mcp_oauth_meta",
            JSON.stringify({
                tokenEndpoint: metadata.token_endpoint,
                hostedMcpUrl,
                providerKey,
                oauthClientId
            }),
            {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: 600,
                path: "/"
            }
        );

        // 10. Redirect to the authorization server
        return NextResponse.redirect(authUrl.toString());
    } catch (error) {
        console.error("[MCP OAuth Start]", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Failed to start MCP OAuth flow"
            },
            { status: 500 }
        );
    }
}
