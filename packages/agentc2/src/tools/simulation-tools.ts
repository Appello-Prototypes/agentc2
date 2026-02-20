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

export const agentSimulationsListTool = createTool({
    id: "agent-simulations-list",
    description: "List simulation sessions for an agent.",
    inputSchema: z.object({
        agentId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, cursor, limit }) => {
        return callInternalApi(`/api/agents/${agentId}/simulations`, {
            query: { cursor, limit }
        });
    }
});

export const agentSimulationsStartTool = createTool({
    id: "agent-simulations-start",
    description: "Start a new simulation session for an agent.",
    inputSchema: z.object({
        agentId: z.string(),
        theme: z.string(),
        count: z.number().optional(),
        concurrency: z.number().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, theme, count, concurrency }) => {
        return callInternalApi(`/api/agents/${agentId}/simulations`, {
            method: "POST",
            body: { theme, count, concurrency }
        });
    }
});

export const agentSimulationsGetTool = createTool({
    id: "agent-simulations-get",
    description: "Get details for a simulation session.",
    inputSchema: z.object({
        agentId: z.string(),
        sessionId: z.string()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, sessionId }) => {
        return callInternalApi(`/api/agents/${agentId}/simulations/${sessionId}`);
    }
});
