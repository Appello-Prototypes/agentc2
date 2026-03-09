import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError, validateRouteParam } from "@repo/admin-auth";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const admin = await requireAdminAction(request, "user:activate");
        const { userId } = await params;

        const validation = validateRouteParam("userId", userId);
        if (!validation.valid) {
            return validation.response;
        }

        const user = await prisma.user.findUnique({
            where: { id: validation.value },
            select: { status: true }
        });
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        if (user.status === "active") {
            return NextResponse.json({ error: "User is already active" }, { status: 400 });
        }

        const previousStatus = user.status;

        await prisma.user.update({
            where: { id: validation.value },
            data: { status: "active" }
        });

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "USER_ACTIVATE",
            entityType: "User",
            entityId: validation.value,
            beforeJson: { status: previousStatus },
            afterJson: { status: "active" },
            ipAddress,
            userAgent
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        const msg = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ error: msg }, { status: 400 });
    }
}
