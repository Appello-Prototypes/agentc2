import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";
import type { AdminRole } from "@repo/admin-auth";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";

const VALID_ROLES: AdminRole[] = [
    "super_admin",
    "platform_admin",
    "billing_admin",
    "support_agent",
    "viewer"
];

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ adminId: string }> }
) {
    try {
        const admin = await requireAdminAction(request, "admin:update");
        const { adminId } = await params;
        const body = await request.json();

        if (adminId === admin.adminUserId) {
            if (body.isActive === false) {
                return NextResponse.json(
                    { error: "You cannot deactivate your own account" },
                    { status: 400 }
                );
            }
            if (body.role && body.role !== admin.role) {
                return NextResponse.json(
                    { error: "You cannot change your own role" },
                    { status: 400 }
                );
            }
        }

        const before = await prisma.adminUser.findUnique({
            where: { id: adminId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isActive: true
            }
        });
        if (!before) {
            return NextResponse.json({ error: "Admin user not found" }, { status: 404 });
        }

        if (body.role && !VALID_ROLES.includes(body.role)) {
            return NextResponse.json(
                { error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` },
                { status: 400 }
            );
        }

        const updated = await prisma.adminUser.update({
            where: { id: adminId },
            data: {
                ...(body.name !== undefined && { name: body.name }),
                ...(body.role !== undefined && { role: body.role }),
                ...(body.isActive !== undefined && { isActive: body.isActive })
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
                createdAt: true
            }
        });

        const action = body.isActive === false ? "ADMIN_USER_DEACTIVATE" : "ADMIN_USER_UPDATE";
        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action,
            entityType: "AdminUser",
            entityId: adminId,
            beforeJson: before,
            afterJson: updated,
            ipAddress,
            userAgent
        });

        if (body.isActive === false) {
            await prisma.adminSession.deleteMany({
                where: { adminUserId: adminId }
            });
        }

        return NextResponse.json({ admin: updated });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[Admin CRUD] Update error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ adminId: string }> }
) {
    try {
        const admin = await requireAdminAction(request, "admin:delete");
        const { adminId } = await params;

        if (adminId === admin.adminUserId) {
            return NextResponse.json(
                { error: "You cannot delete your own account" },
                { status: 400 }
            );
        }

        const before = await prisma.adminUser.findUnique({
            where: { id: adminId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true
            }
        });
        if (!before) {
            return NextResponse.json({ error: "Admin user not found" }, { status: 404 });
        }

        await prisma.adminSession.deleteMany({
            where: { adminUserId: adminId }
        });
        await prisma.adminUser.delete({ where: { id: adminId } });

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "ADMIN_USER_DEACTIVATE",
            entityType: "AdminUser",
            entityId: adminId,
            beforeJson: before,
            ipAddress,
            userAgent,
            metadata: { action: "deleted" }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[Admin CRUD] Delete error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
