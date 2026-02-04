import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { auditLog } from "@/lib/audit-log";

/**
 * DELETE /api/organizations/[orgId]/invites/[inviteId]
 *
 * Revoke an invite code
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string; inviteId: string }> }
) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { orgId, inviteId } = await params;

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

        // Check if user is owner or admin
        const membership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.user.id,
                    organizationId: organization.id
                }
            }
        });

        if (!membership || !["owner", "admin"].includes(membership.role)) {
            return NextResponse.json(
                { success: false, error: "Insufficient permissions" },
                { status: 403 }
            );
        }

        // Find invite
        const invite = await prisma.organizationInvite.findFirst({
            where: {
                id: inviteId,
                organizationId: organization.id
            }
        });

        if (!invite) {
            return NextResponse.json(
                { success: false, error: "Invite not found" },
                { status: 404 }
            );
        }

        // Revoke invite (set isActive to false instead of deleting)
        await prisma.organizationInvite.update({
            where: { id: inviteId },
            data: { isActive: false }
        });

        // Audit log
        await auditLog.create({
            action: "INVITE_REVOKE",
            entityType: "OrganizationInvite",
            entityId: inviteId,
            userId: session.user.id,
            metadata: { code: invite.code }
        });

        return NextResponse.json({
            success: true,
            message: "Invite revoked"
        });
    } catch (error) {
        console.error("[Organization Invites] Error revoking:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to revoke invite"
            },
            { status: 500 }
        );
    }
}
