import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { prisma, Prisma, RunEnvironment, RunStatus, RunTriggerType } from "@repo/database";
import type { WorkflowDefinition } from "../workflows/builder";

const resolveEnvironment = (requested?: string | null, fallback?: string | null) => {
    const normalized = (requested || fallback || "").trim().toLowerCase();
    if (["prod", "production", "live"].includes(normalized)) {
        return RunEnvironment.PRODUCTION;
    }
    if (["staging", "stage", "preprod"].includes(normalized)) {
        return RunEnvironment.STAGING;
    }
    return RunEnvironment.DEVELOPMENT;
};

const resolveTriggerType = (requested?: string | null, source?: string | null) => {
    const normalized = (requested || source || "").trim().toLowerCase();
    if (["manual", "ui"].includes(normalized)) {
        return RunTriggerType.MANUAL;
    }
    if (["schedule", "scheduled", "cron"].includes(normalized)) {
        return RunTriggerType.SCHEDULED;
    }
    if (["webhook"].includes(normalized)) {
        return RunTriggerType.WEBHOOK;
    }
    if (["tool", "mcp"].includes(normalized)) {
        return RunTriggerType.TOOL;
    }
    if (["test"].includes(normalized)) {
        return RunTriggerType.TEST;
    }
    if (["retry"].includes(normalized)) {
        return RunTriggerType.RETRY;
    }
    return RunTriggerType.API;
};

const mapStepStatus = (status: "completed" | "failed" | "suspended") => {
    if (status === "failed") return RunStatus.FAILED;
    if (status === "suspended") return RunStatus.RUNNING;
    return RunStatus.COMPLETED;
};

export const workflowExecuteTool = createTool({
    id: "workflow-execute",
    description: "Execute a workflow by slug or ID and return output plus run metadata.",
    inputSchema: z.object({
        workflowSlug: z.string().describe("Workflow slug or ID"),
        input: z.record(z.any()).describe("Workflow input payload"),
        source: z.string().optional().describe("Source channel (api, webhook, test, etc.)"),
        environment: z
            .string()
            .optional()
            .describe("Environment (development, staging, production)"),
        triggerType: z
            .string()
            .optional()
            .describe("Trigger type (manual, api, scheduled, webhook, tool, test, retry)"),
        requestContext: z.record(z.any()).optional().describe("Optional request context")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        runId: z.string().optional(),
        status: z.string(),
        output: z.any().optional(),
        error: z.any().optional(),
        run: z.any().optional()
    }),
    execute: async ({ workflowSlug, input, source, environment, triggerType, requestContext }) => {
        const workflow = await prisma.workflow.findFirst({
            where: { OR: [{ slug: workflowSlug }, { id: workflowSlug }] },
            include: { workspace: { select: { environment: true } } }
        });

        if (!workflow) {
            throw new Error(`Workflow '${workflowSlug}' not found`);
        }

        const run = await prisma.workflowRun.create({
            data: {
                workflowId: workflow.id,
                status: RunStatus.RUNNING,
                inputJson: input,
                source: source || "api",
                environment: resolveEnvironment(environment, workflow.workspace?.environment),
                triggerType: resolveTriggerType(triggerType, source)
            }
        });

        const { executeWorkflowDefinition } = await import("../workflows/builder");
        const result = await executeWorkflowDefinition({
            definition: workflow.definitionJson as unknown as WorkflowDefinition,
            input,
            requestContext
        });

        const durationMs = result.steps.reduce((sum, step) => sum + (step.durationMs || 0), 0);

        if (result.steps.length > 0) {
            await prisma.workflowRunStep.createMany({
                data: result.steps.map((step) => ({
                    runId: run.id,
                    stepId: step.stepId,
                    stepType: step.stepType,
                    stepName: step.stepName,
                    status: mapStepStatus(step.status),
                    inputJson: step.input ? (step.input as Prisma.InputJsonValue) : Prisma.DbNull,
                    outputJson: step.output
                        ? (step.output as Prisma.InputJsonValue)
                        : Prisma.DbNull,
                    errorJson: step.error ? (step.error as Prisma.InputJsonValue) : Prisma.DbNull,
                    iterationIndex: step.iterationIndex,
                    startedAt: step.startedAt,
                    completedAt: step.completedAt,
                    durationMs: step.durationMs
                }))
            });
        }

        if (result.status === "suspended") {
            await prisma.workflowRun.update({
                where: { id: run.id },
                data: {
                    suspendedAt: new Date(),
                    suspendedStep: result.suspended?.stepId,
                    suspendDataJson: result.suspended?.data
                        ? (result.suspended.data as Prisma.InputJsonValue)
                        : Prisma.DbNull,
                    durationMs
                }
            });

            const suspendedRun = await prisma.workflowRun.findUnique({
                where: { id: run.id },
                include: { steps: true }
            });

            return {
                success: true,
                runId: run.id,
                status: "suspended",
                output: null,
                run: suspendedRun
            };
        }

        const finalStatus = result.status === "failed" ? RunStatus.FAILED : RunStatus.COMPLETED;
        await prisma.workflowRun.update({
            where: { id: run.id },
            data: {
                status: finalStatus,
                outputJson: result.output
                    ? (result.output as Prisma.InputJsonValue)
                    : Prisma.DbNull,
                completedAt: new Date(),
                durationMs
            }
        });

        const completedRun = await prisma.workflowRun.findUnique({
            where: { id: run.id },
            include: { steps: true }
        });

        return {
            success: finalStatus === RunStatus.COMPLETED,
            runId: run.id,
            status: finalStatus === RunStatus.COMPLETED ? "success" : "failed",
            output: result.output,
            error: result.error,
            run: completedRun
        };
    }
});

export const workflowListRunsTool = createTool({
    id: "workflow-list-runs",
    description: "List workflow runs with filters and time range.",
    inputSchema: z.object({
        workflowSlug: z.string().describe("Workflow slug or ID"),
        limit: z.number().optional().describe("Max runs to return"),
        status: z.string().optional().describe("Run status filter"),
        environment: z.string().optional().describe("Environment filter"),
        triggerType: z.string().optional().describe("Trigger type filter"),
        from: z.string().optional().describe("Start ISO timestamp"),
        to: z.string().optional().describe("End ISO timestamp"),
        search: z.string().optional().describe("Search run ID")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        runs: z.array(z.any())
    }),
    execute: async ({
        workflowSlug,
        limit,
        status,
        environment,
        triggerType,
        from,
        to,
        search
    }) => {
        const workflow = await prisma.workflow.findFirst({
            where: { OR: [{ slug: workflowSlug }, { id: workflowSlug }] }
        });

        if (!workflow) {
            throw new Error(`Workflow '${workflowSlug}' not found`);
        }

        const where: Record<string, unknown> = {
            workflowId: workflow.id
        };

        const validStatuses = ["QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"];
        if (status && validStatuses.includes(status.toUpperCase())) {
            where.status = status.toUpperCase();
        }
        if (environment) {
            where.environment = resolveEnvironment(environment, environment);
        }
        if (triggerType) {
            where.triggerType = resolveTriggerType(triggerType, triggerType);
        }
        if (from || to) {
            const startedAt: Record<string, Date> = {};
            if (from) {
                const fromDate = new Date(from);
                if (!Number.isNaN(fromDate.getTime())) {
                    startedAt.gte = fromDate;
                }
            }
            if (to) {
                const toDate = new Date(to);
                if (!Number.isNaN(toDate.getTime())) {
                    startedAt.lte = toDate;
                }
            }
            if (Object.keys(startedAt).length > 0) {
                where.startedAt = startedAt;
            }
        }
        if (search) {
            where.OR = [
                {
                    id: {
                        contains: search,
                        mode: "insensitive"
                    }
                }
            ];
        }

        const runs = await prisma.workflowRun.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: limit ?? 50,
            include: { _count: { select: { steps: true } } }
        });

        return {
            success: true,
            runs: runs.map((run) => ({
                id: run.id,
                status: run.status,
                inputJson: run.inputJson,
                outputJson: run.outputJson,
                startedAt: run.startedAt,
                completedAt: run.completedAt,
                suspendedAt: run.suspendedAt,
                suspendedStep: run.suspendedStep,
                durationMs: run.durationMs,
                environment: run.environment,
                triggerType: run.triggerType,
                stepsCount: run._count?.steps ?? 0
            }))
        };
    }
});

export const workflowGetRunTool = createTool({
    id: "workflow-get-run",
    description: "Fetch workflow run details including steps.",
    inputSchema: z.object({
        workflowSlug: z.string().describe("Workflow slug or ID"),
        runId: z.string().describe("Run ID")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        run: z.any()
    }),
    execute: async ({ workflowSlug, runId }) => {
        const workflow = await prisma.workflow.findFirst({
            where: { OR: [{ slug: workflowSlug }, { id: workflowSlug }] }
        });

        if (!workflow) {
            throw new Error(`Workflow '${workflowSlug}' not found`);
        }

        const run = await prisma.workflowRun.findUnique({
            where: { id: runId },
            include: { steps: true }
        });

        if (!run || run.workflowId !== workflow.id) {
            throw new Error(`Run '${runId}' not found`);
        }

        return { success: true, run };
    }
});
