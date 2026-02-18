/**
 * Coding Pipeline Tools
 *
 * Entry-point tool for dispatching coding pipeline workflows.
 * Normalizes tickets from different sources (SupportTicket, BacklogTask,
 * GitHub Issue) into a common format and triggers the coding pipeline.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const ticketSourceSchema = z.enum(["support_ticket", "backlog_task", "github_issue", "manual"]);

const normalizedTicketSchema = z.object({
    sourceType: ticketSourceSchema,
    sourceId: z.string(),
    title: z.string(),
    description: z.string(),
    type: z.string().nullable(),
    priority: z.string().nullable(),
    repository: z.string().nullable(),
    context: z.unknown().nullable()
});

// ─── ingest-ticket ───────────────────────────────────────────────────────────

export const ingestTicketTool = createTool({
    id: "ingest-ticket",
    description:
        "Fetch and normalize a ticket from any source (SupportTicket, BacklogTask, " +
        "or GitHub Issue) into a common format for the coding pipeline.",
    inputSchema: z.object({
        sourceType: ticketSourceSchema.describe("Type of ticket source"),
        sourceId: z.string().describe("ID of the ticket/task/issue"),
        repository: z
            .string()
            .optional()
            .describe("Target repository URL (required for support_ticket, optional otherwise)"),
        organizationId: z.string().optional()
    }),
    outputSchema: normalizedTicketSchema,
    execute: async ({ sourceType, sourceId, repository, organizationId }) => {
        switch (sourceType) {
            case "support_ticket": {
                const { prisma } = await import("@repo/database");
                const ticket = await prisma.supportTicket.findUnique({
                    where: { id: sourceId }
                });
                if (!ticket) {
                    throw new Error(`SupportTicket not found: ${sourceId}`);
                }
                return {
                    sourceType,
                    sourceId,
                    title: ticket.title,
                    description: ticket.description || "",
                    type: ticket.type,
                    priority: ticket.priority,
                    repository: repository || null,
                    context: ticket.metadata
                };
            }

            case "backlog_task": {
                const { prisma } = await import("@repo/database");
                const task = await prisma.backlogTask.findUnique({
                    where: { id: sourceId }
                });
                if (!task) {
                    throw new Error(`BacklogTask not found: ${sourceId}`);
                }
                return {
                    sourceType,
                    sourceId,
                    title: task.title,
                    description: task.description || "",
                    type: null,
                    priority: String(task.priority),
                    repository: repository || null,
                    context: task.contextJson
                };
            }

            case "github_issue": {
                return {
                    sourceType,
                    sourceId,
                    title: `GitHub Issue #${sourceId}`,
                    description: "",
                    type: null,
                    priority: null,
                    repository: repository || null,
                    context: null
                };
            }

            case "manual": {
                return {
                    sourceType,
                    sourceId: sourceId || "manual",
                    title: sourceId,
                    description: "",
                    type: null,
                    priority: null,
                    repository: repository || null,
                    context: null
                };
            }

            default:
                throw new Error(`Unknown source type: ${sourceType}`);
        }
    }
});

// ─── dispatch-coding-pipeline ────────────────────────────────────────────────

export const dispatchCodingPipelineTool = createTool({
    id: "dispatch-coding-pipeline",
    description:
        "Dispatch a ticket to the autonomous coding pipeline. " +
        "Takes a ticket source (SupportTicket, BacklogTask, or GitHub Issue), " +
        "normalizes it, and triggers the coding-pipeline workflow. " +
        "Returns the pipeline run ID for tracking.",
    inputSchema: z.object({
        sourceType: ticketSourceSchema.describe("Type of ticket source"),
        sourceId: z.string().describe("ID of the ticket/task/issue"),
        repository: z.string().describe("Target GitHub repository URL"),
        branch: z.string().optional().describe("Base branch (default: 'main')"),
        variant: z
            .enum(["standard", "internal"])
            .optional()
            .describe(
                "Pipeline variant: 'standard' for customer use, 'internal' for self-development"
            ),
        organizationId: z.string().optional()
    }),
    outputSchema: z.object({
        success: z.boolean(),
        pipelineRunId: z.string().nullable(),
        workflowRunId: z.string().nullable(),
        message: z.string()
    }),
    execute: async ({ sourceType, sourceId, repository, branch, variant, organizationId }) => {
        try {
            const { prisma } = await import("@repo/database");

            const pipelineRun = await prisma.codingPipelineRun.create({
                data: {
                    sourceType,
                    sourceId,
                    repository,
                    baseBranch: branch || "main",
                    status: "running",
                    variant: variant || "standard",
                    organizationId: organizationId || null
                }
            });

            const workflowSlug =
                variant === "internal" ? "coding-pipeline-internal" : "coding-pipeline";

            const workflow = await prisma.workflow.findFirst({
                where: {
                    slug: workflowSlug,
                    isActive: true
                }
            });

            if (!workflow) {
                await prisma.codingPipelineRun.update({
                    where: { id: pipelineRun.id },
                    data: { status: "failed" }
                });

                return {
                    success: false,
                    pipelineRunId: pipelineRun.id,
                    workflowRunId: null,
                    message: `Workflow '${workflowSlug}' not found. Create it first.`
                };
            }

            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

            const workflowResponse = await fetch(
                `${baseUrl}/agent/api/workflows/${workflowSlug}/execute`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        input: {
                            sourceType,
                            sourceId,
                            repository,
                            branch: branch || "main",
                            pipelineRunId: pipelineRun.id,
                            organizationId
                        },
                        source: "coding-pipeline",
                        triggerType: "EVENT"
                    })
                }
            );

            const workflowResult = await workflowResponse.json();

            if (workflowResult.runId) {
                await prisma.codingPipelineRun.update({
                    where: { id: pipelineRun.id },
                    data: { workflowRunId: workflowResult.runId }
                });
            }

            if (sourceType === "support_ticket") {
                await prisma.supportTicket
                    .update({
                        where: { id: sourceId },
                        data: {
                            status: "IN_PROGRESS",
                            pipelineRunId: pipelineRun.id
                        }
                    })
                    .catch(() => {});
            } else if (sourceType === "backlog_task") {
                await prisma.backlogTask
                    .update({
                        where: { id: sourceId },
                        data: {
                            status: "IN_PROGRESS",
                            pipelineRunId: pipelineRun.id
                        }
                    })
                    .catch(() => {});
            }

            return {
                success: true,
                pipelineRunId: pipelineRun.id,
                workflowRunId: workflowResult.runId || null,
                message: `Coding pipeline dispatched. Run ID: ${pipelineRun.id}`
            };
        } catch (error) {
            return {
                success: false,
                pipelineRunId: null,
                workflowRunId: null,
                message: `Failed to dispatch pipeline: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
});

// ─── update-pipeline-status ──────────────────────────────────────────────────

export const updatePipelineStatusTool = createTool({
    id: "update-pipeline-status",
    description:
        "Update the status of a coding pipeline run. Called by workflow steps " +
        "as the pipeline progresses through stages.",
    inputSchema: z.object({
        pipelineRunId: z.string(),
        status: z.enum([
            "running",
            "awaiting_plan_approval",
            "coding",
            "verifying",
            "awaiting_pr_review",
            "merged",
            "deployed",
            "failed"
        ]),
        cursorAgentId: z.string().optional(),
        targetBranch: z.string().optional(),
        prNumber: z.number().optional(),
        prUrl: z.string().optional(),
        riskLevel: z.enum(["trivial", "low", "medium", "high", "critical"]).optional(),
        totalCostUsd: z.number().optional()
    }),
    outputSchema: z.object({
        success: z.boolean()
    }),
    execute: async ({
        pipelineRunId,
        status,
        cursorAgentId,
        targetBranch,
        prNumber,
        prUrl,
        riskLevel,
        totalCostUsd
    }) => {
        const { prisma } = await import("@repo/database");

        await prisma.codingPipelineRun.update({
            where: { id: pipelineRunId },
            data: {
                status,
                ...(cursorAgentId !== undefined && { cursorAgentId }),
                ...(targetBranch !== undefined && { targetBranch }),
                ...(prNumber !== undefined && { prNumber }),
                ...(prUrl !== undefined && { prUrl }),
                ...(riskLevel !== undefined && { riskLevel }),
                ...(totalCostUsd !== undefined && { totalCostUsd })
            }
        });

        return { success: true };
    }
});
