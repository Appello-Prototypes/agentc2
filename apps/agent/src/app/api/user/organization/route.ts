import { NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireUser } from "@/lib/authz/require-auth";

/**
 * GET /api/user/organization
 *
 * Get current user's organization and membership
 */
export async function GET() {
    try {
        const authResult = await requireUser();
        if (authResult.response) return authResult.response;

        const { userId } = authResult.context;

        const membership = await prisma.membership.findFirst({
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
