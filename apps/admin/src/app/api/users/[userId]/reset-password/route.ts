import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";
import crypto from "crypto";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const admin = await requireAdminAction(request, "user:reset_password");
        const { userId } = await params;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true }
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Generate a temporary password (in production this would send an email)
        const tempPassword = crypto.randomBytes(16).toString("hex");

        // Log the action (the temp password is NOT logged for security)
        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "USER_RESET_PASSWORD",
            entityType: "User",
            entityId: userId,
            ipAddress,
            userAgent,
            metadata: { userEmail: user.email }
        });

        return NextResponse.json({
            success: true,
            message: `Password reset initiated for ${user.email}. Temporary password generated.`,
            tempPassword // In production: remove this, send via secure channel
        });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
