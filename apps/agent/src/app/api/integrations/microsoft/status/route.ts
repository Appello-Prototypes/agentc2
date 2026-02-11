import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { getUserOrganizationId } from "@/lib/organization";
import { decryptCredentials } from "@/lib/credential-crypto";

/**
 * GET /api/integrations/microsoft/status
 *
 * Returns the connection status for Microsoft (Outlook Mail + Calendar).
 */
export async function GET() {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const organizationId = await getUserOrganizationId(session.user.id);
        if (!organizationId) {
            return NextResponse.json(
                { success: false, error: "Organization membership required" },
                { status: 403 }
            );
        }

        const provider = await prisma.integrationProvider.findUnique({
            where: { key: "microsoft" }
        });

        if (!provider) {
            return NextResponse.json({
                success: true,
                connected: false,
                email: null,
                hasRefreshToken: false,
                isExpired: false,
                errorMessage: null,
                mailSubscription: null,
                calendarSubscription: null
            });
        }

        const connection = await prisma.integrationConnection.findFirst({
            where: {
                organizationId,
                providerId: provider.id,
                scope: "org"
            },
            include: {
                webhookSubscriptions: {
                    where: { isActive: true }
                }
            }
        });

        if (!connection) {
            return NextResponse.json({
                success: true,
                connected: false,
                email: null,
                hasRefreshToken: false,
                isExpired: false,
                errorMessage: null,
                mailSubscription: null,
                calendarSubscription: null
            });
        }

        const meta =
            connection.metadata && typeof connection.metadata === "object"
                ? (connection.metadata as Record<string, unknown>)
                : {};
        const email = (meta.email as string) || null;

        const decrypted = decryptCredentials(connection.credentials);
        const creds =
            decrypted && typeof decrypted === "object" && !Array.isArray(decrypted)
                ? (decrypted as Record<string, unknown>)
                : {};
        const hasRefreshToken = Boolean(creds.refreshToken);
        const expiresAt = (creds.expiresAt as number) || 0;
        const isExpired = Date.now() > expiresAt;

        const mailSub = connection.webhookSubscriptions.find(
            (s) => s.providerKey === "microsoft-mail"
        );
        const calendarSub = connection.webhookSubscriptions.find(
            (s) => s.providerKey === "microsoft-calendar"
        );

        return NextResponse.json({
            success: true,
            connected: connection.isActive,
            connectionId: connection.id,
            email,
            hasRefreshToken,
            isExpired,
            errorMessage: connection.errorMessage || null,
            mailSubscription: mailSub
                ? {
                      id: mailSub.id,
                      expiresAt: mailSub.expiresAt,
                      isActive: mailSub.isActive,
                      errorMessage: mailSub.errorMessage
                  }
                : null,
            calendarSubscription: calendarSub
                ? {
                      id: calendarSub.id,
                      expiresAt: calendarSub.expiresAt,
                      isActive: calendarSub.isActive,
                      errorMessage: calendarSub.errorMessage
                  }
                : null
        });
    } catch (error) {
        console.error("[Microsoft Status] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to fetch Microsoft status"
            },
            { status: 500 }
        );
    }
}
