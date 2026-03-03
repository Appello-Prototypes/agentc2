import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string; overrideId: string }> }
) {
    try {
        const admin = await requireAdminAction(request, "flag:override");
        const { overrideId } = await params;
        const body = await request.json();

        const existing = await prisma.featureFlagOverride.findUnique({
            where: { id: overrideId }
        });
        if (!existing) {
            return NextResponse.json({ error: "Override not found" }, { status: 404 });
        }

        const updated = await prisma.featureFlagOverride.update({
            where: { id: overrideId },
            data: {
                ...(body.value !== undefined && { value: String(body.value) }),
                ...(body.reason !== undefined && { reason: body.reason }),
                setBy: admin.adminUserId
            }
        });

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "FLAG_OVERRIDE_UPDATE",
            entityType: "FeatureFlagOverride",
            entityId: overrideId,
            beforeJson: existing,
            afterJson: updated,
            ipAddress,
            userAgent
        });

        return NextResponse.json({ override: updated });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string; overrideId: string }> }
) {
    try {
        const admin = await requireAdminAction(request, "flag:override");
        const { overrideId } = await params;

        const existing = await prisma.featureFlagOverride.findUnique({
            where: { id: overrideId }
        });
        if (!existing) {
            return NextResponse.json({ error: "Override not found" }, { status: 404 });
        }

        await prisma.featureFlagOverride.delete({
            where: { id: overrideId }
        });

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "FLAG_OVERRIDE_REMOVE",
            entityType: "FeatureFlagOverride",
            entityId: overrideId,
            beforeJson: existing,
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
