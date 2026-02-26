import { NextResponse } from "next/server";
import { google } from "googleapis";
import { prisma } from "@repo/database";
import { requireUserWithOrg } from "@/lib/authz/require-auth";
import {
    getGmailOAuthClient,
    GMAIL_REQUIRED_SCOPES,
    saveGmailCredentials,
    syncSiblingGoogleConnections
} from "@/lib/gmail";

const parseScopes = (scope?: string | null) =>
    new Set(
        (scope || "")
            .split(/[,\s]+/)
            .map((value) => value.trim())
            .filter(Boolean)
    );

export async function POST(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const silent = searchParams.get("silent") === "true";

        const authResult = await requireUserWithOrg();
        if (authResult.response) {
            if (silent) {
                return NextResponse.json(
                    { success: false, error: "Unauthorized" },
                    { status: 200 }
                );
            }
            return authResult.response;
        }

        const { userId, organizationId } = authResult.context;

        const account = await prisma.account.findFirst({
            where: {
                userId,
                providerId: "google"
            },
            orderBy: { updatedAt: "desc" }
        });

        if (!account) {
            return NextResponse.json(
                { success: false, error: "Google account not linked" },
                { status: silent ? 200 : 404 }
            );
        }

        const scopeSet = parseScopes(account.scope);
        const missingScopes = GMAIL_REQUIRED_SCOPES.filter((scope) => !scopeSet.has(scope));
        if (missingScopes.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Gmail permissions not granted",
                    missingScopes
                },
                { status: silent ? 200 : 400 }
            );
        }

        if (!account.accessToken) {
            return NextResponse.json(
                { success: false, error: "Google access token not available" },
                { status: silent ? 200 : 400 }
            );
        }

        const client = getGmailOAuthClient();
        client.setCredentials({
            access_token: account.accessToken,
            refresh_token: account.refreshToken || undefined,
            expiry_date: account.accessTokenExpiresAt?.getTime(),
            scope: account.scope || undefined
        });

        const gmail = google.gmail({ version: "v1", auth: client });
        const profile = await gmail.users.getProfile({ userId: "me" });
        const gmailAddress = profile.data.emailAddress;

        if (!gmailAddress) {
            return NextResponse.json(
                { success: false, error: "Failed to resolve Gmail address" },
                { status: 500 }
            );
        }

        const tokenPayload = {
            access_token: account.accessToken,
            refresh_token: account.refreshToken,
            expiry_date: account.accessTokenExpiresAt?.getTime(),
            scope: account.scope
        };

        const saved = await saveGmailCredentials(organizationId, gmailAddress, tokenPayload);

        // Sync sibling Google services (Calendar, Drive)
        try {
            await syncSiblingGoogleConnections(organizationId, gmailAddress, tokenPayload);
        } catch (err) {
            console.warn(
                "[Gmail Sync] Sibling sync failed (non-fatal):",
                err instanceof Error ? err.message : err
            );
        }

        return NextResponse.json({
            success: true,
            gmailAddress,
            scope: account.scope,
            connected: true,
            connectionId: (saved as { connectionId?: string }).connectionId || null
        });
    } catch (error) {
        console.error("[Gmail Sync] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to sync Gmail credentials"
            },
            { status: 500 }
        );
    }
}
