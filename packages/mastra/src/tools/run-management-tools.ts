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

export const agentRunCancelTool = createTool({
    id: "agent-run-cancel",
    description: "Cancel a running agent execution.",
    inputSchema: z.object({
        agentId: z.string(),
        runId: z.string()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, runId }) => {
        return callInternalApi(`/api/agents/${agentId}/runs/${runId}/cancel`, {
            method: "POST"
        });
    }
});

export const agentRunRerunTool = createTool({
    id: "agent-run-rerun",
    description: "Rerun an agent execution with the same input.",
    inputSchema: z.object({
        agentId: z.string(),
        runId: z.string(),
        versionId: z.string().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, runId, versionId }) => {
        return callInternalApi(`/api/agents/${agentId}/runs/${runId}/rerun`, {
            method: "POST",
            body: { versionId }
        });
    }
});

export const agentRunTraceTool = createTool({
    id: "agent-run-trace",
    description: "Get the trace for a specific run.",
    inputSchema: z.object({
        agentId: z.string(),
        runId: z.string()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, runId }) => {
        return callInternalApi(`/api/agents/${agentId}/runs/${runId}/trace`);
    }
});
