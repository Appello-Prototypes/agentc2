import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { getNextRunAt } from "@/lib/schedule-utils";
import { requireAuth } from "@/lib/authz/require-auth";
import { requireAgentAccess } from "@/lib/authz/require-agent-access";

/**
 * GET /api/agents/[id]/schedules
 *
 * List all schedules for an agent
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const { context, response: authResponse } = await requireAuth(request);
        if (authResponse) return authResponse;
        const { agentId, response: accessResponse } = await requireAgentAccess(
            context.organizationId,
            id
        );
        if (accessResponse) return accessResponse;

        // Get schedules
        const schedules = await prisma.agentSchedule.findMany({
            where: { agentId },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json({
            success: true,
            schedules: schedules.map((s) => ({
                id: s.id,
                name: s.name,
                description: s.description,
                task: s.task,
                cronExpr: s.cronExpr,
                timezone: s.timezone,
                inputJson: s.inputJson,
                isActive: s.isActive,
                lastRunAt: s.lastRunAt,
                nextRunAt: s.nextRunAt,
                runCount: s.runCount,
                createdAt: s.createdAt,
                updatedAt: s.updatedAt,
                color: s.color
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

        const { context: authContext, response: authResponse } = await requireAuth(request);
        if (authResponse) return authResponse;
        const { agentId, response: accessResponse } = await requireAgentAccess(
            authContext.organizationId,
            id
        );
        if (accessResponse) return accessResponse;

        const body = await request.json();

        const {
            name,
            description,
            task,
            cronExpr,
            timezone,
            input,
            context,
            maxSteps,
            environment,
            isActive,
            color
        } = body;

        if (!name || !cronExpr) {
            return NextResponse.json(
                { success: false, error: "Missing required fields: name, cronExpr" },
                { status: 400 }
            );
        }

        const resolvedTimezone = timezone || "UTC";

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

        const agentRecord = await prisma.agent.findUnique({
            where: { id: agentId },
            select: { workspaceId: true }
        });

        // Create schedule
        const schedule = await prisma.agentSchedule.create({
            data: {
                agentId,
                workspaceId: agentRecord!.workspaceId,
                name,
                description,
                task: task || null,
                cronExpr,
                timezone: resolvedTimezone,
                inputJson: inputJson ? JSON.parse(JSON.stringify(inputJson)) : null,
                isActive: isActive !== false,
                nextRunAt,
                color: color || null
            }
        });

        return NextResponse.json({
            success: true,
            schedule: {
                id: schedule.id,
                name: schedule.name,
                description: schedule.description,
                task: schedule.task,
                cronExpr: schedule.cronExpr,
                timezone: schedule.timezone,
                isActive: schedule.isActive,
                nextRunAt: schedule.nextRunAt,
                createdAt: schedule.createdAt,
                color: schedule.color
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
