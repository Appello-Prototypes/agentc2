import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@repo/database";
import { auth, getEmailDomain } from "@repo/auth";

/**
 * GET /api/auth/suggested-org
 *
 * Returns the organization that matches the current user's email domain,
 * if one exists. Used during onboarding when the user has no membership yet.
 *
 * Checks two sources in priority order:
 * 1. OrganizationDomain table (explicit admin-configured domain mapping)
 * 2. Existing member emails (soft match — another user with same @domain is in an org)
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

        // 1. Check explicit OrganizationDomain table
        const orgDomain = await prisma.organizationDomain.findUnique({
            where: { domain },
            include: { organization: true }
        });

        if (orgDomain) {
            return NextResponse.json({
                success: true,
                organization: {
                    id: orgDomain.organization.id,
                    name: orgDomain.organization.name,
                    slug: orgDomain.organization.slug
                }
            });
        }

        // 2. Fallback: check if any existing org member shares the same email domain
        const coworker = await prisma.user.findFirst({
            where: {
                email: { endsWith: `@${domain}` },
                NOT: { id: session.user.id }
            }
        });

        if (coworker) {
            const coworkerMembership = await prisma.membership.findFirst({
                where: { userId: coworker.id },
                include: { organization: true },
                orderBy: { createdAt: "asc" }
            });

            if (coworkerMembership) {
                return NextResponse.json({
                    success: true,
                    organization: {
                        id: coworkerMembership.organization.id,
                        name: coworkerMembership.organization.name,
                        slug: coworkerMembership.organization.slug
                    }
                });
            }
        }

        return NextResponse.json({ success: true, organization: null });
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
