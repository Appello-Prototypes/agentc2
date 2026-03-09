import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";

const ACTIVE_ORG_COOKIE = "agentc2-active-org";

/**
 * GET /api/user/organization
 *
 * Get current user's organization and membership.
 * Respects the active-org cookie so multi-org users see the correct tenant.
 */
export async function GET() {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;

        // Prefer the active-org cookie for multi-org users
        let membership = null;
        try {
            const cookieStore = await cookies();
            const activeOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value?.trim();
            if (activeOrgId) {
                membership = await prisma.membership.findUnique({
                    where: {
                        userId_organizationId: { userId, organizationId: activeOrgId }
                    },
                    include: {
                        organization: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                                description: true,
                                logoUrl: true,
                                timezone: true,
                                metadata: true,
                                createdAt: true,
                                updatedAt: true
                            }
                        }
                    }
                });
            }
        } catch {
            // cookies() unavailable outside request context
        }

        // Fall back to earliest membership if no active org cookie or invalid
        if (!membership) {
            membership = await prisma.membership.findFirst({
                where: { userId },
                orderBy: { createdAt: "asc" },
                include: {
                    organization: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            description: true,
                            logoUrl: true,
                            timezone: true,
                            metadata: true,
                            createdAt: true,
                            updatedAt: true
                        }
                    }
                }
            });
        }

        if (!membership) {
            return NextResponse.json(
                { success: false, error: "No organization found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            organization: membership.organization,
            membership: {
                id: membership.id,
                userId: membership.userId,
                role: membership.role,
                createdAt: membership.createdAt
            }
        });
    } catch (error) {
        console.error("[User Organization] Error fetching:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to fetch organization"
            },
            { status: 500 }
        );
    }
}
