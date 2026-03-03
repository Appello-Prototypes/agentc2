import { NextRequest, NextResponse } from "next/server";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";
import { deactivateTenant } from "@/lib/tenant-actions";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const admin = await requireAdminAction(request, "tenant:deactivate");
        const { orgId } = await params;
        const body = await request.json().catch(() => ({}));
        const reason = body.reason || "Deactivated by admin";

        const result = await deactivateTenant(orgId, reason, admin.adminUserId);

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "TENANT_DEACTIVATE",
            entityType: "Organization",
            entityId: orgId,
            beforeJson: { status: result.previousStatus },
            afterJson: { status: "deactivated" },
            ipAddress,
            userAgent,
            metadata: { reason, frozenUserCount: result.frozenUserCount }
        });

        return NextResponse.json({ success: true, frozenUserCount: result.frozenUserCount });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        const msg = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ error: msg }, { status: 400 });
    }
}
