import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { callInternalApi } from "./internal-api";

const baseOutputSchema = z.object({ success: z.boolean().optional() }).passthrough();

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
    execute: async ({ agentId, from, to, status, source, search, limit, cursor, ...rest }) => {
        return callInternalApi(`/api/agents/${agentId}/runs`, {
            query: { from, to, status, source, search, limit, cursor },
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
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
    execute: async ({ agentId, runId, ...rest }) => {
        return callInternalApi(`/api/agents/${agentId}/runs/${runId}`, {
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
        });
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
        offset,
        ...rest
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
            },
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
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
    execute: async ({ eventId, ...rest }) => {
        return callInternalApi(`/api/live/triggers/${eventId}`, {
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
        });
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
    execute: async ({ agentId, from, to, source, limit, cursor, ...rest }) => {
        return callInternalApi(`/api/agents/${agentId}/evaluations`, {
            query: { from, to, source, limit, cursor },
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
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
    execute: async ({ agentId, limit, runIds, ...rest }) => {
        return callInternalApi(`/api/agents/${agentId}/evaluations/run`, {
            method: "POST",
            body: { limit, runIds },
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
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
    execute: async ({ agentId, limit, cursor, ...rest }) => {
        return callInternalApi(`/api/agents/${agentId}/versions`, {
            query: { limit, cursor },
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
        });
    }
});
