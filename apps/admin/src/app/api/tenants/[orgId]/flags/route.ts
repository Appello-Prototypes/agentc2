import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const admin = await requireAdminAction(request, "flag:override");
        const { orgId } = await params;
        const body = await request.json();

        if (!body.flagId || body.value === undefined) {
            return NextResponse.json({ error: "flagId and value are required" }, { status: 400 });
        }

        const flag = await prisma.featureFlag.findUnique({
            where: { id: body.flagId },
            select: { id: true }
        });
        if (!flag) {
            return NextResponse.json({ error: "Flag not found" }, { status: 404 });
        }

        const override = await prisma.featureFlagOverride.upsert({
            where: {
                flagId_organizationId: {
                    flagId: body.flagId,
                    organizationId: orgId
                }
            },
            create: {
                flagId: body.flagId,
                organizationId: orgId,
                value: String(body.value),
                reason: body.reason || null,
                setBy: admin.adminUserId
            },
            update: {
                value: String(body.value),
                reason: body.reason || null,
                setBy: admin.adminUserId
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
            metadata: { flagId: body.flagId, organizationId: orgId, reason: body.reason }
        });

        return NextResponse.json({ override }, { status: 201 });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
