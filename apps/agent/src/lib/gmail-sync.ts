/**
 * Server-side Gmail sync logic extracted from the /api/integrations/gmail/sync route.
 *
 * This function can be called from any server context (API routes, hooks, bootstrap)
 * to sync Google OAuth tokens from the Better Auth Account table into an
 * IntegrationConnection record for organization-wide Gmail tool access.
 */

import { prisma } from "@repo/database";
import { google } from "googleapis";
import { getGmailOAuthClient, GMAIL_REQUIRED_SCOPES, saveGmailCredentials } from "@/lib/gmail";

const parseScopes = (scope?: string | null) =>
    new Set(
        (scope || "")
            .split(/[,\s]+/)
            .map((value) => value.trim())
            .filter(Boolean)
    );

export type GmailSyncResult = {
    success: boolean;
    gmailAddress?: string;
    connectionId?: string;
    error?: string;
    missingScopes?: string[];
    skipped?: boolean;
};

/**
 * Sync Gmail credentials from a user's Google Account record to an IntegrationConnection.
 *
 * @param userId - The user whose Google Account tokens to read
 * @param organizationId - The organization to create/update the connection for
 * @returns GmailSyncResult with success status and connection details
 *
 * Edge cases handled:
 * - No Google account linked -> returns { success: false, skipped: true }
 * - Missing Gmail scopes (partial approval) -> returns { success: false, missingScopes }
 * - Expired access token with refresh token -> refresh token used by Gmail API client
 * - No access token at all -> returns { success: false, error }
 * - Gmail API failure -> returns { success: false, error }
 */
export async function syncGmailFromAccount(
    userId: string,
    organizationId: string
): Promise<GmailSyncResult> {
    // Find the user's Google account (most recently updated)
    const account = await prisma.account.findFirst({
        where: {
            userId,
            providerId: "google"
        },
        orderBy: { updatedAt: "desc" }
    });

    if (!account) {
        return { success: false, skipped: true, error: "No Google account linked" };
    }

    // Check that Gmail scopes were granted
    const scopeSet = parseScopes(account.scope);
    const missingScopes = GMAIL_REQUIRED_SCOPES.filter((scope) => !scopeSet.has(scope));
    if (missingScopes.length > 0) {
        return {
            success: false,
            error: "Gmail permissions not granted",
            missingScopes
        };
    }

    // Ensure we have at least an access token
    if (!account.accessToken) {
        return { success: false, error: "Google access token not available" };
    }

    try {
        // Set up OAuth client with stored credentials
        const client = getGmailOAuthClient();
        client.setCredentials({
            access_token: account.accessToken,
            refresh_token: account.refreshToken || undefined,
            expiry_date: account.accessTokenExpiresAt?.getTime(),
            scope: account.scope || undefined
        });

        // Verify token by fetching Gmail profile (also gets the email address)
        const gmail = google.gmail({ version: "v1", auth: client });
        const profile = await gmail.users.getProfile({ userId: "me" });
        const gmailAddress = profile.data.emailAddress;

        if (!gmailAddress) {
            return { success: false, error: "Failed to resolve Gmail address" };
        }

        // Save credentials to IntegrationConnection (encrypted, org-scoped)
        const saved = await saveGmailCredentials(organizationId, gmailAddress, {
            access_token: account.accessToken,
            refresh_token: account.refreshToken,
            expiry_date: account.accessTokenExpiresAt?.getTime(),
            scope: account.scope
        });

        return {
            success: true,
            gmailAddress,
            connectionId: (saved as { connectionId?: string }).connectionId || undefined
        };
    } catch (error) {
        console.error("[GmailSync] Error during sync:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to sync Gmail credentials"
        };
    }
}

/**
 * Check if a Gmail IntegrationConnection already exists for an organization.
 * Used to skip redundant sync attempts.
 */
export async function hasGmailConnection(organizationId: string): Promise<boolean> {
    const provider = await prisma.integrationProvider.findUnique({
        where: { key: "gmail" }
    });
    if (!provider) return false;

    const connection = await prisma.integrationConnection.findFirst({
        where: {
            organizationId,
            providerId: provider.id,
            isActive: true
        }
    });

    return !!connection;
}
