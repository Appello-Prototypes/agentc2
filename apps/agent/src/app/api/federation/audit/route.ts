import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { queryAuditLogs } from "@repo/agentc2/audit";

/**
 * GET /api/federation/audit
 *
 * Query federation audit logs with filtering and pagination.
 *
 * Query params:
 * - action:   Filter by action prefix (e.g. "federation.")
 * - outcome:  Filter by outcome ("success" | "denied" | "error")
 * - from:     ISO date start
 * - to:       ISO date end
 * - limit:    Results per page (default 50)
 * - offset:   Pagination offset (default 0)
 * - format:   "json" (default) or "csv"
 */
export async function GET(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const action = searchParams.get("action") || undefined;
        const outcome = searchParams.get("outcome") || undefined;
        const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : undefined;
        const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : undefined;
        const limit = parseInt(searchParams.get("limit") || "50", 10);
        const offset = parseInt(searchParams.get("offset") || "0", 10);
        const format = searchParams.get("format") || "json";

        const result = await queryAuditLogs({
            organizationId: authContext.organizationId,
            action,
            outcome,
            from,
            to,
            limit,
            offset
        });

        if (format === "csv") {
            const header = "id,timestamp,action,actorType,actorId,resource,outcome,metadata";
            const rows = result.entries.map((e) =>
                [
                    e.id,
                    e.createdAt.toISOString(),
                    e.action,
                    e.actorType,
                    e.actorId,
                    e.resource,
                    e.outcome,
                    JSON.stringify(e.metadata || {})
                ]
                    .map((v) => `"${String(v).replace(/"/g, '""')}"`)
                    .join(",")
            );
            const csv = [header, ...rows].join("\n");
            return new NextResponse(csv, {
                headers: {
                    "Content-Type": "text/csv",
                    "Content-Disposition": `attachment; filename="federation-audit-${new Date().toISOString().slice(0, 10)}.csv"`
                }
            });
        }

        return NextResponse.json({
            success: true,
            entries: result.entries,
            total: result.total,
            limit,
            offset
        });
    } catch (error) {
        console.error("[Federation] Audit query error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to query audit logs" },
            { status: 500 }
        );
    }
}
