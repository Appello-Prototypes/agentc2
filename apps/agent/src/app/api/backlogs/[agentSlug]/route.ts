/**
 * Backlog API
 *
 * GET /api/backlogs/:agentSlug -- Get agent's backlog with task stats
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ agentSlug: string }> }
) {
    try {
        const { agentSlug } = await params;

        const agent = await prisma.agent.findFirst({
            where: { slug: agentSlug },
            select: { id: true, slug: true, name: true }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent not found: ${agentSlug}` },
                { status: 404 }
            );
        }

        const backlog = await prisma.backlog.findUnique({
            where: { agentId: agent.id }
        });

        if (!backlog) {
            return NextResponse.json({
                success: true,
                backlog: null,
                message: "No backlog exists for this agent yet. Tasks will auto-create one."
            });
        }

        const counts = await prisma.backlogTask.groupBy({
            by: ["status"],
            where: { backlogId: backlog.id },
            _count: { status: true }
        });

        const tasksByStatus: Record<string, number> = {};
        let total = 0;
        for (const c of counts) {
            tasksByStatus[c.status] = c._count.status;
            total += c._count.status;
        }

        return NextResponse.json({
            success: true,
            backlog: {
                id: backlog.id,
                agentSlug: agent.slug,
                agentName: agent.name,
                name: backlog.name,
                description: backlog.description,
                totalTasks: total,
                tasksByStatus,
                createdAt: backlog.createdAt,
                updatedAt: backlog.updatedAt
            }
        });
    } catch (error) {
        console.error("[Backlog API] Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
