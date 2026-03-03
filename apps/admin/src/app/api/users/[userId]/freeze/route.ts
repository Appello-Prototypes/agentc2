import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const admin = await requireAdminAction(request, "user:freeze");
        const { userId } = await params;
        const body = await request.json().catch(() => ({}));
        const reason = body.reason || "Frozen by admin";

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { status: true }
        });
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        if (user.status === "frozen") {
            return NextResponse.json({ error: "User is already frozen" }, { status: 400 });
        }

        const previousStatus = user.status;

        await prisma.user.update({
            where: { id: userId },
            data: { status: "frozen" }
        });

        await prisma.session.deleteMany({ where: { userId } });

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "USER_FREEZE",
            entityType: "User",
            entityId: userId,
            beforeJson: { status: previousStatus },
            afterJson: { status: "frozen" },
            ipAddress,
            userAgent,
            metadata: { reason }
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
