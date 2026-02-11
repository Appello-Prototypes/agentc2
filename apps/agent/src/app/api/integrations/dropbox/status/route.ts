import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { getUserOrganizationId } from "@/lib/organization";
import { decryptCredentials } from "@/lib/credential-crypto";

/**
 * GET /api/integrations/dropbox/status
 *
 * Returns the connection status for Dropbox.
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
            where: { key: "dropbox" }
        });

        if (!provider) {
            return NextResponse.json({
                success: true,
                connected: false,
                email: null,
                accountId: null,
                hasRefreshToken: false,
                isExpired: false,
                errorMessage: null,
                hasCursor: false
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
                    where: { providerKey: "dropbox", isActive: true }
                }
            }
        });

        if (!connection) {
            return NextResponse.json({
                success: true,
                connected: false,
                email: null,
                accountId: null,
                hasRefreshToken: false,
                isExpired: false,
                errorMessage: null,
                hasCursor: false
            });
        }

        const meta =
            connection.metadata && typeof connection.metadata === "object"
                ? (connection.metadata as Record<string, unknown>)
                : {};

        const decrypted = decryptCredentials(connection.credentials);
        const creds =
            decrypted && typeof decrypted === "object" && !Array.isArray(decrypted)
                ? (decrypted as Record<string, unknown>)
                : {};

        const sub = connection.webhookSubscriptions[0];

        return NextResponse.json({
            success: true,
            connected: connection.isActive,
            connectionId: connection.id,
            email: (meta.email as string) || null,
            accountId: (meta.accountId as string) || null,
            displayName: (meta.displayName as string) || null,
            hasRefreshToken: Boolean(creds.refreshToken),
            isExpired: Date.now() > ((creds.expiresAt as number) || 0),
            errorMessage: connection.errorMessage || null,
            hasCursor: Boolean(sub?.cursor)
        });
    } catch (error) {
        console.error("[Dropbox Status] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to fetch Dropbox status"
            },
            { status: 500 }
        );
    }
}
