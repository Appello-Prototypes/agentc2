import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const baseOutputSchema = z.object({ success: z.boolean() }).passthrough();

const getInternalBaseUrl = () =>
    process.env.MASTRA_API_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

const buildHeaders = () => {
    const headers: Record<string, string> = {
        "Content-Type": "application/json"
    };
    const apiKey = process.env.MASTRA_API_KEY || process.env.MCP_API_KEY;
    if (apiKey) {
        headers["X-API-Key"] = apiKey;
    }
    const orgSlug = process.env.MASTRA_ORGANIZATION_SLUG || process.env.MCP_API_ORGANIZATION_SLUG;
    if (orgSlug) {
        headers["X-Organization-Slug"] = orgSlug;
    }
    return headers;
};

const callInternalApi = async (
    path: string,
    options?: {
        method?: string;
        query?: Record<string, unknown>;
        body?: Record<string, unknown>;
    }
) => {
    const url = new URL(path, getInternalBaseUrl());
    if (options?.query) {
        Object.entries(options.query).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, String(value));
            }
        });
    }

    const response = await fetch(url.toString(), {
        method: options?.method ?? "GET",
        headers: buildHeaders(),
        body: options?.body ? JSON.stringify(options.body) : undefined
    });
    const data = await response.json();
    if (!response.ok || data?.success === false) {
        throw new Error(data?.error || `Request failed (${response.status})`);
    }
    return data;
};

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
        isActive
    }) => {
        return callInternalApi(`/api/agents/${agentId}/schedules`, {
            method: "POST",
            body: { name, cronExpr, description, timezone, input, context, maxSteps, isActive }
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
    execute: async ({ agentId }) => {
        return callInternalApi(`/api/agents/${agentId}/schedules`);
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
        isActive
    }) => {
        return callInternalApi(`/api/agents/${agentId}/schedules/${scheduleId}`, {
            method: "PATCH",
            body: { name, description, cronExpr, timezone, input, context, maxSteps, isActive }
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
    execute: async ({ agentId, scheduleId }) => {
        return callInternalApi(`/api/agents/${agentId}/schedules/${scheduleId}`, {
            method: "DELETE"
        });
    }
});
