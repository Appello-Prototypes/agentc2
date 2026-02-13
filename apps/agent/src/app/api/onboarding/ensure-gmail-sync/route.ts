import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { getUserMembership } from "@/lib/organization";
import { syncGmailFromAccount, hasGmailConnection } from "@/lib/gmail-sync";

/**
 * POST /api/onboarding/ensure-gmail-sync
 *
 * Called during onboarding to guarantee that Gmail credentials are synced
 * from the user's Google Account to an IntegrationConnection.
 *
 * This is the server-side, guaranteed version of the async GmailSyncOnLogin.
 * It only syncs if the user has a Google Account with Gmail scopes and the
 * org doesn't already have a Gmail connection.
 *
 * Returns:
 * - { success: true, gmailConnected: true, gmailAddress } -- Gmail synced or already connected
 * - { success: true, gmailConnected: false } -- User has no Google account or missing scopes
 * - { success: false, error } -- Server error
 */
export async function POST() {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const membership = await getUserMembership(session.user.id);
        if (!membership) {
            return NextResponse.json({
                success: true,
                gmailConnected: false,
                reason: "no_membership"
            });
        }

        const organizationId = membership.organizationId;

        // Check if Gmail is already connected for this org (skip redundant sync)
        const alreadyConnected = await hasGmailConnection(organizationId);
        if (alreadyConnected) {
            return NextResponse.json({
                success: true,
                gmailConnected: true,
                reason: "already_connected"
            });
        }

        // Attempt to sync Gmail credentials from the user's Google Account
        const result = await syncGmailFromAccount(session.user.id, organizationId);

        if (result.success) {
            return NextResponse.json({
                success: true,
                gmailConnected: true,
                gmailAddress: result.gmailAddress,
                connectionId: result.connectionId
            });
        }

        // Sync failed or was skipped (no Google account, missing scopes, etc.)
        return NextResponse.json({
            success: true,
            gmailConnected: false,
            reason: result.skipped ? "no_google_account" : "sync_failed",
            error: result.error,
            missingScopes: result.missingScopes
        });
    } catch (error) {
        console.error("[Ensure Gmail Sync] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to ensure Gmail sync"
            },
            { status: 500 }
        );
    }
}
