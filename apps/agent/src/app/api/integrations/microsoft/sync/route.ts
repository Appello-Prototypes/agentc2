import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { getUserOrganizationId } from "@/lib/organization";
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

        const result = await syncMicrosoftFromAccount(session.user.id, organizationId);

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
