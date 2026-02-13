import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";

/**
 * Start an impersonation session (read-only).
 * POST with { reason: string, orgId: string }
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const admin = await requireAdminAction(request, "user:impersonate");
        const { userId } = await params;
        const body = await request.json();

        if (!body.reason || body.reason.length < 10) {
            return NextResponse.json(
                { error: "A reason (min 10 chars) is required for impersonation" },
                { status: 400 }
            );
        }
        if (!body.orgId) {
            return NextResponse.json({ error: "orgId is required" }, { status: 400 });
        }

        const { ipAddress, userAgent } = getRequestContext(request);

        // Create impersonation session (expires in 30 minutes)
        const session = await prisma.impersonationSession.create({
            data: {
                adminUserId: admin.adminUserId,
                targetUserId: userId,
                targetOrgId: body.orgId,
                reason: body.reason,
                ipAddress: ipAddress,
                expiresAt: new Date(Date.now() + 30 * 60 * 1000)
            }
        });

        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "USER_IMPERSONATE_START",
            entityType: "User",
            entityId: userId,
            ipAddress,
            userAgent,
            metadata: { reason: body.reason, orgId: body.orgId, sessionId: session.id }
        });

        return NextResponse.json({
            success: true,
            sessionId: session.id,
            expiresAt: session.expiresAt
        });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * End an impersonation session.
 * DELETE with { sessionId: string }
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const admin = await requireAdminAction(request, "user:impersonate");
        const { userId } = await params;
        const url = new URL(request.url);
        const sessionId = url.searchParams.get("sessionId");

        if (!sessionId) {
            return NextResponse.json({ error: "sessionId required" }, { status: 400 });
        }

        await prisma.impersonationSession.update({
            where: { id: sessionId },
            data: { endedAt: new Date() }
        });

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "USER_IMPERSONATE_END",
            entityType: "User",
            entityId: userId,
            ipAddress,
            userAgent,
            metadata: { sessionId }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
