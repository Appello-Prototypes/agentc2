import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { callInternalApi } from "./internal-api";

const baseOutputSchema = z.object({ success: z.boolean().optional() }).passthrough();

export const scheduleCreateTool = createTool({
    id: "schedule-create",
    description: "Create a schedule for an agent.",
    inputSchema: z.object({
        agentId: z.string().describe("Agent slug or ID"),
        name: z.string().describe("Schedule name"),
        cronExpr: z.string().describe("Cron expression"),
        description: z.string().optional(),
        timezone: z.string().optional(),
        input: z.string().optional(),
        context: z.record(z.any()).optional(),
        maxSteps: z.number().optional(),
        isActive: z.boolean().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({
        agentId,
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
        return callInternalApi(`/api/agents/${agentId}/schedules`, {
            method: "POST",
            body: { name, cronExpr, description, timezone, input, context, maxSteps, isActive },
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
        });
    }
});

export const scheduleListTool = createTool({
    id: "schedule-list",
    description: "List schedules for an agent.",
    inputSchema: z.object({
        agentId: z.string().describe("Agent slug or ID")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, ...rest }) => {
        return callInternalApi(`/api/agents/${agentId}/schedules`, {
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
        });
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
