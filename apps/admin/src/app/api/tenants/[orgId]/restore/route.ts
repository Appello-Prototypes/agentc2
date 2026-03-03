import { NextRequest, NextResponse } from "next/server";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";
import { restoreTenant } from "@/lib/tenant-actions";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const admin = await requireAdminAction(request, "tenant:restore");
        const { orgId } = await params;

        const result = await restoreTenant(orgId, admin.adminUserId);

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "TENANT_RESTORE",
            entityType: "Organization",
            entityId: orgId,
            beforeJson: { status: result.previousStatus },
            afterJson: { status: "active" },
            ipAddress,
            userAgent,
            metadata: { restoredUserCount: result.restoredUserCount }
        });

        return NextResponse.json({ success: true, restoredUserCount: result.restoredUserCount });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        const msg = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ error: msg }, { status: 400 });
    }
}
