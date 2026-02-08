import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { getNextRunAt } from "@/lib/schedule-utils";

/**
 * GET /api/agents/[id]/schedules
 *
 * List all schedules for an agent
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        // Find agent
        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id: id }]
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        // Get schedules
        const schedules = await prisma.agentSchedule.findMany({
            where: { agentId: agent.id },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json({
            success: true,
            schedules: schedules.map((s) => ({
                id: s.id,
                name: s.name,
                description: s.description,
                cronExpr: s.cronExpr,
                timezone: s.timezone,
                inputJson: s.inputJson,
                isActive: s.isActive,
                lastRunAt: s.lastRunAt,
                nextRunAt: s.nextRunAt,
                runCount: s.runCount,
                createdAt: s.createdAt,
                updatedAt: s.updatedAt
            })),
            total: schedules.length
        });
    } catch (error) {
        console.error("[Schedules] Error listing:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list schedules"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/agents/[id]/schedules
 *
 * Create a new schedule for an agent
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();

        const {
            name,
            description,
            cronExpr,
            timezone,
            input,
            context,
            maxSteps,
            environment,
            isActive
        } = body;

        if (!name || !cronExpr) {
            return NextResponse.json(
                { success: false, error: "Missing required fields: name, cronExpr" },
                { status: 400 }
            );
        }

        const resolvedTimezone = timezone || "UTC";

        // Find agent
        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id: id }]
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        let nextRunAt: Date;
        try {
            nextRunAt = getNextRunAt(cronExpr, resolvedTimezone, new Date());
        } catch (error) {
            return NextResponse.json(
                {
                    success: false,
                    error: error instanceof Error ? error.message : "Invalid schedule configuration"
                },
                { status: 400 }
            );
        }

        const inputJson =
            input !== undefined ||
            context !== undefined ||
            maxSteps !== undefined ||
            environment !== undefined
                ? { input, context, maxSteps, environment }
                : null;

        // Create schedule
        const schedule = await prisma.agentSchedule.create({
            data: {
                agentId: agent.id,
                workspaceId: agent.workspaceId,
                name,
                description,
                cronExpr,
                timezone: resolvedTimezone,
                inputJson: inputJson ? JSON.parse(JSON.stringify(inputJson)) : null,
                isActive: isActive !== false,
                nextRunAt
            }
        });

        return NextResponse.json({
            success: true,
            schedule: {
                id: schedule.id,
                name: schedule.name,
                description: schedule.description,
                cronExpr: schedule.cronExpr,
                timezone: schedule.timezone,
                isActive: schedule.isActive,
                nextRunAt: schedule.nextRunAt,
                createdAt: schedule.createdAt
            }
        });
    } catch (error) {
        console.error("[Schedules] Error creating:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to create schedule"
            },
            { status: 500 }
        );
    }
}
