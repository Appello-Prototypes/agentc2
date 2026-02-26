import { NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { decryptCredentials } from "@/lib/credential-crypto";
import { requireUserWithOrg } from "@/lib/authz/require-auth";

/**
 * GET /api/integrations/dropbox/status
 *
 * Returns the connection status for Dropbox.
 */
export async function GET() {
    try {
        const authResult = await requireUserWithOrg();
        if (authResult.response) return authResult.response;

        const { organizationId } = authResult.context;

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
