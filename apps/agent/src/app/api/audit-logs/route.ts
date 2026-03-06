import { NextRequest, NextResponse } from "next/server";
import { queryAuditLogs, type AuditAction } from "@/lib/audit-log";
import { authenticateRequest } from "@/lib/api-auth";

/**
 * GET /api/audit-logs
 *
 * Query audit logs with filtering and pagination.
 *
 * Query parameters:
 * - entityType: Filter by entity type (e.g., "Agent", "AgentVersion")
 * - entityId: Filter by entity ID
 * - action: Filter by action type
 * - from: Start date (ISO string)
 * - to: End date (ISO string)
 * - limit: Max results (default: 50, max: 100)
 * - cursor: Pagination cursor
 */
export async function GET(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);

        const entityType = searchParams.get("entityType") || undefined;
        const entityId = searchParams.get("entityId") || undefined;
        const action = (searchParams.get("action") as AuditAction) || undefined;
        const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : undefined;
        const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : undefined;
        const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
        const cursor = searchParams.get("cursor") || undefined;

        const result = await queryAuditLogs({
            tenantId: authContext.organizationId,
            entityType,
            entityId,
            action,
            from,
            to,
            limit,
            cursor
        });

        return NextResponse.json({
            success: true,
            logs: result.logs.map((log) => ({
                id: log.id,
                action: log.action,
                entityType: log.entityType,
                entityId: log.entityId,
                actorId: log.actorId,
                metadata: log.metadata,
                integrityHash: log.integrityHash,
                createdAt: log.createdAt
            })),
            hasMore: result.hasMore,
            nextCursor: result.nextCursor
        });
    } catch (error) {
        console.error("[Audit Logs] Error querying:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to query audit logs"
            },
            { status: 500 }
        );
    }
}
