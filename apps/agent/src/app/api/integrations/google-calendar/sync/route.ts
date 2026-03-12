import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { google } from "googleapis";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { getUserOrganizationId } from "@/lib/organization";
import { getGmailOAuthClient, syncSiblingGoogleConnections } from "@/lib/gmail";

const GOOGLE_CALENDAR_REQUIRED_SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

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
        const missingScopes = GOOGLE_CALENDAR_REQUIRED_SCOPES.filter(
            (scope) => !scopeSet.has(scope)
        );
        if (missingScopes.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Google Calendar permissions not granted",
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

        try {
            const result = await syncSiblingGoogleConnections(
                organizationId,
                gmailAddress,
                tokenPayload
            );

            if (!result.created.includes("google-calendar")) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            "Failed to sync Google Calendar. Either the required OAuth scopes were not granted or the google-calendar provider is not configured in the database."
                    },
                    { status: 400 }
                );
            }
        } catch (err) {
            console.error("[Google Calendar Sync] Failed:", err);
            return NextResponse.json(
                {
                    success: false,
                    error: err instanceof Error ? err.message : "Failed to sync Google Calendar"
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            gmailAddress,
            scope: account.scope,
            connected: true
        });
    } catch (error) {
        console.error("[Google Calendar Sync] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error ? error.message : "Failed to sync Google Calendar credentials"
            },
            { status: 500 }
        );
    }
}
