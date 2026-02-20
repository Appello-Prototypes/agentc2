/**
 * Server-side Microsoft sync logic.
 *
 * Mirrors the Gmail sync pattern: after a user signs in with Microsoft SSO,
 * this module syncs the OAuth tokens from the Better Auth Account table into
 * IntegrationConnection records for Outlook Mail, Calendar, and Teams.
 */

import { prisma } from "@repo/database";
import { encryptCredentials, decryptCredentials } from "@/lib/credential-crypto";
import { MICROSOFT_REQUIRED_SCOPES, MICROSOFT_TEAMS_SCOPES } from "@repo/auth/microsoft-scopes";

const parseScopes = (scope?: string | null) =>
    new Set(
        (scope || "")
            .split(/[,\s]+/)
            .map((value) => value.trim())
            .filter(Boolean)
    );

export type MicrosoftSyncResult = {
    success: boolean;
    email?: string;
    connections?: string[];
    error?: string;
    missingScopes?: string[];
    skipped?: boolean;
};

type CredentialPayload = {
    email: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    scope?: string;
    tokenType?: string;
};

/**
 * Sync Microsoft credentials from a user's Microsoft Account record to
 * IntegrationConnection records for Outlook Mail+Calendar and Teams.
 */
export async function syncMicrosoftFromAccount(
    userId: string,
    organizationId: string
): Promise<MicrosoftSyncResult> {
    const account = await prisma.account.findFirst({
        where: { userId, providerId: "microsoft" },
        orderBy: { updatedAt: "desc" }
    });

    if (!account) {
        return { success: false, skipped: true, error: "No Microsoft account linked" };
    }

    const scopeSet = parseScopes(account.scope);
    const missingScopes = (MICROSOFT_REQUIRED_SCOPES as readonly string[]).filter(
        (scope) => !scopeSet.has(scope)
    );
    if (missingScopes.length > 0) {
        return {
            success: false,
            error: "Microsoft permissions not granted",
            missingScopes
        };
    }

    if (!account.accessToken) {
        return { success: false, error: "Microsoft access token not available" };
    }

    try {
        // Fetch user profile from Microsoft Graph to get email
        const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
            headers: { Authorization: `Bearer ${account.accessToken}` }
        });

        if (!profileRes.ok) {
            return { success: false, error: "Failed to fetch Microsoft profile" };
        }

        const profile = (await profileRes.json()) as {
            mail?: string;
            userPrincipalName?: string;
        };
        const email = profile.mail || profile.userPrincipalName;
        if (!email) {
            return { success: false, error: "Failed to resolve Microsoft email" };
        }

        const tokenPayload = {
            access_token: account.accessToken,
            refresh_token: account.refreshToken,
            expires_at: account.accessTokenExpiresAt?.getTime(),
            scope: account.scope
        };

        const createdConnections: string[] = [];

        // 1. Sync Outlook Mail + Calendar (the primary "microsoft" provider)
        const msConnectionId = await upsertMicrosoftConnection(
            organizationId,
            "microsoft",
            `Microsoft (${email})`,
            email,
            tokenPayload
        );
        createdConnections.push("microsoft");

        // Trigger auto-provisioning for the primary Microsoft provider
        await triggerProvisioning(msConnectionId, "microsoft", organizationId);

        // 2. Sync Teams (if Teams scopes are present)
        const hasTeamsScopes = (MICROSOFT_TEAMS_SCOPES as readonly string[]).every((s) =>
            scopeSet.has(s)
        );
        if (hasTeamsScopes) {
            const teamsConnectionId = await upsertMicrosoftConnection(
                organizationId,
                "microsoft-teams",
                `Teams (${email})`,
                email,
                tokenPayload
            );
            createdConnections.push("microsoft-teams");
            await triggerProvisioning(teamsConnectionId, "microsoft-teams", organizationId);
        }

        return {
            success: true,
            email,
            connections: createdConnections
        };
    } catch (error) {
        console.error("[MicrosoftSync] Error during sync:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to sync Microsoft credentials"
        };
    }
}

async function upsertMicrosoftConnection(
    organizationId: string,
    providerKey: string,
    connectionName: string,
    email: string,
    tokens: {
        access_token?: string | null;
        refresh_token?: string | null;
        expires_at?: number | null;
        scope?: string | null;
    }
): Promise<string> {
    const provider = await prisma.integrationProvider.findUnique({
        where: { key: providerKey }
    });
    if (!provider) {
        throw new Error(`Provider "${providerKey}" not configured`);
    }

    const credentialPayload: CredentialPayload = {
        email,
        ...(tokens.access_token ? { accessToken: tokens.access_token } : {}),
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        ...(tokens.expires_at ? { expiresAt: tokens.expires_at } : {}),
        ...(tokens.scope ? { scope: tokens.scope } : {})
    };

    const existing = await prisma.integrationConnection.findFirst({
        where: {
            organizationId,
            providerId: provider.id,
            OR: [
                { metadata: { path: ["email"], equals: email } },
                { credentials: { path: ["email"], equals: email } }
            ]
        }
    });

    const existingCreds = decryptCredentials(existing?.credentials);
    const merged =
        existingCreds && typeof existingCreds === "object"
            ? { ...existingCreds, ...credentialPayload, email }
            : credentialPayload;
    const encrypted = encryptCredentials(merged);

    if (existing) {
        await prisma.integrationConnection.update({
            where: { id: existing.id },
            data: {
                credentials: encrypted ? JSON.parse(JSON.stringify(encrypted)) : null,
                isActive: true,
                metadata: {
                    ...(existing.metadata && typeof existing.metadata === "object"
                        ? (existing.metadata as Record<string, unknown>)
                        : {}),
                    email
                }
            }
        });
        return existing.id;
    }

    await prisma.integrationConnection.updateMany({
        where: { organizationId, providerId: provider.id, scope: "org" },
        data: { isDefault: false }
    });

    const conn = await prisma.integrationConnection.create({
        data: {
            providerId: provider.id,
            organizationId,
            scope: "org",
            name: connectionName,
            isDefault: true,
            isActive: true,
            credentials: encrypted ? JSON.parse(JSON.stringify(encrypted)) : null,
            metadata: { email }
        }
    });

    return conn.id;
}

async function triggerProvisioning(
    connectionId: string,
    providerKey: string,
    organizationId: string
): Promise<void> {
    try {
        const { provisionIntegration, hasBlueprint } = await import("@repo/agentc2");
        if (hasBlueprint(providerKey)) {
            const workspace = await prisma.workspace.findFirst({
                where: { organizationId, isDefault: true },
                select: { id: true }
            });
            if (workspace) {
                await provisionIntegration(connectionId, {
                    workspaceId: workspace.id
                });
            }
        }
    } catch (err) {
        console.warn(
            `[MicrosoftSync] Failed to provision ${providerKey}:`,
            err instanceof Error ? err.message : err
        );
    }
}

/**
 * Check if a Microsoft IntegrationConnection already exists for an organization.
 */
export async function hasMicrosoftConnection(organizationId: string): Promise<boolean> {
    const provider = await prisma.integrationProvider.findUnique({
        where: { key: "microsoft" }
    });
    if (!provider) return false;

    const connection = await prisma.integrationConnection.findFirst({
        where: { organizationId, providerId: provider.id, isActive: true }
    });

    return !!connection;
}
