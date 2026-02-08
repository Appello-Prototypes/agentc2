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

export const agentFeedbackSubmitTool = createTool({
    id: "agent-feedback-submit",
    description: "Submit feedback for an agent run.",
    inputSchema: z.object({
        agentId: z.string(),
        runId: z.string(),
        thumbs: z.boolean().optional(),
        rating: z.number().optional(),
        comment: z.string().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, runId, thumbs, rating, comment }) => {
        return callInternalApi(`/api/agents/${agentId}/feedback`, {
            method: "POST",
            body: { runId, thumbs, rating, comment }
        });
    }
});

export const agentFeedbackListTool = createTool({
    id: "agent-feedback-list",
    description: "Get feedback summary for an agent.",
    inputSchema: z.object({
        agentId: z.string(),
        from: z.string().optional(),
        to: z.string().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, from, to }) => {
        return callInternalApi(`/api/agents/${agentId}/feedback`, {
            query: { from, to }
        });
    }
});

export const agentGuardrailsGetTool = createTool({
    id: "agent-guardrails-get",
    description: "Get guardrail policy for an agent.",
    inputSchema: z.object({
        agentId: z.string()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId }) => {
        return callInternalApi(`/api/agents/${agentId}/guardrails`);
    }
});

export const agentGuardrailsUpdateTool = createTool({
    id: "agent-guardrails-update",
    description: "Update guardrail policy for an agent.",
    inputSchema: z.object({
        agentId: z.string(),
        configJson: z.unknown(),
        createdBy: z.string().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, configJson, createdBy }) => {
        return callInternalApi(`/api/agents/${agentId}/guardrails`, {
            method: "PUT",
            body: { configJson, createdBy }
        });
    }
});

export const agentGuardrailsEventsTool = createTool({
    id: "agent-guardrails-events",
    description: "List guardrail events for an agent.",
    inputSchema: z.object({
        agentId: z.string(),
        from: z.string().optional(),
        to: z.string().optional(),
        limit: z.number().optional(),
        cursor: z.string().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, from, to, limit, cursor }) => {
        return callInternalApi(`/api/agents/${agentId}/guardrails/events`, {
            query: { from, to, limit, cursor }
        });
    }
});

export const agentTestCasesListTool = createTool({
    id: "agent-test-cases-list",
    description: "List test cases for an agent.",
    inputSchema: z.object({
        agentId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, cursor, limit }) => {
        return callInternalApi(`/api/agents/${agentId}/test-cases`, {
            query: { cursor, limit }
        });
    }
});

export const agentTestCasesCreateTool = createTool({
    id: "agent-test-cases-create",
    description: "Create a new test case for an agent.",
    inputSchema: z.object({
        agentId: z.string(),
        name: z.string(),
        inputText: z.string(),
        expectedOutput: z.string().optional(),
        tags: z.array(z.string()).optional(),
        createdBy: z.string().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, name, inputText, expectedOutput, tags, createdBy }) => {
        return callInternalApi(`/api/agents/${agentId}/test-cases`, {
            method: "POST",
            body: { name, inputText, expectedOutput, tags, createdBy }
        });
    }
});
