import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";

/**
 * GET /api/user/organization
 *
 * Get current user's organization and membership
 */
export async function GET() {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const membership = await prisma.membership.findFirst({
            where: { userId: session.user.id },
            orderBy: { createdAt: "asc" },
            include: {
                organization: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        description: true,
                        logoUrl: true,
                        createdAt: true,
                        updatedAt: true
                    }
                }
            }
        });

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
