import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { prisma } from "@repo/database";
import { callInternalApi } from "./internal-api";
import { getNextRunAt } from "../triggers/schedule-utils";

const baseOutputSchema = z.object({ success: z.boolean().optional() }).passthrough();

const entityTypeSchema = z
    .enum(["agent", "workflow", "network"])
    .default("agent")
    .describe(
        "Target entity type. Use 'agent' (default) for agent schedules, 'workflow' for workflow schedules, 'network' for network schedules."
    );

async function resolveScheduleEntity(
    entityType: string,
    identifiers: { agentId?: string; workflowSlug?: string; networkSlug?: string },
    organizationId?: string
): Promise<{ id: string; slug: string; workspaceId: string; entityType: string }> {
    const orgFilter = organizationId ? { workspace: { organizationId } } : {};
    if (entityType === "workflow") {
        if (!identifiers.workflowSlug)
            throw new Error("workflowSlug is required when entityType is 'workflow'");
        const workflow = await prisma.workflow.findFirst({
            where: {
                OR: [{ slug: identifiers.workflowSlug }, { id: identifiers.workflowSlug }],
                ...orgFilter
            },
            select: { id: true, slug: true, workspaceId: true }
        });
        if (!workflow) throw new Error(`Workflow '${identifiers.workflowSlug}' not found`);
        return { ...workflow, entityType: "workflow" };
    }
    if (entityType === "network") {
        if (!identifiers.networkSlug)
            throw new Error("networkSlug is required when entityType is 'network'");
        const network = await prisma.network.findFirst({
            where: {
                OR: [{ slug: identifiers.networkSlug }, { id: identifiers.networkSlug }],
                ...orgFilter
            },
            select: { id: true, slug: true, workspaceId: true }
        });
        if (!network) throw new Error(`Network '${identifiers.networkSlug}' not found`);
        return { ...network, entityType: "network" };
    }
    if (!identifiers.agentId) throw new Error("agentId is required when entityType is 'agent'");
    const agent = await prisma.agent.findFirst({
        where: {
            OR: [{ slug: identifiers.agentId }, { id: identifiers.agentId }],
            ...orgFilter
        },
        select: { id: true, slug: true, workspaceId: true }
    });
    if (!agent) throw new Error(`Agent '${identifiers.agentId}' not found`);
    return { ...agent, entityType: "agent" };
}

export const scheduleCreateTool = createTool({
    id: "schedule-create",
    description:
        "Create a cron schedule for an agent, workflow, or network. Defaults to agent if entityType is not specified.",
    inputSchema: z.object({
        entityType: entityTypeSchema,
        agentId: z
            .string()
            .optional()
            .describe("Agent slug or ID (required for entityType 'agent')"),
        workflowSlug: z
            .string()
            .optional()
            .describe("Workflow slug or ID (required for entityType 'workflow')"),
        networkSlug: z
            .string()
            .optional()
            .describe("Network slug or ID (required for entityType 'network')"),
        name: z.string().describe("Schedule name"),
        cronExpr: z.string().describe("Cron expression (e.g. '0 */4 * * *' for every 4 hours)"),
        description: z.string().optional(),
        timezone: z.string().optional().describe("Timezone (default: UTC)"),
        input: z.string().optional().describe("Default input message"),
        context: z.record(z.any()).optional(),
        maxSteps: z.number().optional(),
        isActive: z.boolean().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({
        entityType: rawEntityType,
        agentId,
        workflowSlug,
        networkSlug,
        name,
        cronExpr,
        description,
        timezone,
        input,
        context,
        maxSteps,
        isActive,
        ...rest
    }) => {
        const entityType = rawEntityType || "agent";
        const organizationId = (rest as Record<string, unknown>).organizationId as
            | string
            | undefined;
        const entity = await resolveScheduleEntity(
            entityType,
            { agentId, workflowSlug, networkSlug },
            organizationId
        );

        const resolvedTimezone = timezone || "UTC";
        const nextRunAt = getNextRunAt(cronExpr, resolvedTimezone, new Date());

        const inputJson =
            input !== undefined || context !== undefined || maxSteps !== undefined
                ? { input, context, maxSteps }
                : null;

        const data: Record<string, unknown> = {
            entityType,
            workspaceId: entity.workspaceId,
            name,
            description,
            cronExpr,
            timezone: resolvedTimezone,
            inputJson: inputJson ? JSON.parse(JSON.stringify(inputJson)) : null,
            isActive: isActive !== false,
            nextRunAt
        };

        if (entityType === "workflow") {
            data.workflowId = entity.id;
        } else if (entityType === "network") {
            data.networkId = entity.id;
        } else {
            data.agentId = entity.id;
        }

        const schedule = await prisma.agentSchedule.create({
            data: data as Parameters<typeof prisma.agentSchedule.create>[0]["data"]
        });

        return { success: true, schedule };
    }
});

export const scheduleListTool = createTool({
    id: "schedule-list",
    description:
        "List schedules for an agent, workflow, or network. Defaults to agent if entityType is not specified.",
    inputSchema: z.object({
        entityType: entityTypeSchema,
        agentId: z
            .string()
            .optional()
            .describe("Agent slug or ID (required for entityType 'agent')"),
        workflowSlug: z
            .string()
            .optional()
            .describe("Workflow slug or ID (required for entityType 'workflow')"),
        networkSlug: z
            .string()
            .optional()
            .describe("Network slug or ID (required for entityType 'network')")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ entityType: rawEntityType, agentId, workflowSlug, networkSlug, ...rest }) => {
        const entityType = rawEntityType || "agent";
        const organizationId = (rest as Record<string, unknown>).organizationId as
            | string
            | undefined;
        const entity = await resolveScheduleEntity(
            entityType,
            { agentId, workflowSlug, networkSlug },
            organizationId
        );

        const where =
            entityType === "workflow"
                ? { workflowId: entity.id, entityType: "workflow" }
                : entityType === "network"
                  ? { networkId: entity.id, entityType: "network" }
                  : { agentId: entity.id };

        const schedules = await prisma.agentSchedule.findMany({
            where,
            orderBy: { createdAt: "desc" }
        });

        return { success: true, schedules, total: schedules.length };
    }
});

export const scheduleUpdateTool = createTool({
    id: "schedule-update",
    description: "Update a schedule for an agent.",
    inputSchema: z.object({
        agentId: z.string().describe("Agent slug or ID"),
        scheduleId: z.string().describe("Schedule ID"),
        name: z.string().optional(),
        description: z.string().optional(),
        cronExpr: z.string().optional(),
        timezone: z.string().optional(),
        input: z.string().optional(),
        context: z.record(z.any()).optional(),
        maxSteps: z.number().optional(),
        isActive: z.boolean().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({
        agentId,
        scheduleId,
        name,
        description,
        cronExpr,
        timezone,
        input,
        context,
        maxSteps,
        isActive,
        ...rest
    }) => {
        return callInternalApi(`/api/agents/${agentId}/schedules/${scheduleId}`, {
            method: "PATCH",
            body: { name, description, cronExpr, timezone, input, context, maxSteps, isActive },
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
        });
    }
});

export const scheduleDeleteTool = createTool({
    id: "schedule-delete",
    description: "Delete a schedule for an agent.",
    inputSchema: z.object({
        agentId: z.string().describe("Agent slug or ID"),
        scheduleId: z.string().describe("Schedule ID")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, scheduleId, ...rest }) => {
        return callInternalApi(`/api/agents/${agentId}/schedules/${scheduleId}`, {
            method: "DELETE",
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
        });
    }
});
