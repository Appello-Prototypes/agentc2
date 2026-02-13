import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const admin = await requireAdminAction(request, "user:force_logout");
        const { userId } = await params;

        // Delete all sessions for this user
        const deleted = await prisma.session.deleteMany({
            where: { userId }
        });

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "USER_FORCE_LOGOUT",
            entityType: "User",
            entityId: userId,
            ipAddress,
            userAgent,
            metadata: { sessionsRevoked: deleted.count }
        });

        return NextResponse.json({
            success: true,
            sessionsRevoked: deleted.count
        });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
