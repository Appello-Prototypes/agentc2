import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@repo/database";
import { auth, createNewOrganizationForUser, getEmailDomain } from "@repo/auth";

/**
 * POST /api/auth/confirm-org
 *
 * Called after the user sees the "join org" offer during onboarding.
 * Body: { action: "join" | "create_new", organizationId?: string }
 *
 * - join: Validates domain match, then creates membership in the specified org.
 * - create_new: Creates a brand-new org + default workspace with the user as owner.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        // Prevent double-join
        const existingMembership = await prisma.membership.findFirst({
            where: { userId: session.user.id }
        });

        if (existingMembership) {
            return NextResponse.json(
                { success: false, error: "User already belongs to an organization" },
                { status: 400 }
            );
        }

        const body = await request.json().catch(() => ({}));
        const action = body?.action;

        if (action !== "join" && action !== "create_new") {
            return NextResponse.json(
                { success: false, error: "Invalid action. Must be 'join' or 'create_new'." },
                { status: 400 }
            );
        }

        if (action === "join") {
            const organizationId = body?.organizationId;
            if (typeof organizationId !== "string" || !organizationId) {
                return NextResponse.json(
                    { success: false, error: "organizationId is required for join action" },
                    { status: 400 }
                );
            }

            // Verify the org's domain matches the user's email domain
            const domain = session.user.email ? getEmailDomain(session.user.email) : null;
            if (!domain) {
                return NextResponse.json(
                    { success: false, error: "Cannot determine email domain" },
                    { status: 400 }
                );
            }

            const orgDomain = await prisma.organizationDomain.findFirst({
                where: { organizationId, domain },
                include: { organization: true }
            });

            if (!orgDomain) {
                return NextResponse.json(
                    { success: false, error: "Organization domain does not match your email" },
                    { status: 400 }
                );
            }

            const membership = await prisma.membership.create({
                data: {
                    userId: session.user.id,
                    organizationId,
                    role: "member"
                }
            });

            return NextResponse.json({
                success: true,
                organization: {
                    id: orgDomain.organization.id,
                    name: orgDomain.organization.name,
                    slug: orgDomain.organization.slug
                },
                membership
            });
        }

        // action === "create_new"
        const result = await createNewOrganizationForUser(session.user.id, session.user.name);

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error || "Failed to create organization" },
                { status: 500 }
            );
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error("[Confirm Org] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to confirm organization"
            },
            { status: 500 }
        );
    }
}
