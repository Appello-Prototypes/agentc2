import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

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

        const { name, description, cronExpr, timezone, input, isActive } = body;

        if (!name || !cronExpr) {
            return NextResponse.json(
                { success: false, error: "Missing required fields: name, cronExpr" },
                { status: 400 }
            );
        }

        // Validate cron expression (basic validation)
        const cronParts = cronExpr.split(" ");
        if (cronParts.length < 5 || cronParts.length > 6) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid cron expression. Expected 5 or 6 parts."
                },
                { status: 400 }
            );
        }

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

        // Calculate next run time (simplified - just use current time + 1 minute for now)
        // In production, use a cron parser library
        const nextRunAt = new Date(Date.now() + 60000);

        // Create schedule
        const schedule = await prisma.agentSchedule.create({
            data: {
                agentId: agent.id,
                workspaceId: agent.workspaceId,
                name,
                description,
                cronExpr,
                timezone: timezone || "UTC",
                inputJson: input ? JSON.parse(JSON.stringify(input)) : null,
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
