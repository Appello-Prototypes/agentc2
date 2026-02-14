import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@repo/database";
import { getIntegrationProviders } from "@repo/mastra";
import { validateOAuthState, getOAuthStateCookieName } from "@/lib/oauth-security";
import { encryptCredentials } from "@/lib/credential-crypto";
import {
    getDropboxClientCredentials,
    exchangeDropboxCode,
    getDropboxRedirectUri,
    getAccountInfo,
    saveDropboxTokens,
    getLatestCursor
} from "@/lib/dropbox";

/**
 * GET /api/integrations/dropbox/callback
 *
 * OAuth callback from Dropbox.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const stateParam = searchParams.get("state");
    const errorParam = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    const setupUrl = new URL("/mcp/dropbox", request.url);

    if (errorParam) {
        const msg = errorDescription || `Dropbox OAuth error: ${errorParam}`;
        setupUrl.searchParams.set("error", msg);
        return NextResponse.redirect(setupUrl);
    }

    if (!code) {
        setupUrl.searchParams.set("error", "Missing authorization code from Dropbox.");
        return NextResponse.redirect(setupUrl);
    }

    try {
        const cookieStore = await cookies();
        const cookieName = getOAuthStateCookieName();
        const cookieValue = cookieStore.get(cookieName)?.value;

        const { organizationId, codeVerifier } = validateOAuthState(cookieValue, stateParam);

        cookieStore.delete(cookieName);

        const credentials = getDropboxClientCredentials();
        const redirectUri = getDropboxRedirectUri();

        const tokens = await exchangeDropboxCode({
            code,
            codeVerifier,
            redirectUri,
            credentials
        });

        // Ensure provider exists
        await getIntegrationProviders();
        const provider = await prisma.integrationProvider.findUnique({
            where: { key: "dropbox" }
        });

        if (!provider) {
            setupUrl.searchParams.set("error", "Dropbox provider not configured.");
            return NextResponse.redirect(setupUrl);
        }

        const encrypted = encryptCredentials({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.expiresAt,
            accountId: tokens.accountId,
            uid: tokens.uid,
            tokenType: tokens.tokenType
        });

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
                    errorMessage: null
                }
            });
            connectionId = existing.id;
        } else {
            const connection = await prisma.integrationConnection.create({
                data: {
                    providerId: provider.id,
                    organizationId,
                    scope: "org",
                    name: "Dropbox",
                    isDefault: true,
                    isActive: true,
                    credentials: encrypted ? JSON.parse(JSON.stringify(encrypted)) : null,
                    metadata: {
                        accountId: tokens.accountId
                    }
                }
            });
            connectionId = connection.id;
        }

        // Resolve account info and set up initial cursor
        try {
            const account = await getAccountInfo(connectionId);
            tokens.accountId = account.accountId;
            await saveDropboxTokens(connectionId, tokens);

            await prisma.integrationConnection.update({
                where: { id: connectionId },
                data: {
                    name: `Dropbox (${account.email || account.displayName})`,
                    metadata: {
                        accountId: account.accountId,
                        email: account.email,
                        displayName: account.displayName
                    }
                }
            });

            // Set up initial delta cursor for webhook change tracking
            const cursor = await getLatestCursor(connectionId);
            await prisma.webhookSubscription.upsert({
                where: {
                    integrationConnectionId_providerKey_resourcePath: {
                        integrationConnectionId: connectionId,
                        providerKey: "dropbox",
                        resourcePath: "/"
                    }
                },
                create: {
                    integrationConnectionId: connectionId,
                    providerKey: "dropbox",
                    cursor,
                    isActive: true
                },
                update: {
                    cursor,
                    isActive: true,
                    errorCount: 0,
                    errorMessage: null
                }
            });
        } catch {
            // Best-effort; tokens are already saved
        }

        // Auto-provision Skill + Agent if blueprint exists
        try {
            const { provisionIntegration, hasBlueprint } = await import("@repo/mastra");
            if (hasBlueprint("dropbox")) {
                const workspace = await prisma.workspace.findFirst({
                    where: { organizationId, isDefault: true },
                    select: { id: true }
                });
                if (workspace) {
                    const result = await provisionIntegration(connectionId, {
                        workspaceId: workspace.id
                    });
                    console.log(
                        `[Dropbox OAuth] Auto-provisioned: skill=${result.skillId || "none"}, ` +
                            `agent=${result.agentId || "none"}`
                    );
                }
            }
        } catch (provisionError) {
            console.error("[Dropbox OAuth] Auto-provisioning failed:", provisionError);
        }

        setupUrl.searchParams.set("success", "true");
        return NextResponse.redirect(setupUrl);
    } catch (error) {
        console.error("[Dropbox OAuth Callback] Error:", error);
        setupUrl.searchParams.set(
            "error",
            error instanceof Error ? error.message : "Failed to complete Dropbox OAuth"
        );
        return NextResponse.redirect(setupUrl);
    }
}
