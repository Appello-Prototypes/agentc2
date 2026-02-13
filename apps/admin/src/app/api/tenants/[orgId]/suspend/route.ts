import { NextRequest, NextResponse } from "next/server";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";
import { suspendTenant } from "@/lib/tenant-actions";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const admin = await requireAdminAction(request, "tenant:suspend");
        const { orgId } = await params;
        const body = await request.json().catch(() => ({}));
        const reason = body.reason || "Suspended by admin";

        const result = await suspendTenant(orgId, reason, admin.adminUserId);

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "TENANT_SUSPEND",
            entityType: "Organization",
            entityId: orgId,
            beforeJson: { status: result.previousStatus },
            afterJson: { status: "suspended" },
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
