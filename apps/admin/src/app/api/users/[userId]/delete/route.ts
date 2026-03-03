import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const admin = await requireAdminAction(request, "user:delete");
        const { userId } = await params;
        const body = await request.json().catch(() => ({}));
        const reason = body.reason || "Deleted by admin";

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { status: true }
        });
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        if (user.status === "deleted") {
            return NextResponse.json({ error: "User is already deleted" }, { status: 400 });
        }

        const previousStatus = user.status;

        await prisma.user.update({
            where: { id: userId },
            data: { status: "deleted" }
        });

        await prisma.session.deleteMany({ where: { userId } });

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "USER_DELETE",
            entityType: "User",
            entityId: userId,
            beforeJson: { status: previousStatus },
            afterJson: { status: "deleted" },
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
