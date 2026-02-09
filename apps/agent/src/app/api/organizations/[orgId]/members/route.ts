import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { auditLog } from "@/lib/audit-log";
import { authenticateRequest } from "@/lib/api-auth";

const VALID_ROLES = ["owner", "admin", "member", "viewer"];

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
        const authContext = await authenticateRequest(request);
        if (!authContext) {
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
                    userId: authContext.userId,
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

/**
 * POST /api/organizations/[orgId]/members
 *
 * Add a member to an organization
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { orgId } = await params;
        const body = await request.json();
        const { userId, role } = body as { userId?: string; role?: string };

        if (!userId) {
            return NextResponse.json(
                { success: false, error: "Missing required field: userId" },
                { status: 400 }
            );
        }

        const requestedRole = role || "member";
        if (!VALID_ROLES.includes(requestedRole)) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`
                },
                { status: 400 }
            );
        }

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

        const currentMembership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: authContext.userId,
                    organizationId: organization.id
                }
            }
        });

        if (!currentMembership || !["owner", "admin"].includes(currentMembership.role)) {
            return NextResponse.json(
                { success: false, error: "Insufficient permissions" },
                { status: 403 }
            );
        }

        if (requestedRole === "owner" && currentMembership.role !== "owner") {
            return NextResponse.json(
                { success: false, error: "Only owner can assign owner role" },
                { status: 403 }
            );
        }

        const existingMembership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId: organization.id
                }
            }
        });

        if (existingMembership) {
            return NextResponse.json(
                { success: false, error: "User is already a member of this organization" },
                { status: 409 }
            );
        }

        const createdMembership = await prisma.membership.create({
            data: {
                userId,
                organizationId: organization.id,
                role: requestedRole
            }
        });

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true, image: true }
        });

        await auditLog.create({
            action: "MEMBERSHIP_CREATE",
            entityType: "Membership",
            entityId: createdMembership.id,
            userId: authContext.userId,
            metadata: { targetUserId: userId, role: requestedRole }
        });

        return NextResponse.json({
            success: true,
            member: {
                id: createdMembership.id,
                userId: createdMembership.userId,
                role: createdMembership.role,
                createdAt: createdMembership.createdAt,
                user: user || null
            }
        });
    } catch (error) {
        console.error("[Organization Members] Error adding:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to add member"
            },
            { status: 500 }
        );
    }
}
