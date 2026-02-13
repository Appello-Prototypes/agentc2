import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ flagId: string }> }
) {
    try {
        const admin = await requireAdminAction(request, "flag:override");
        const { flagId } = await params;
        const body = await request.json();

        if (!body.organizationId || body.value === undefined) {
            return NextResponse.json(
                { error: "organizationId and value are required" },
                { status: 400 }
            );
        }

        const override = await prisma.featureFlagOverride.upsert({
            where: {
                flagId_organizationId: {
                    flagId,
                    organizationId: body.organizationId
                }
            },
            create: {
                flagId,
                organizationId: body.organizationId,
                value: String(body.value),
                reason: body.reason,
                setBy: admin.adminUserId,
                expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined
            },
            update: {
                value: String(body.value),
                reason: body.reason,
                setBy: admin.adminUserId,
                expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined
            }
        });

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "FLAG_OVERRIDE_SET",
            entityType: "FeatureFlagOverride",
            entityId: override.id,
            afterJson: override,
            ipAddress,
            userAgent,
            metadata: {
                flagId,
                organizationId: body.organizationId,
                reason: body.reason
            }
        });

        return NextResponse.json({ override }, { status: 201 });
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
        const admin = await requireAdminAction(request, "flag:override");
        const { flagId } = await params;
        const url = new URL(request.url);
        const organizationId = url.searchParams.get("organizationId");

        if (!organizationId) {
            return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
        }

        const deleted = await prisma.featureFlagOverride.delete({
            where: {
                flagId_organizationId: { flagId, organizationId }
            }
        });

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "FLAG_OVERRIDE_REMOVE",
            entityType: "FeatureFlagOverride",
            entityId: deleted.id,
            beforeJson: deleted,
            ipAddress,
            userAgent,
            metadata: { flagId, organizationId }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
