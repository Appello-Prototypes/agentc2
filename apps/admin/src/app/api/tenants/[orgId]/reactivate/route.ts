import { NextRequest, NextResponse } from "next/server";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";
import { reactivateTenant } from "@/lib/tenant-actions";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const admin = await requireAdminAction(request, "tenant:reactivate");
        const { orgId } = await params;

        const result = await reactivateTenant(orgId, admin.adminUserId);

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "TENANT_REACTIVATE",
            entityType: "Organization",
            entityId: orgId,
            beforeJson: { status: result.previousStatus },
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
