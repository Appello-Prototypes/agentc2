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

export const agentRunsListTool = createTool({
    id: "agent-runs-list",
    description: "List agent runs with filters and time range.",
    inputSchema: z.object({
        agentId: z.string().describe("Agent slug or ID"),
        from: z.string().optional().describe("Start ISO timestamp"),
        to: z.string().optional().describe("End ISO timestamp"),
        status: z.string().optional().describe("Run status filter"),
        source: z.string().optional().describe("Source filter: production, simulation, or all"),
        search: z.string().optional().describe("Search text"),
        limit: z.number().optional().describe("Max runs to return"),
        cursor: z.string().optional().describe("Pagination cursor")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, from, to, status, source, search, limit, cursor }) => {
        return callInternalApi(`/api/agents/${agentId}/runs`, {
            query: { from, to, status, source, search, limit, cursor }
        });
    }
});

export const agentRunsGetTool = createTool({
    id: "agent-runs-get",
    description: "Fetch an agent run with trace, evaluation, and version.",
    inputSchema: z.object({
        agentId: z.string().describe("Agent slug or ID"),
        runId: z.string().describe("Run ID")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, runId }) => {
        return callInternalApi(`/api/agents/${agentId}/runs/${runId}`);
    }
});

export const triggerEventsListTool = createTool({
    id: "trigger-events-list",
    description: "List trigger monitoring events with filters and time range.",
    inputSchema: z.object({
        from: z.string().optional().describe("Start ISO timestamp"),
        to: z.string().optional().describe("End ISO timestamp"),
        status: z.string().optional().describe("Trigger event status"),
        agentId: z.string().optional().describe("Agent ID filter"),
        triggerId: z.string().optional().describe("Trigger ID filter"),
        sourceType: z.string().optional().describe("Source type filter"),
        integrationKey: z.string().optional().describe("Integration key filter"),
        eventName: z.string().optional().describe("Event name filter"),
        search: z.string().optional().describe("Search text"),
        limit: z.number().optional().describe("Max events to return"),
        offset: z.number().optional().describe("Pagination offset")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({
        from,
        to,
        status,
        agentId,
        triggerId,
        sourceType,
        integrationKey,
        eventName,
        search,
        limit,
        offset
    }) => {
        return callInternalApi("/api/live/triggers", {
            query: {
                from,
                to,
                status,
                agentId,
                triggerId,
                sourceType,
                integrationKey,
                eventName,
                search,
                limit,
                offset
            }
        });
    }
});

export const triggerEventsGetTool = createTool({
    id: "trigger-events-get",
    description: "Fetch a trigger monitoring event detail.",
    inputSchema: z.object({
        eventId: z.string().describe("Trigger event ID")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ eventId }) => {
        return callInternalApi(`/api/live/triggers/${eventId}`);
    }
});

export const agentEvaluationsListTool = createTool({
    id: "agent-evaluations-list",
    description: "List evaluations for an agent with trends and insights.",
    inputSchema: z.object({
        agentId: z.string().describe("Agent slug or ID"),
        from: z.string().optional().describe("Start ISO timestamp"),
        to: z.string().optional().describe("End ISO timestamp"),
        source: z.string().optional().describe("Source filter: production, simulation, or all"),
        limit: z.number().optional().describe("Max evaluations to return"),
        cursor: z.string().optional().describe("Pagination cursor")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, from, to, source, limit, cursor }) => {
        return callInternalApi(`/api/agents/${agentId}/evaluations`, {
            query: { from, to, source, limit, cursor }
        });
    }
});

export const agentEvaluationsRunTool = createTool({
    id: "agent-evaluations-run",
    description: "Run evaluations on unevaluated runs for an agent.",
    inputSchema: z.object({
        agentId: z.string().describe("Agent slug or ID"),
        limit: z.number().optional().describe("Max runs to evaluate"),
        runIds: z.array(z.string()).optional().describe("Optional specific run IDs to evaluate")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, limit, runIds }) => {
        return callInternalApi(`/api/agents/${agentId}/evaluations/run`, {
            method: "POST",
            body: { limit, runIds }
        });
    }
});

export const agentVersionsListTool = createTool({
    id: "agent-versions-list",
    description: "List version history for an agent.",
    inputSchema: z.object({
        agentId: z.string().describe("Agent slug or ID"),
        limit: z.number().optional().describe("Max versions to return"),
        cursor: z.number().optional().describe("Version cursor (numeric)")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, limit, cursor }) => {
        return callInternalApi(`/api/agents/${agentId}/versions`, {
            query: { limit, cursor }
        });
    }
});
