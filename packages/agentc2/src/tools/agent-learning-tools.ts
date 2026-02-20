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

export const agentLearningSessionsTool = createTool({
    id: "agent-learning-sessions",
    description: "List learning sessions for an agent.",
    inputSchema: z.object({
        agentId: z.string(),
        status: z.string().optional(),
        limit: z.number().optional(),
        cursor: z.string().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, status, limit, cursor }) => {
        return callInternalApi(`/api/agents/${agentId}/learning`, {
            query: { status, limit, cursor }
        });
    }
});

export const agentLearningStartTool = createTool({
    id: "agent-learning-start",
    description: "Start a new learning session for an agent.",
    inputSchema: z.object({
        agentId: z.string(),
        triggerReason: z.string().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, triggerReason }) => {
        return callInternalApi(`/api/agents/${agentId}/learning`, {
            method: "POST",
            body: { triggerReason }
        });
    }
});

export const agentLearningSessionGetTool = createTool({
    id: "agent-learning-session-get",
    description: "Get detailed learning session information.",
    inputSchema: z.object({
        agentId: z.string(),
        sessionId: z.string()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, sessionId }) => {
        return callInternalApi(`/api/agents/${agentId}/learning/${sessionId}`);
    }
});

export const agentLearningProposalApproveTool = createTool({
    id: "agent-learning-proposal-approve",
    description: "Approve a learning session and promote the candidate version.",
    inputSchema: z.object({
        agentId: z.string(),
        sessionId: z.string(),
        approvedBy: z.string(),
        rationale: z.string().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, sessionId, approvedBy, rationale }) => {
        return callInternalApi(`/api/agents/${agentId}/learning/${sessionId}/approve`, {
            method: "POST",
            body: { approvedBy, rationale }
        });
    }
});

export const agentLearningProposalRejectTool = createTool({
    id: "agent-learning-proposal-reject",
    description: "Reject a learning session proposal.",
    inputSchema: z.object({
        agentId: z.string(),
        sessionId: z.string(),
        rejectedBy: z.string(),
        rationale: z.string().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, sessionId, rejectedBy, rationale }) => {
        return callInternalApi(`/api/agents/${agentId}/learning/${sessionId}/reject`, {
            method: "POST",
            body: { rejectedBy, rationale }
        });
    }
});

export const agentLearningExperimentsTool = createTool({
    id: "agent-learning-experiments",
    description: "List active and recent experiments for an agent.",
    inputSchema: z.object({
        agentId: z.string(),
        status: z.string().optional(),
        limit: z.number().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, status, limit }) => {
        return callInternalApi(`/api/agents/${agentId}/learning/experiments`, {
            query: { status, limit }
        });
    }
});

export const agentLearningMetricsTool = createTool({
    id: "agent-learning-metrics",
    description: "Get learning KPIs and metrics for an agent.",
    inputSchema: z.object({
        agentId: z.string(),
        days: z.number().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, days }) => {
        return callInternalApi(`/api/agents/${agentId}/learning/metrics`, {
            query: { days }
        });
    }
});

export const agentLearningPolicyTool = createTool({
    id: "agent-learning-policy",
    description: "Get the learning policy for an agent.",
    inputSchema: z.object({
        agentId: z.string()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId }) => {
        return callInternalApi(`/api/agents/${agentId}/learning/policy`);
    }
});

export const agentLearningPolicyUpdateTool = createTool({
    id: "agent-learning-policy-update",
    description: "Update the learning policy for an agent.",
    inputSchema: z.object({
        agentId: z.string(),
        autoLearn: z.boolean().optional(),
        minRunsBeforeLearn: z.number().optional(),
        learningInterval: z.string().optional(),
        requireApproval: z.boolean().optional(),
        experimentDuration: z.number().optional(),
        trafficSplitPct: z.number().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, ...policyData }) => {
        return callInternalApi(`/api/agents/${agentId}/learning/policy`, {
            method: "POST",
            body: policyData
        });
    }
});
