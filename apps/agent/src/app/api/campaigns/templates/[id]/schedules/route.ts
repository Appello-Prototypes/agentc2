import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { getDemoSession } from "@/lib/standalone-auth";
import { getNextRunAt } from "@/lib/schedule-utils";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * POST /api/campaigns/templates/[id]/schedules
 * Create a schedule for a campaign template
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    const session = await getDemoSession(request);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id: templateId } = await params;
        const body = await request.json();
        const { name, cronExpr, timezone, inputJson } = body;

        if (!name || !cronExpr) {
            return NextResponse.json({ error: "name and cronExpr are required" }, { status: 400 });
        }

        const tz = timezone || "UTC";

        // Validate cron expression and compute next run
        let nextRunAt: Date;
        try {
            nextRunAt = getNextRunAt(cronExpr, tz);
        } catch {
            return NextResponse.json({ error: "Invalid cron expression" }, { status: 400 });
        }

        const schedule = await prisma.campaignSchedule.create({
            data: {
                templateId,
                name,
                cronExpr,
                timezone: tz,
                inputJson: inputJson || null,
                nextRunAt,
                createdBy: session.user.id
            }
        });

        return NextResponse.json(schedule, { status: 201 });
    } catch (error) {
        console.error("[Campaign Schedules API] Failed to create:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to create schedule" },
            { status: 500 }
        );
    }
}
