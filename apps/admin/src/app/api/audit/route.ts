import { NextRequest, NextResponse } from "next/server";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";
import { queryAdminAuditLogs, type AdminAuditAction } from "@/lib/admin-audit";

export async function GET(request: NextRequest) {
    try {
        await requireAdminAction(request, "audit:read");

        const url = new URL(request.url);
        const adminUserId = url.searchParams.get("adminUserId") || undefined;
        const action = (url.searchParams.get("action") || undefined) as
            | AdminAuditAction
            | undefined;
        const entityType = url.searchParams.get("entityType") || undefined;
        const entityId = url.searchParams.get("entityId") || undefined;
        const from = url.searchParams.get("from")
            ? new Date(url.searchParams.get("from")!)
            : undefined;
        const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : undefined;
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const cursor = url.searchParams.get("cursor") || undefined;

        const result = await queryAdminAuditLogs({
            adminUserId,
            action,
            entityType,
            entityId,
            from,
            to,
            limit,
            cursor
        });

        return NextResponse.json(result);
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
