import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { auditLog } from "@/lib/audit-log";

const VALID_ROLES = ["owner", "admin", "member", "viewer"];

/**
 * PATCH /api/organizations/[orgId]/members/[userId]
 *
 * Update a member's role
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string; userId: string }> }
) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { orgId, userId } = await params;

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

        // Check current user's membership and role
        const currentMembership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.user.id,
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

        // Find target membership
        const targetMembership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId: organization.id
                }
            }
        });

        if (!targetMembership) {
            return NextResponse.json(
                { success: false, error: "Member not found" },
                { status: 404 }
            );
        }

        // Admin cannot modify owner
        if (currentMembership.role === "admin" && targetMembership.role === "owner") {
            return NextResponse.json(
                { success: false, error: "Cannot modify owner role" },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { role, permissions } = body as {
            role?: string;
            permissions?: string[];
        };

        const VALID_PERMISSIONS = ["guardrail_override"];

        // At least one field must be provided
        if (!role && permissions === undefined) {
            return NextResponse.json(
                { success: false, error: "Must provide role or permissions" },
                { status: 400 }
            );
        }

        if (role && !VALID_ROLES.includes(role)) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`
                },
                { status: 400 }
            );
        }

        if (permissions) {
            const invalid = permissions.filter((p) => !VALID_PERMISSIONS.includes(p));
            if (invalid.length > 0) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `Invalid permissions: ${invalid.join(", ")}. Valid: ${VALID_PERMISSIONS.join(", ")}`
                    },
                    { status: 400 }
                );
            }
        }

        // Only owner can assign owner role
        if (role === "owner" && currentMembership.role !== "owner") {
            return NextResponse.json(
                { success: false, error: "Only owner can assign owner role" },
                { status: 403 }
            );
        }

        // Build update data
        const updateData: { role?: string; permissions?: string[] } = {};
        if (role) updateData.role = role;
        if (permissions !== undefined) updateData.permissions = permissions;

        // Update membership
        const updatedMembership = await prisma.membership.update({
            where: { id: targetMembership.id },
            data: updateData
        });

        // If transferring ownership, demote current owner to admin
        if (role === "owner" && userId !== session.user.id) {
            await prisma.membership.update({
                where: { id: currentMembership.id },
                data: { role: "admin" }
            });
        }

        // Audit log
        await auditLog.create({
            action: permissions !== undefined ? "MEMBER_PERMISSIONS_UPDATE" : "MEMBER_ROLE_UPDATE",
            entityType: "Membership",
            entityId: targetMembership.id,
            userId: session.user.id,
            metadata: {
                targetUserId: userId,
                ...(role ? { newRole: role, oldRole: targetMembership.role } : {}),
                ...(permissions !== undefined
                    ? { newPermissions: permissions, oldPermissions: targetMembership.permissions }
                    : {})
            }
        });

        return NextResponse.json({
            success: true,
            membership: {
                id: updatedMembership.id,
                userId: updatedMembership.userId,
                role: updatedMembership.role,
                permissions: updatedMembership.permissions
            }
        });
    } catch (error) {
        console.error("[Organization Members] Error updating role:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to update role"
            },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/organizations/[orgId]/members/[userId]
 *
 * Remove a member from the organization
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string; userId: string }> }
) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { orgId, userId } = await params;

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

        // Check current user's membership and role
        const currentMembership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.user.id,
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

        // Find target membership
        const targetMembership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId: organization.id
                }
            }
        });

        if (!targetMembership) {
            return NextResponse.json(
                { success: false, error: "Member not found" },
                { status: 404 }
            );
        }

        // Cannot remove owner
        if (targetMembership.role === "owner") {
            return NextResponse.json(
                { success: false, error: "Cannot remove owner. Transfer ownership first." },
                { status: 403 }
            );
        }

        // Admin cannot remove other admins
        if (currentMembership.role === "admin" && targetMembership.role === "admin") {
            return NextResponse.json(
                { success: false, error: "Admin cannot remove other admins" },
                { status: 403 }
            );
        }

        // Delete membership
        await prisma.membership.delete({
            where: { id: targetMembership.id }
        });

        // Audit log
        await auditLog.create({
            action: "MEMBER_REMOVE",
            entityType: "Membership",
            entityId: targetMembership.id,
            userId: session.user.id,
            metadata: { targetUserId: userId, role: targetMembership.role }
        });

        return NextResponse.json({
            success: true,
            message: "Member removed"
        });
    } catch (error) {
        console.error("[Organization Members] Error removing:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to remove member"
            },
            { status: 500 }
        );
    }
}
