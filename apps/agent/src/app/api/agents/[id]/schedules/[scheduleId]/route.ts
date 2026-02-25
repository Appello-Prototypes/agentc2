import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { getNextRunAt } from "@/lib/schedule-utils";

/**
 * PATCH /api/agents/[id]/schedules/[scheduleId]
 *
 * Update an existing schedule.
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; scheduleId: string }> }
) {
    try {
        const { id, scheduleId } = await params;
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

        const schedule = await prisma.agentSchedule.findFirst({
            where: { id: scheduleId, agentId: agent.id }
        });

        if (!schedule) {
            return NextResponse.json(
                { success: false, error: `Schedule '${scheduleId}' not found` },
                { status: 404 }
            );
        }

        const updateData: Record<string, unknown> = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (task !== undefined) updateData.task = task || null;
        if (cronExpr !== undefined) updateData.cronExpr = cronExpr;
        if (timezone !== undefined) updateData.timezone = timezone;
        if (isActive !== undefined) updateData.isActive = isActive !== false;
        if (color !== undefined) updateData.color = color || null;

        if (
            input !== undefined ||
            context !== undefined ||
            maxSteps !== undefined ||
            environment !== undefined
        ) {
            updateData.inputJson = JSON.parse(
                JSON.stringify({
                    input,
                    context,
                    maxSteps,
                    environment
                })
            );
        }

        const shouldRecalculate =
            cronExpr !== undefined ||
            timezone !== undefined ||
            (isActive === true && schedule.isActive === false);

        if (shouldRecalculate) {
            const resolvedCron = cronExpr ?? schedule.cronExpr;
            const resolvedTimezone = (timezone ?? schedule.timezone) || "UTC";

            try {
                updateData.nextRunAt = getNextRunAt(resolvedCron, resolvedTimezone, new Date());
            } catch (error) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            error instanceof Error
                                ? error.message
                                : "Invalid schedule configuration"
                    },
                    { status: 400 }
                );
            }
        }

        if (isActive === false) {
            updateData.nextRunAt = null;
        }

        const updated = await prisma.agentSchedule.update({
            where: { id: schedule.id },
            data: updateData
        });

        return NextResponse.json({
            success: true,
            schedule: {
                id: updated.id,
                name: updated.name,
                description: updated.description,
                task: updated.task,
                cronExpr: updated.cronExpr,
                timezone: updated.timezone,
                isActive: updated.isActive,
                nextRunAt: updated.nextRunAt,
                updatedAt: updated.updatedAt,
                color: updated.color
            }
        });
    } catch (error) {
        console.error("[Schedules] Error updating:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to update schedule"
            },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/agents/[id]/schedules/[scheduleId]
 *
 * Delete a schedule.
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; scheduleId: string }> }
) {
    try {
        const { id, scheduleId } = await params;

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

        const schedule = await prisma.agentSchedule.findFirst({
            where: { id: scheduleId, agentId: agent.id }
        });

        if (!schedule) {
            return NextResponse.json(
                { success: false, error: `Schedule '${scheduleId}' not found` },
                { status: 404 }
            );
        }

        await prisma.agentSchedule.delete({ where: { id: schedule.id } });

        return NextResponse.json({
            success: true,
            message: "Schedule deleted"
        });
    } catch (error) {
        console.error("[Schedules] Error deleting:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to delete schedule"
            },
            { status: 500 }
        );
    }
}
