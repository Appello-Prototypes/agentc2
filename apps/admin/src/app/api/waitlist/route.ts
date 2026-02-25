import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";

/**
 * DELETE /api/waitlist
 *
 * Bulk delete waitlist entries.
 * Body: { ids: string[] }
 */
export async function DELETE(request: NextRequest) {
    try {
        const admin = await requireAdminAction(request, "waitlist:delete");
        const body = await request.json().catch(() => ({}));

        const { ids } = body as { ids?: string[] };
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json(
                { error: "ids array is required and must not be empty" },
                { status: 400 }
            );
        }

        const entries = await prisma.waitlist.findMany({
            where: { id: { in: ids } },
            select: { id: true, email: true, status: true }
        });

        if (entries.length === 0) {
            return NextResponse.json(
                { error: "No entries found for the given IDs" },
                { status: 404 }
            );
        }

        await prisma.waitlist.deleteMany({
            where: { id: { in: entries.map((e) => e.id) } }
        });

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "WAITLIST_DELETE",
            entityType: "Waitlist",
            entityId: entries.map((e) => e.id).join(","),
            beforeJson: entries,
            ipAddress,
            userAgent
        });

        return NextResponse.json({
            success: true,
            deleted: entries.length
        });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[Waitlist Delete] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
