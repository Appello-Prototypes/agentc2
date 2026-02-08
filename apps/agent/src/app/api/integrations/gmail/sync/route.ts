import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { google } from "googleapis";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { getUserOrganizationId } from "@/lib/organization";
import { getGmailOAuthClient, GMAIL_REQUIRED_SCOPES, saveGmailCredentials } from "@/lib/gmail";

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

        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: silent ? 200 : 401 }
            );
        }

        const organizationId = await getUserOrganizationId(session.user.id);
        if (!organizationId) {
            return NextResponse.json(
                { success: false, error: "Organization membership required" },
                { status: silent ? 200 : 403 }
            );
        }

        const account = await prisma.account.findFirst({
            where: {
                userId: session.user.id,
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

        const saved = await saveGmailCredentials(organizationId, gmailAddress, {
            access_token: account.accessToken,
            refresh_token: account.refreshToken,
            expiry_date: account.accessTokenExpiresAt?.getTime(),
            scope: account.scope
        });

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
