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

export const workflowGenerateTool = createTool({
    id: "workflow-generate",
    description: "Generate a workflow definition from a prompt.",
    inputSchema: z.object({
        prompt: z.string().describe("Prompt to generate a workflow")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ prompt }) => {
        return callInternalApi("/api/workflows/generate", {
            method: "POST",
            body: { prompt }
        });
    }
});

export const workflowValidateTool = createTool({
    id: "workflow-validate",
    description: "Validate a workflow definition.",
    inputSchema: z.object({
        definitionJson: z.record(z.any()).describe("Workflow definition JSON")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ definitionJson }) => {
        return callInternalApi("/api/workflows/validate", {
            method: "POST",
            body: { definitionJson }
        });
    }
});

export const workflowDesignerChatTool = createTool({
    id: "workflow-designer-chat",
    description: "Generate a JSON Patch proposal for workflow updates.",
    inputSchema: z.object({
        workflowSlug: z.string().describe("Workflow slug or ID"),
        prompt: z.string().describe("Requested change"),
        definitionJson: z.record(z.any()).describe("Current workflow definition JSON"),
        selected: z.record(z.any()).optional().describe("Optional selected node")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ workflowSlug, prompt, definitionJson, selected }) => {
        return callInternalApi(`/api/workflows/${workflowSlug}/designer-chat`, {
            method: "POST",
            body: { prompt, definitionJson, selected }
        });
    }
});
