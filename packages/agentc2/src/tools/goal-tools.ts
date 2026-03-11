import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { callInternalApi } from "./internal-api";

const baseOutputSchema = z.object({}).passthrough();

export const goalCreateTool = createTool({
    id: "goal-create",
    description: "Create a new goal.",
    inputSchema: z.object({
        title: z.string(),
        description: z.string(),
        priority: z.number().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ title, description, priority, ...rest }) => {
        return callInternalApi("/api/goals", {
            method: "POST",
            body: { title, description, priority },
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
        });
    }
});

export const goalListTool = createTool({
    id: "goal-list",
    description: "List all goals for the current user.",
    inputSchema: z.object({}),
    outputSchema: baseOutputSchema,
    execute: async ({ ...rest }) => {
        return callInternalApi("/api/goals", {
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
        });
    }
});

export const goalGetTool = createTool({
    id: "goal-get",
    description: "Get a single goal by ID.",
    inputSchema: z.object({
        goalId: z.string()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ goalId, ...rest }) => {
        return callInternalApi(`/api/goals/${goalId}`, {
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
        });
    }
});

export const goalUpdateTool = createTool({
    id: "goal-update",
    description: "Update a goal (retry failed goals or cancel running goals).",
    inputSchema: z.object({
        goalId: z.string(),
        action: z.enum(["retry", "cancel"]).describe("Action to perform")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ goalId, action, ...rest }) => {
        return callInternalApi(`/api/goals/${goalId}`, {
            method: "PATCH",
            body: { action },
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
        });
    }
});

export const goalDeleteTool = createTool({
    id: "goal-delete",
    description: "Delete a goal.",
    inputSchema: z.object({
        goalId: z.string()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ goalId, ...rest }) => {
        return callInternalApi(`/api/goals/${goalId}`, {
            method: "DELETE",
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
        });
    }
});
