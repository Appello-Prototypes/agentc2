import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
const IMPERSONATE_SESSION_TTL = 30 * 60; // 30 minutes

/**
 * Start an impersonation session.
 * POST with { reason?: string, orgId?: string }
 *
 * Creates a real Better Auth session for the target user and returns
 * a redirect URL that sets the session cookie in the main app.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const admin = await requireAdminAction(request, "user:impersonate");
        const { userId } = await params;
        const body = await request.json();

        const reason = body.reason || "Admin impersonation via user management";

        // Resolve the target user and their org
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        let orgId = body.orgId;
        if (!orgId) {
            const membership = await prisma.membership.findFirst({
                where: { userId },
                select: { organizationId: true }
            });
            if (!membership) {
                return NextResponse.json(
                    { error: "User has no organization memberships" },
                    { status: 400 }
                );
            }
            orgId = membership.organizationId;
        }

        const { ipAddress, userAgent } = getRequestContext(request);

        // 1. Create audit record
        const impersonationSession = await prisma.impersonationSession.create({
            data: {
                adminUserId: admin.adminUserId,
                targetUserId: userId,
                targetOrgId: orgId,
                reason,
                ipAddress: ipAddress,
                expiresAt: new Date(Date.now() + IMPERSONATE_SESSION_TTL * 1000)
            }
        });

        // 2. Create a real Better Auth session for the target user
        const sessionToken = randomBytes(32).toString("base64url");
        const expiresAt = new Date(Date.now() + IMPERSONATE_SESSION_TTL * 1000);

        await prisma.session.create({
            data: {
                token: sessionToken,
                userId,
                expiresAt,
                ipAddress: `impersonate:${ipAddress}`,
                userAgent: `admin-impersonate:${admin.adminUserId}`
            }
        });

        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "USER_IMPERSONATE_START",
            entityType: "User",
            entityId: userId,
            ipAddress,
            userAgent,
            metadata: {
                reason,
                orgId,
                sessionId: impersonationSession.id,
                targetEmail: user.email
            }
        });

        // 3. Build redirect URL to the main app's impersonate endpoint
        const redirectUrl = `${APP_URL}/api/impersonate?token=${encodeURIComponent(sessionToken)}`;

        return NextResponse.json({
            success: true,
            sessionId: impersonationSession.id,
            redirectUrl,
            expiresAt
        });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[Impersonate] Error:", error);
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
