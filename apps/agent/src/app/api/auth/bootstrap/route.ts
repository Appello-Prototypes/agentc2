import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth, bootstrapUserOrganization } from "@repo/auth";

/**
 * POST /api/auth/bootstrap
 *
 * Ensures the signed-in user is assigned to an organization.
 * Supports invite code and domain-based matching. Falls back to creating a new org.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const inviteCode = typeof body?.inviteCode === "string" ? body.inviteCode.trim() : "";

        const result = await bootstrapUserOrganization(
            session.user.id,
            session.user.name,
            session.user.email,
            inviteCode || undefined
        );

        if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error("[Auth Bootstrap] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to bootstrap organization"
            },
            { status: 500 }
        );
    }
}
