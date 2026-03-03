import { NextRequest, NextResponse } from "next/server";
import { getNextRunTimes } from "@/lib/schedule-utils";
import { requireAuth } from "@/lib/authz/require-auth";
import { requireAgentAccess } from "@/lib/authz/require-agent-access";

/**
 * POST /api/agents/[id]/schedules/preview
 *
 * Preview next run times for a cron schedule.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const { context, response: authResponse } = await requireAuth(request);
        if (authResponse) return authResponse;
        const { response: accessResponse } = await requireAgentAccess(context.organizationId, id);
        if (accessResponse) return accessResponse;

        const body = await request.json();

        const { cronExpr, timezone, count } = body;

        if (!cronExpr) {
            return NextResponse.json(
                { success: false, error: "Missing required field: cronExpr" },
                { status: 400 }
            );
        }

        const resolvedTimezone = timezone || "UTC";
        const safeCount = typeof count === "number" ? count : 5;

        let runs: Date[];
        try {
            runs = getNextRunTimes(cronExpr, resolvedTimezone, safeCount, new Date());
        } catch (error) {
            return NextResponse.json(
                {
                    success: false,
                    error: error instanceof Error ? error.message : "Invalid schedule configuration"
                },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            preview: runs.map((run) => run.toISOString())
        });
    } catch (error) {
        console.error("[Schedules] Error previewing:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to preview schedule"
            },
            { status: 500 }
        );
    }
}
