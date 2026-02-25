import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";

const VALID_ROLES = ["owner", "admin", "member", "viewer"];

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string; membershipId: string }> }
) {
    try {
        const admin = await requireAdminAction(request, "tenant:update");
        const { orgId, membershipId } = await params;
        const body = await request.json();

        if (!body.role || !VALID_ROLES.includes(body.role)) {
            return NextResponse.json(
                { error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` },
                { status: 400 }
            );
        }

        const membership = await prisma.membership.findFirst({
            where: { id: membershipId, organizationId: orgId }
        });
        if (!membership) {
            return NextResponse.json({ error: "Membership not found" }, { status: 404 });
        }

        const previousRole = membership.role;

        const updated = await prisma.membership.update({
            where: { id: membershipId },
            data: { role: body.role },
            select: { id: true, userId: true, role: true, createdAt: true }
        });

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "TENANT_MEMBER_UPDATE",
            entityType: "Membership",
            entityId: membershipId,
            beforeJson: { role: previousRole },
            afterJson: { role: body.role },
            ipAddress,
            userAgent,
            metadata: { organizationId: orgId, userId: membership.userId }
        });

        return NextResponse.json({ membership: updated });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string; membershipId: string }> }
) {
    try {
        const admin = await requireAdminAction(request, "tenant:update");
        const { orgId, membershipId } = await params;

        const membership = await prisma.membership.findFirst({
            where: { id: membershipId, organizationId: orgId }
        });
        if (!membership) {
            return NextResponse.json({ error: "Membership not found" }, { status: 404 });
        }

        const user = await prisma.user.findUnique({
            where: { id: membership.userId },
            select: { email: true, name: true }
        });

        await prisma.membership.delete({ where: { id: membershipId } });

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "TENANT_MEMBER_REMOVE",
            entityType: "Membership",
            entityId: membershipId,
            beforeJson: {
                userId: membership.userId,
                email: user?.email,
                name: user?.name,
                role: membership.role,
                organizationId: orgId
            },
            ipAddress,
            userAgent
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
