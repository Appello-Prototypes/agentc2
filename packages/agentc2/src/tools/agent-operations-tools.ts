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

export const agentDiscoverTool = createTool({
    id: "agent-discover",
    description:
        "Discover other agents available for collaboration. Returns each agent's slug, name, description, model, tools, and a specialty summary derived from its instructions. Use this to find agents that can help with a sub-task before invoking them with agent-invoke-dynamic.",
    inputSchema: z.object({
        keyword: z
            .string()
            .optional()
            .describe(
                "Optional keyword to filter agents by capability (matched against name, description, and instructions)"
            ),
        activeOnly: z
            .boolean()
            .optional()
            .default(true)
            .describe("Only return active agents (default true)"),
        exclude: z
            .string()
            .optional()
            .describe("Agent slug to exclude from results (e.g. the calling agent's own slug)")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ keyword, activeOnly, exclude }) => {
        return callInternalApi("/api/agents", {
            query: {
                detail: "discover",
                active: activeOnly !== false ? true : undefined,
                keyword,
                exclude
            }
        });
    }
});

export const agentInvokeDynamicTool = createTool({
    id: "agent-invoke-dynamic",
    description:
        "Dynamically invoke any agent by slug and get back its response. No pre-configuration required. Use agent-discover first to find available agents, then call this tool to delegate a sub-task. The target agent runs with full tool access and returns its response text.",
    inputSchema: z.object({
        agentSlug: z.string().describe("The slug of the agent to invoke (e.g. 'research-agent')"),
        message: z.string().describe("The message or task to send to the target agent"),
        context: z
            .record(z.unknown())
            .optional()
            .describe("Optional context variables to pass to the target agent"),
        maxSteps: z
            .number()
            .optional()
            .describe("Override the maximum number of tool-use steps (default uses agent config)")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        agentSlug: z.string(),
        output: z.string().optional(),
        run_id: z.string().optional(),
        duration_ms: z.number().optional(),
        usage: z
            .object({
                promptTokens: z.number().optional(),
                completionTokens: z.number().optional(),
                totalTokens: z.number().optional()
            })
            .optional(),
        error: z.string().optional()
    }),
    execute: async ({ agentSlug, message, context, maxSteps }) => {
        try {
            const result = await callInternalApi(`/api/agents/${agentSlug}/invoke`, {
                method: "POST",
                body: {
                    input: message,
                    context: context || {},
                    maxSteps,
                    mode: "sync"
                }
            });
            return {
                success: true,
                agentSlug,
                output: result.output,
                run_id: result.run_id,
                duration_ms: result.duration_ms,
                usage: result.usage
            };
        } catch (error) {
            return {
                success: false,
                agentSlug,
                error: error instanceof Error ? error.message : "Failed to invoke agent"
            };
        }
    }
});
