import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@repo/database";
import { auth, getEmailDomain } from "@repo/auth";

/**
 * GET /api/auth/suggested-org
 *
 * Returns the organization that matches the current user's email domain,
 * if one exists. Used during onboarding when the user has no membership yet.
 */
export async function GET() {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const domain = session.user.email ? getEmailDomain(session.user.email) : null;

        if (!domain) {
            return NextResponse.json({ success: true, organization: null });
        }

        const orgDomain = await prisma.organizationDomain.findUnique({
            where: { domain },
            include: { organization: true }
        });

        if (!orgDomain) {
            return NextResponse.json({ success: true, organization: null });
        }

        return NextResponse.json({
            success: true,
            organization: {
                id: orgDomain.organization.id,
                name: orgDomain.organization.name,
                slug: orgDomain.organization.slug
            }
        });
    } catch (error) {
        console.error("[Suggested Org] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get suggested org"
            },
            { status: 500 }
        );
    }
}
