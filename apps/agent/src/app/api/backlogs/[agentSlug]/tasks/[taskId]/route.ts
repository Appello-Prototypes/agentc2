/**
 * Backlog Task Detail API
 *
 * PATCH  /api/backlogs/:agentSlug/tasks/:taskId -- Update a task
 * DELETE /api/backlogs/:agentSlug/tasks/:taskId -- Delete a task
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma, type Prisma } from "@repo/database";
import { recordActivity } from "@repo/mastra/activity/service";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ agentSlug: string; taskId: string }> }
) {
    try {
        const { taskId } = await params;
        const body = await request.json();

        const task = await prisma.backlogTask.findUnique({
            where: { id: taskId },
            include: {
                backlog: {
                    include: {
                        agent: {
                            select: {
                                id: true,
                                slug: true,
                                name: true,
                                tenantId: true,
                                workspaceId: true
                            }
                        }
                    }
                }
            }
        });

        if (!task) {
            return NextResponse.json(
                { success: false, error: `Task not found: ${taskId}` },
                { status: 404 }
            );
        }

        const data: Prisma.BacklogTaskUpdateInput = {};
        if (body.status) data.status = body.status;
        if (body.priority !== undefined) data.priority = body.priority;
        if (body.lastAttemptNote) {
            data.lastAttemptNote = body.lastAttemptNote;
            data.lastAttemptAt = new Date();
        }
        if (body.result) data.result = body.result;
        if (body.dueDate) data.dueDate = new Date(body.dueDate);
        if (body.status === "COMPLETED") data.completedAt = new Date();

        const updated = await prisma.backlogTask.update({
            where: { id: taskId },
            data
        });

        // Record activity on status change
        if (body.status && body.status !== task.status) {
            const agent = task.backlog.agent;
            const eventType =
                body.status === "COMPLETED"
                    ? ("TASK_COMPLETED" as const)
                    : body.status === "FAILED"
                      ? ("TASK_FAILED" as const)
                      : body.status === "DEFERRED"
                        ? ("TASK_DEFERRED" as const)
                        : ("SYSTEM_EVENT" as const);

            recordActivity({
                type: eventType,
                agentId: agent.id,
                agentSlug: agent.slug,
                agentName: agent.name,
                summary: `Task "${task.title}" ${body.status.toLowerCase()}`,
                status:
                    body.status === "COMPLETED"
                        ? "success"
                        : body.status === "FAILED"
                          ? "failure"
                          : "info",
                taskId: task.id,
                tenantId: agent.tenantId ?? undefined,
                workspaceId: agent.workspaceId ?? undefined
            });
        }

        return NextResponse.json({ success: true, task: updated });
    } catch (error) {
        console.error("[Backlog Task API] Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ agentSlug: string; taskId: string }> }
) {
    try {
        const { taskId } = await params;

        await prisma.backlogTask.delete({ where: { id: taskId } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Backlog Task API] Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
