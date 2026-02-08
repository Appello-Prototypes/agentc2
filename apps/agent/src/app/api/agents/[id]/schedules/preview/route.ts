import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { getNextRunTimes } from "@/lib/schedule-utils";

/**
 * POST /api/agents/[id]/schedules/preview
 *
 * Preview next run times for a cron schedule.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();

        const { cronExpr, timezone, count } = body;

        if (!cronExpr) {
            return NextResponse.json(
                { success: false, error: "Missing required field: cronExpr" },
                { status: 400 }
            );
        }

        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id }]
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
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
