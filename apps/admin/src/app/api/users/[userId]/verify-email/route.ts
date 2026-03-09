import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError, validateRouteParam } from "@repo/admin-auth";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const admin = await requireAdminAction(request, "user:verify_email");
        const { userId } = await params;

        const validation = validateRouteParam("userId", userId);
        if (!validation.valid) {
            return validation.response;
        }

        const user = await prisma.user.findUnique({
            where: { id: validation.value },
            select: { emailVerified: true }
        });
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const newValue = !user.emailVerified;

        await prisma.user.update({
            where: { id: validation.value },
            data: { emailVerified: newValue }
        });

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: newValue ? "USER_VERIFY_EMAIL" : "USER_UNVERIFY_EMAIL",
            entityType: "User",
            entityId: validation.value,
            beforeJson: { emailVerified: user.emailVerified },
            afterJson: { emailVerified: newValue },
            ipAddress,
            userAgent
        });

        return NextResponse.json({ success: true, emailVerified: newValue });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        const msg = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ error: msg }, { status: 400 });
    }
}
