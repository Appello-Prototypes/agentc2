/**
 * Backlog Tasks API
 *
 * GET  /api/backlogs/:agentSlug/tasks -- List tasks with filters
 * POST /api/backlogs/:agentSlug/tasks -- Add a task
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma, type Prisma, type BacklogTaskStatus } from "@repo/database"
import { recordActivity } from "@repo/mastra/activity/service"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ agentSlug: string }> }
) {
    try {
        const { agentSlug } = await params
        const { searchParams } = new URL(request.url)

        const agent = await prisma.agent.findFirst({
            where: { slug: agentSlug },
            select: { id: true },
        })

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent not found: ${agentSlug}` },
                { status: 404 }
            )
        }

        const backlog = await prisma.backlog.findUnique({
            where: { agentId: agent.id },
        })

        if (!backlog) {
            return NextResponse.json({ success: true, tasks: [], total: 0 })
        }

        const statusParam = searchParams.get("status")
        const limit = parseInt(searchParams.get("limit") || "20")
        const sortBy = searchParams.get("sortBy") || "priority"

        const statusFilter: Prisma.EnumBacklogTaskStatusFilter = statusParam
            ? { in: statusParam.split(",").map((s) => s.trim()) as BacklogTaskStatus[] }
            : { in: ["PENDING", "IN_PROGRESS"] }

        const orderBy: Prisma.BacklogTaskOrderByWithRelationInput =
            sortBy === "dueDate"
                ? { dueDate: "asc" }
                : sortBy === "createdAt"
                  ? { createdAt: "desc" }
                  : { priority: "desc" }

        const tasks = await prisma.backlogTask.findMany({
            where: { backlogId: backlog.id, status: statusFilter },
            orderBy,
            take: limit,
        })

        return NextResponse.json({ success: true, tasks, total: tasks.length })
    } catch (error) {
        console.error("[Backlog Tasks API] Error:", error)
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        )
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ agentSlug: string }> }
) {
    try {
        const { agentSlug } = await params
        const body = await request.json()

        const agent = await prisma.agent.findFirst({
            where: { slug: agentSlug },
            select: { id: true, slug: true, name: true, tenantId: true, workspaceId: true },
        })

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent not found: ${agentSlug}` },
                { status: 404 }
            )
        }

        // Upsert backlog
        let backlog = await prisma.backlog.findUnique({ where: { agentId: agent.id } })
        if (!backlog) {
            backlog = await prisma.backlog.create({
                data: {
                    agentId: agent.id,
                    tenantId: agent.tenantId ?? undefined,
                    workspaceId: agent.workspaceId ?? undefined,
                },
            })
        }

        const task = await prisma.backlogTask.create({
            data: {
                backlogId: backlog.id,
                title: body.title,
                description: body.description,
                priority: body.priority ?? 5,
                dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
                tags: body.tags ?? [],
                source: body.source,
                createdById: body.createdById,
                contextJson: body.contextJson ?? undefined,
            },
        })

        recordActivity({
            type: "TASK_CREATED",
            agentId: agent.id,
            agentSlug: agent.slug,
            agentName: agent.name,
            summary: `Task "${body.title}" added to ${agent.name}'s backlog`,
            detail: body.description,
            status: "info",
            source: body.source ?? "api",
            taskId: task.id,
            tenantId: agent.tenantId ?? undefined,
            workspaceId: agent.workspaceId ?? undefined,
        })

        return NextResponse.json({ success: true, task }, { status: 201 })
    } catch (error) {
        console.error("[Backlog Tasks API] Error:", error)
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        )
    }
}
