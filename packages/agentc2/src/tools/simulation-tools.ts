import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { callInternalApi } from "./internal-api";

const baseOutputSchema = z.object({ success: z.boolean().optional() }).passthrough();

export const agentSimulationsListTool = createTool({
    id: "agent-simulations-list",
    description: "List simulation sessions for an agent.",
    inputSchema: z.object({
        agentId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, cursor, limit, ...rest }) => {
        return callInternalApi(`/api/agents/${agentId}/simulations`, {
            query: { cursor, limit },
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
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
    execute: async ({ agentId, theme, count, concurrency, ...rest }) => {
        return callInternalApi(`/api/agents/${agentId}/simulations`, {
            method: "POST",
            body: { theme, count, concurrency },
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
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
    execute: async ({ agentId, sessionId, ...rest }) => {
        return callInternalApi(`/api/agents/${agentId}/simulations/${sessionId}`, {
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
        });
    }
});
