import { NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { GMAIL_REQUIRED_SCOPES } from "@/lib/gmail";
import { decryptCredentials } from "@/lib/credential-crypto";
import { requireUserWithOrg } from "@/lib/authz/require-auth";

const parseScopes = (scope?: string | null) =>
    new Set(
        (scope || "")
            .split(/[,\s]+/)
            .map((value) => value.trim())
            .filter(Boolean)
    );

export async function GET() {
    try {
        const authResult = await requireUserWithOrg();
        if (authResult.response) return authResult.response;

        const { userId, organizationId } = authResult.context;

        const [account, provider] = await Promise.all([
            prisma.account.findFirst({
                where: {
                    userId,
                    providerId: "google"
                },
                orderBy: { updatedAt: "desc" }
            }),
            prisma.integrationProvider.findUnique({
                where: { key: "gmail" }
            })
        ]);

        const scopeSet = parseScopes(account?.scope);
        const missingScopes = GMAIL_REQUIRED_SCOPES.filter((scope) => !scopeSet.has(scope));

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
        console.error("[Gmail Status] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to fetch Gmail status"
            },
            { status: 500 }
        );
    }
}
