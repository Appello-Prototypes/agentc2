import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const baseOutputSchema = z.object({}).passthrough();

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
    if (!response.ok) {
        const errorMessage =
            (data && typeof data === "object" && "error" in data ? data.error : undefined) ||
            `Request failed (${response.status})`;
        throw new Error(String(errorMessage));
    }
    return data;
};

export const goalCreateTool = createTool({
    id: "goal-create",
    description: "Create a new goal.",
    inputSchema: z.object({
        title: z.string(),
        description: z.string(),
        priority: z.number().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ title, description, priority }) => {
        return callInternalApi("/api/goals", {
            method: "POST",
            body: { title, description, priority }
        });
    }
});

export const goalListTool = createTool({
    id: "goal-list",
    description: "List all goals for the current user.",
    inputSchema: z.object({}),
    outputSchema: baseOutputSchema,
    execute: async () => {
        return callInternalApi("/api/goals");
    }
});

export const goalGetTool = createTool({
    id: "goal-get",
    description: "Get a single goal by ID.",
    inputSchema: z.object({
        goalId: z.string()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ goalId }) => {
        return callInternalApi(`/api/goals/${goalId}`);
    }
});
