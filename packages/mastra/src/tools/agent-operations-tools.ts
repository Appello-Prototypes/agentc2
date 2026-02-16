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

export const agentListTool = createTool({
    id: "agent-list",
    description:
        "List all agents with optional filters. Use detail='capabilities' to see pinned vs discoverable skills and runtimeToolCount (what the agent actually has available).",
    inputSchema: z.object({
        active: z.boolean().optional().describe("Filter to active agents only"),
        system: z.boolean().optional().describe("Only include system agents"),
        detail: z
            .enum(["capabilities"])
            .optional()
            .describe(
                "Set to 'capabilities' to include pinnedSkills, discoverableSkills, pinnedToolCount, discoverableToolCount, and runtimeToolCount per agent"
            )
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ active, system, detail }) => {
        return callInternalApi("/api/agents", {
            query: { active, system, detail }
        });
    }
});

export const agentOverviewTool = createTool({
    id: "agent-overview",
    description: "Get overview stats for an agent.",
    inputSchema: z.object({
        agentId: z.string(),
        from: z.string().optional(),
        to: z.string().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, from, to }) => {
        return callInternalApi(`/api/agents/${agentId}/overview`, {
            query: { from, to }
        });
    }
});

export const agentAnalyticsTool = createTool({
    id: "agent-analytics",
    description: "Get analytics summary for an agent.",
    inputSchema: z.object({
        agentId: z.string(),
        from: z.string().optional(),
        to: z.string().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, from, to }) => {
        return callInternalApi(`/api/agents/${agentId}/analytics`, {
            query: { from, to }
        });
    }
});

export const agentCostsTool = createTool({
    id: "agent-costs",
    description: "Get cost breakdown for an agent.",
    inputSchema: z.object({
        agentId: z.string(),
        from: z.string().optional(),
        to: z.string().optional(),
        source: z.string().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, from, to, source }) => {
        return callInternalApi(`/api/agents/${agentId}/costs`, {
            query: { from, to, source }
        });
    }
});

export const agentBudgetGetTool = createTool({
    id: "agent-budget-get",
    description: "Get budget policy for an agent.",
    inputSchema: z.object({
        agentId: z.string()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId }) => {
        return callInternalApi(`/api/agents/${agentId}/budget`);
    }
});

export const agentBudgetUpdateTool = createTool({
    id: "agent-budget-update",
    description: "Update budget policy for an agent.",
    inputSchema: z.object({
        agentId: z.string(),
        enabled: z.boolean().optional(),
        monthlyLimitUsd: z.number().optional().nullable(),
        alertAtPct: z.number().optional().nullable(),
        hardLimit: z.boolean().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, enabled, monthlyLimitUsd, alertAtPct, hardLimit }) => {
        return callInternalApi(`/api/agents/${agentId}/budget`, {
            method: "PUT",
            body: { enabled, monthlyLimitUsd, alertAtPct, hardLimit }
        });
    }
});
