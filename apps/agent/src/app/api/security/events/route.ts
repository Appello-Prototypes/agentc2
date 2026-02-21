import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";

const SECURITY_ACTIONS = [
    "AUTH_LOGIN_FAILURE",
    "AUTH_LOGIN_SUCCESS",
    "AUTH_LOGOUT",
    "AUTH_SESSION_CREATED",
    "USER_DELETE",
    "USER_DATA_EXPORT",
    "DSR_CREATE",
    "DSR_COMPLETE",
    "CREDENTIAL_ACCESS",
    "CREDENTIAL_CREATE",
    "CREDENTIAL_DELETE",
    "ACCOUNT_FREEZE",
    "ACCOUNT_UNFREEZE"
];

/**
 * GET /api/security/events
 *
 * Query security-relevant events from the audit log.
 * Accessible by authenticated users for their org-scoped events.
 *
 * Query params:
 *   - limit (default 100, max 500)
 *   - offset (default 0)
 *   - action (filter by specific action)
 *   - since (ISO date string)
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(request.url);
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const actionFilter = url.searchParams.get("action");
        const since = url.searchParams.get("since");

        const where: Record<string, unknown> = {
            action: actionFilter
                ? { in: [actionFilter].filter((a) => SECURITY_ACTIONS.includes(a)) }
                : { in: SECURITY_ACTIONS }
        };

        if (since) {
            where.createdAt = { gte: new Date(since) };
        }

        const membership = await prisma.membership.findFirst({
            where: { userId: session.user.id },
            select: { organizationId: true, role: true }
        });

        if (membership) {
            where.tenantId = membership.organizationId;
        }

        const [events, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: offset,
                take: limit,
                select: {
                    id: true,
                    action: true,
                    entityType: true,
                    entityId: true,
                    actorId: true,
                    metadata: true,
                    createdAt: true
                }
            }),
            prisma.auditLog.count({ where })
        ]);

        return NextResponse.json({
            success: true,
            events,
            pagination: { total, limit, offset }
        });
    } catch (error) {
        console.error("[Security Events] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to query security events"
            },
            { status: 500 }
        );
    }
}
