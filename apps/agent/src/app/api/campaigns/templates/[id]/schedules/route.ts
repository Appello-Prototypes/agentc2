import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { getDemoSession } from "@/lib/standalone-auth";
import { getNextRunAt } from "@/lib/schedule-utils";
import { getUserOrganizationId } from "@/lib/organization";

interface RouteParams {
    params: Promise<{ id: string }>;
}

async function getOrgMemberIds(userId: string): Promise<string[]> {
    const membership = await prisma.membership.findFirst({
        where: { userId },
        select: { organizationId: true }
    });
    if (!membership) return [userId];
    const members = await prisma.membership.findMany({
        where: { organizationId: membership.organizationId },
        select: { userId: true }
    });
    return members.map((m) => m.userId);
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
        const memberIds = await getOrgMemberIds(session.user.id);

        const template = await prisma.campaignTemplate.findFirst({
            where: {
                id: templateId,
                createdBy: { in: memberIds }
            },
            select: { id: true }
        });
        if (!template) {
            return NextResponse.json({ error: "Template not found" }, { status: 404 });
        }

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

        const organizationId = await getUserOrganizationId(session.user.id);
        if (!organizationId) {
            return NextResponse.json({ error: "No organization found" }, { status: 400 });
        }

        const schedule = await prisma.campaignSchedule.create({
            data: {
                templateId,
                name,
                cronExpr,
                timezone: tz,
                inputJson: inputJson || null,
                nextRunAt,
                organizationId,
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
