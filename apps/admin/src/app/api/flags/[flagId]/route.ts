import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ flagId: string }> }
) {
    try {
        const admin = await requireAdminAction(request, "flag:update");
        const { flagId } = await params;
        const body = await request.json();

        const before = await prisma.featureFlag.findUnique({ where: { id: flagId } });
        if (!before) {
            return NextResponse.json({ error: "Flag not found" }, { status: 404 });
        }

        const flag = await prisma.featureFlag.update({
            where: { id: flagId },
            data: {
                ...(body.name !== undefined && { name: body.name }),
                ...(body.description !== undefined && { description: body.description }),
                ...(body.defaultValue !== undefined && { defaultValue: body.defaultValue }),
                ...(body.isActive !== undefined && { isActive: body.isActive })
            }
        });

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "FLAG_UPDATE",
            entityType: "FeatureFlag",
            entityId: flagId,
            beforeJson: before,
            afterJson: flag,
            ipAddress,
            userAgent
        });

        return NextResponse.json({ flag });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ flagId: string }> }
) {
    try {
        const admin = await requireAdminAction(request, "flag:delete");
        const { flagId } = await params;

        const before = await prisma.featureFlag.findUnique({ where: { id: flagId } });
        if (!before) {
            return NextResponse.json({ error: "Flag not found" }, { status: 404 });
        }

        await prisma.featureFlag.delete({ where: { id: flagId } });

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "FLAG_DELETE",
            entityType: "FeatureFlag",
            entityId: flagId,
            beforeJson: before,
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
