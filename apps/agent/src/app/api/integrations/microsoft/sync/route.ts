import { NextResponse } from "next/server";
import { requireUserWithOrg } from "@/lib/authz/require-auth";
import { syncMicrosoftFromAccount } from "@/lib/microsoft-sync";

/**
 * POST /api/integrations/microsoft/sync
 *
 * Sync Microsoft OAuth tokens from the Better Auth Account table to
 * IntegrationConnection records. Called after Microsoft SSO login.
 */
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

        const result = await syncMicrosoftFromAccount(userId, organizationId);

        return NextResponse.json({
            success: result.success,
            email: result.email,
            connected: result.success,
            connections: result.connections,
            error: result.error,
            missingScopes: result.missingScopes
        });
    } catch (error) {
        console.error("[Microsoft Sync] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error ? error.message : "Failed to sync Microsoft credentials"
            },
            { status: 500 }
        );
    }
}
