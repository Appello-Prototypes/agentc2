import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { getUserOrganizationId } from "@/lib/organization";
import { decryptCredentials } from "@/lib/credential-crypto";

const GOOGLE_DRIVE_REQUIRED_SCOPES = [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/drive.file"
];

const parseScopes = (scope?: string | null) =>
    new Set(
        (scope || "")
            .split(/[,\s]+/)
            .map((value) => value.trim())
            .filter(Boolean)
    );

export async function GET() {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

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

        const [account, provider] = await Promise.all([
            prisma.account.findFirst({
                where: {
                    userId: session.user.id,
                    providerId: "google"
                },
                orderBy: { updatedAt: "desc" }
            }),
            prisma.integrationProvider.findUnique({
                where: { key: "google-drive" }
            })
        ]);

        const scopeSet = parseScopes(account?.scope);
        const missingScopes = GOOGLE_DRIVE_REQUIRED_SCOPES.filter((scope) => !scopeSet.has(scope));

        const connection = provider
            ? await prisma.integrationConnection.findFirst({
                  where: {
                      organizationId,
                      providerId: provider.id,
                      isActive: true
                  }
              })
            : null;
        const decryptedCredentials = decryptCredentials(connection?.credentials);
        const storedAddress =
            (decryptedCredentials &&
            typeof decryptedCredentials === "object" &&
            !Array.isArray(decryptedCredentials)
                ? (decryptedCredentials as { gmailAddress?: string }).gmailAddress
                : null) ||
            (connection?.metadata &&
            typeof connection.metadata === "object" &&
            !Array.isArray(connection.metadata)
                ? (connection.metadata as { gmailAddress?: string }).gmailAddress
                : null);

        const connected = Boolean(connection?.isActive && storedAddress);

        return NextResponse.json({
            success: true,
            connected,
            gmailAddress: storedAddress,
            scope: account?.scope || null,
            missingScopes,
            hasGoogleAccount: Boolean(account),
            needsReauth: missingScopes.length > 0
        });
    } catch (error) {
        console.error("[Google Drive Status] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to fetch Google Drive status"
            },
            { status: 500 }
        );
    }
}
