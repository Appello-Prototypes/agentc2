/**
 * Backlog Tools -- Agent work queue management.
 *
 * 5 tools for agents to manage their persistent backlog:
 * - backlog-get: View backlog summary with task counts
 * - backlog-add-task: Add a task (auto-creates backlog if needed)
 * - backlog-list-tasks: List tasks with filters
 * - backlog-update-task: Update task status/notes
 * - backlog-complete-task: Mark task done with result
 *
 * All tools use direct Prisma calls (no HTTP self-calls).
 * Each state change records an ActivityEvent for the feed.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { prisma, type Prisma } from "@repo/database";
import { recordActivity } from "../activity/service";

const baseOutputSchema = z.object({ success: z.boolean().optional() }).passthrough();

/**
 * Resolve agent ID and slug from a slug input.
 * Returns the agent record needed for backlog operations.
 */
async function resolveAgent(agentSlug: string) {
    const agent = await prisma.agent.findFirst({
        where: { slug: agentSlug },
        select: { id: true, slug: true, name: true, tenantId: true, workspaceId: true }
    });
    if (!agent) {
        throw new Error(`Agent not found: ${agentSlug}`);
    }
    return agent;
}

/**
 * Get or create a backlog for an agent. Upsert pattern.
 */
async function getOrCreateBacklog(
    agentId: string,
    tenantId?: string | null,
    workspaceId?: string | null
) {
    let backlog = await prisma.backlog.findUnique({ where: { agentId } });
    if (!backlog) {
        backlog = await prisma.backlog.create({
            data: {
                agentId,
                tenantId: tenantId ?? undefined,
                workspaceId: workspaceId ?? undefined
            }
        });
    }
    return backlog;
}

// ─── backlog-get ─────────────────────────────────────────────────────────────

export const backlogGetTool = createTool({
    id: "backlog-get",
    description:
        "Get an agent's backlog with task counts by status. " +
        "Auto-creates the backlog if it doesn't exist yet.",
    inputSchema: z.object({
        agentSlug: z.string().describe("Agent slug to get backlog for")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentSlug }) => {
        const agent = await resolveAgent(agentSlug);
        const backlog = await getOrCreateBacklog(agent.id, agent.tenantId, agent.workspaceId);

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

        return {
            success: true,
            backlog: {
                id: backlog.id,
                agentSlug: agent.slug,
                agentName: agent.name,
                name: backlog.name,
                description: backlog.description,
                totalTasks: total,
                tasksByStatus,
                createdAt: backlog.createdAt
            }
        };
    }
});

// ─── backlog-add-task ────────────────────────────────────────────────────────

export const backlogAddTaskTool = createTool({
    id: "backlog-add-task",
    description:
        "Add a task to an agent's backlog. Auto-creates the backlog if it doesn't exist. " +
        "Tasks persist across sessions and are processed during heartbeat runs.",
    inputSchema: z.object({
        agentSlug: z.string().describe("Agent slug to add task to"),
        title: z.string().describe("Short task title"),
        description: z.string().optional().describe("Detailed task description"),
        priority: z
            .number()
            .min(0)
            .max(10)
            .optional()
            .describe("Priority 0-10 (default: 5, 10=critical)"),
        dueDate: z.string().optional().describe("Due date (ISO 8601 string)"),
        tags: z.array(z.string()).optional().describe("Tags for categorization"),
        source: z
            .string()
            .optional()
            .describe("Source: human, agent, heartbeat, campaign, trigger, slack"),
        createdById: z.string().optional().describe("User ID or agent slug that created this task"),
        contextJson: z.record(z.unknown()).optional().describe("Additional context as JSON")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({
        agentSlug,
        title,
        description,
        priority,
        dueDate,
        tags,
        source,
        createdById,
        contextJson
    }) => {
        const agent = await resolveAgent(agentSlug);
        const backlog = await getOrCreateBacklog(agent.id, agent.tenantId, agent.workspaceId);

        const task = await prisma.backlogTask.create({
            data: {
                backlogId: backlog.id,
                title,
                description,
                priority: priority ?? 5,
                dueDate: dueDate ? new Date(dueDate) : undefined,
                tags: tags ?? [],
                source,
                createdById,
                contextJson: (contextJson as Prisma.InputJsonValue) ?? undefined
            }
        });

        // Record activity event
        recordActivity({
            type: "TASK_CREATED",
            agentId: agent.id,
            agentSlug: agent.slug,
            agentName: agent.name,
            summary: `Task "${title}" added to ${agent.name}'s backlog`,
            detail: description,
            status: "info",
            source: source ?? "agent",
            taskId: task.id,
            tags: tags ?? [],
            tenantId: agent.tenantId ?? undefined,
            workspaceId: agent.workspaceId ?? undefined
        });

        return {
            success: true,
            task: {
                id: task.id,
                title: task.title,
                priority: task.priority,
                status: task.status,
                dueDate: task.dueDate,
                createdAt: task.createdAt
            }
        };
    }
});

// ─── backlog-list-tasks ──────────────────────────────────────────────────────

export const backlogListTasksTool = createTool({
    id: "backlog-list-tasks",
    description:
        "List tasks from an agent's backlog with optional filters. " +
        "Default: pending and in-progress tasks, sorted by priority (highest first).",
    inputSchema: z.object({
        agentSlug: z.string().describe("Agent slug"),
        status: z
            .string()
            .optional()
            .describe(
                "Filter by status: PENDING, IN_PROGRESS, COMPLETED, FAILED, DEFERRED. Comma-separated for multiple."
            ),
        limit: z.number().optional().describe("Max tasks to return (default: 20)"),
        sortBy: z
            .enum(["priority", "dueDate", "createdAt"])
            .optional()
            .describe("Sort field (default: priority)")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentSlug, status, limit, sortBy }) => {
        const agent = await resolveAgent(agentSlug);
        const backlog = await prisma.backlog.findUnique({
            where: { agentId: agent.id }
        });

        if (!backlog) {
            return { success: true, tasks: [], total: 0 };
        }

        const statusFilter = status
            ? {
                  in: status.split(",").map((s) => s.trim()) as Array<
                      "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "DEFERRED"
                  >
              }
            : { in: ["PENDING" as const, "IN_PROGRESS" as const] };

        const orderBy: Prisma.BacklogTaskOrderByWithRelationInput =
            sortBy === "dueDate"
                ? { dueDate: "asc" }
                : sortBy === "createdAt"
                  ? { createdAt: "desc" }
                  : { priority: "desc" };

        const tasks = await prisma.backlogTask.findMany({
            where: {
                backlogId: backlog.id,
                status: statusFilter
            },
            orderBy,
            take: limit ?? 20
        });

        return {
            success: true,
            tasks: tasks.map((t) => ({
                id: t.id,
                title: t.title,
                description: t.description,
                status: t.status,
                priority: t.priority,
                dueDate: t.dueDate,
                source: t.source,
                lastAttemptAt: t.lastAttemptAt,
                lastAttemptNote: t.lastAttemptNote,
                result: t.result,
                tags: t.tags,
                createdAt: t.createdAt
            })),
            total: tasks.length
        };
    }
});

// ─── backlog-update-task ─────────────────────────────────────────────────────

export const backlogUpdateTaskTool = createTool({
    id: "backlog-update-task",
    description:
        "Update a backlog task. Use to change status, add attempt notes, " +
        "update priority, or set result. Records status changes in the activity feed.",
    inputSchema: z.object({
        taskId: z.string().describe("Task ID to update"),
        status: z
            .enum(["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "DEFERRED"])
            .optional()
            .describe("New status"),
        priority: z.number().min(0).max(10).optional().describe("New priority"),
        lastAttemptNote: z.string().optional().describe("Note about what was attempted"),
        result: z.string().optional().describe("Task result (for completion)"),
        dueDate: z.string().optional().describe("New due date (ISO 8601)")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ taskId, status, priority, lastAttemptNote, result, dueDate }) => {
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
            throw new Error(`Task not found: ${taskId}`);
        }

        const data: Prisma.BacklogTaskUpdateInput = {};
        if (status) data.status = status;
        if (priority !== undefined) data.priority = priority;
        if (lastAttemptNote) {
            data.lastAttemptNote = lastAttemptNote;
            data.lastAttemptAt = new Date();
        }
        if (result) data.result = result;
        if (dueDate) data.dueDate = new Date(dueDate);
        if (status === "COMPLETED") data.completedAt = new Date();

        const updated = await prisma.backlogTask.update({
            where: { id: taskId },
            data
        });

        // Record activity event on status change
        if (status && status !== task.status) {
            const agent = task.backlog.agent;
            const eventType =
                status === "COMPLETED"
                    ? ("TASK_COMPLETED" as const)
                    : status === "FAILED"
                      ? ("TASK_FAILED" as const)
                      : status === "DEFERRED"
                        ? ("TASK_DEFERRED" as const)
                        : ("SYSTEM_EVENT" as const);

            recordActivity({
                type: eventType,
                agentId: agent.id,
                agentSlug: agent.slug,
                agentName: agent.name,
                summary:
                    status === "COMPLETED"
                        ? `Task "${task.title}" completed${result ? `: ${result.slice(0, 100)}` : ""}`
                        : status === "FAILED"
                          ? `Task "${task.title}" failed${lastAttemptNote ? `: ${lastAttemptNote.slice(0, 100)}` : ""}`
                          : status === "DEFERRED"
                            ? `Task "${task.title}" deferred${lastAttemptNote ? `: ${lastAttemptNote.slice(0, 100)}` : ""}`
                            : `Task "${task.title}" status changed to ${status}`,
                status:
                    status === "COMPLETED" ? "success" : status === "FAILED" ? "failure" : "info",
                taskId: task.id,
                tenantId: agent.tenantId ?? undefined,
                workspaceId: agent.workspaceId ?? undefined
            });
        }

        return {
            success: true,
            task: {
                id: updated.id,
                title: updated.title,
                status: updated.status,
                priority: updated.priority,
                lastAttemptNote: updated.lastAttemptNote,
                result: updated.result,
                completedAt: updated.completedAt
            }
        };
    }
});

// ─── backlog-complete-task ───────────────────────────────────────────────────

export const backlogCompleteTaskTool = createTool({
    id: "backlog-complete-task",
    description:
        "Mark a backlog task as completed with a result summary. " +
        "Shorthand for backlog-update-task with status=COMPLETED.",
    inputSchema: z.object({
        taskId: z.string().describe("Task ID to complete"),
        result: z.string().describe("What was accomplished")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ taskId, result }) => {
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
            throw new Error(`Task not found: ${taskId}`);
        }

        const updated = await prisma.backlogTask.update({
            where: { id: taskId },
            data: {
                status: "COMPLETED",
                result,
                completedAt: new Date()
            }
        });

        const agent = task.backlog.agent;
        recordActivity({
            type: "TASK_COMPLETED",
            agentId: agent.id,
            agentSlug: agent.slug,
            agentName: agent.name,
            summary: `Task "${task.title}" completed: ${result.slice(0, 120)}`,
            detail: result,
            status: "success",
            taskId: task.id,
            tenantId: agent.tenantId ?? undefined,
            workspaceId: agent.workspaceId ?? undefined
        });

        return {
            success: true,
            task: {
                id: updated.id,
                title: updated.title,
                status: updated.status,
                result: updated.result,
                completedAt: updated.completedAt
            }
        };
    }
});
