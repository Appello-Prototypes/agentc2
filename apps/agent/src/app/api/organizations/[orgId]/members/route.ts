import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";

/**
 * GET /api/organizations/[orgId]/members
 *
 * List all members of an organization
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { orgId } = await params;

        // Find organization
        const organization = await prisma.organization.findFirst({
            where: {
                OR: [{ id: orgId }, { slug: orgId }]
            }
        });

        if (!organization) {
            return NextResponse.json(
                { success: false, error: "Organization not found" },
                { status: 404 }
            );
        }

        // Check if user is a member
        const membership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.user.id,
                    organizationId: organization.id
                }
            }
        });

        if (!membership) {
            return NextResponse.json(
                { success: false, error: "Not a member of this organization" },
                { status: 403 }
            );
        }

        // Get all memberships
        const memberships = await prisma.membership.findMany({
            where: { organizationId: organization.id },
            orderBy: [{ role: "asc" }, { createdAt: "asc" }]
        });

        // Get user details for all members
        const userIds = memberships.map((m) => m.userId);
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
                id: true,
                name: true,
                email: true,
                image: true
            }
        });

        const usersMap = new Map(users.map((u) => [u.id, u]));

        return NextResponse.json({
            success: true,
            members: memberships.map((m) => ({
                id: m.id,
                userId: m.userId,
                user: usersMap.get(m.userId) || {
                    id: m.userId,
                    name: "Unknown",
                    email: "",
                    image: null
                },
                role: m.role,
                createdAt: m.createdAt
            })),
            total: memberships.length
        });
    } catch (error) {
        console.error("[Organization Members] Error listing:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list members"
            },
            { status: 500 }
        );
    }
}
