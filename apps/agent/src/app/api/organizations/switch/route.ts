import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";

const COOKIE_NAME = "agentc2-active-org";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * POST /api/organizations/switch
 *
 * Switch the user's active organization by setting a persistent cookie.
 * Validates that the user is a member of the target organization.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { organizationId } = body as { organizationId?: string };

        if (!organizationId) {
            return NextResponse.json(
                { success: false, error: "Missing organizationId" },
                { status: 400 }
            );
        }

        const membership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.user.id,
                    organizationId
                }
            },
            select: {
                organizationId: true,
                role: true
            }
        });

        if (!membership) {
            return NextResponse.json(
                { success: false, error: "Not a member of this organization" },
                { status: 403 }
            );
        }

        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { id: true, name: true, slug: true, logoUrl: true }
        });

        if (!organization) {
            return NextResponse.json(
                { success: false, error: "Organization not found" },
                { status: 404 }
            );
        }

        const response = NextResponse.json({
            success: true,
            organization: {
                id: organization.id,
                name: organization.name,
                slug: organization.slug,
                logoUrl: organization.logoUrl
            }
        });

        response.cookies.set(COOKIE_NAME, organizationId, {
            httpOnly: false,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: COOKIE_MAX_AGE
        });

        return response;
    } catch (error) {
        console.error("[Organization Switch] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to switch organization"
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/organizations/switch
 *
 * Returns the current active organization from the cookie,
 * falling back to the user's default org.
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const activeOrgId = request.cookies.get(COOKIE_NAME)?.value;

        const memberships = await prisma.membership.findMany({
            where: { userId: session.user.id },
            orderBy: { createdAt: "asc" },
            include: {
                organization: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        logoUrl: true
                    }
                }
            }
        });

        if (memberships.length === 0) {
            return NextResponse.json({
                success: true,
                activeOrganization: null,
                organizations: []
            });
        }

        const activeOrg =
            memberships.find((m) => m.organizationId === activeOrgId) || memberships[0];

        return NextResponse.json({
            success: true,
            activeOrganization: {
                id: activeOrg!.organization.id,
                name: activeOrg!.organization.name,
                slug: activeOrg!.organization.slug,
                logoUrl: activeOrg!.organization.logoUrl,
                role: activeOrg!.role
            },
            organizations: memberships.map((m) => ({
                id: m.organization.id,
                name: m.organization.name,
                slug: m.organization.slug,
                logoUrl: m.organization.logoUrl,
                role: m.role
            }))
        });
    } catch (error) {
        console.error("[Organization Switch] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get active organization"
            },
            { status: 500 }
        );
    }
}
