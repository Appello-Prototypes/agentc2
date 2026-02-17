import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";

/**
 * PATCH /api/platform-invites/[inviteId]
 *
 * Update a platform invite (e.g. revoke it).
 * Body: { isActive?: boolean }
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ inviteId: string }> }
) {
    try {
        const admin = await requireAdminAction(request, "platform-invite:create");
        const { inviteId } = await params;
        const body = await request.json().catch(() => ({}));

        const invite = await prisma.platformInvite.findUnique({
            where: { id: inviteId }
        });

        if (!invite) {
            return NextResponse.json({ error: "Invite not found" }, { status: 404 });
        }

        const updated = await prisma.platformInvite.update({
            where: { id: inviteId },
            data: {
                isActive: typeof body.isActive === "boolean" ? body.isActive : undefined
            }
        });

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "PLATFORM_INVITE_REVOKE",
            entityType: "PlatformInvite",
            entityId: invite.id,
            beforeJson: invite,
            afterJson: updated,
            ipAddress,
            userAgent
        });

        return NextResponse.json({ invite: updated });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
