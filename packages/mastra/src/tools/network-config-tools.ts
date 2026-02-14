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

export const networkGenerateTool = createTool({
    id: "network-generate",
    description: "Generate a network topology from a prompt.",
    inputSchema: z.object({
        prompt: z.string().describe("Prompt to generate a network")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ prompt }) => {
        return callInternalApi("/api/networks/generate", {
            method: "POST",
            body: { prompt }
        });
    }
});

export const networkValidateTool = createTool({
    id: "network-validate",
    description: "Validate a network topology and primitives.",
    inputSchema: z.object({
        topologyJson: z.record(z.any()).describe("Network topology JSON"),
        primitives: z.array(z.record(z.any())).optional().describe("Network primitives")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ topologyJson, primitives }) => {
        return callInternalApi("/api/networks/validate", {
            method: "POST",
            body: { topologyJson, primitives }
        });
    }
});

export const networkDesignerChatTool = createTool({
    id: "network-designer-chat",
    description: "Generate a JSON Patch proposal for network updates.",
    inputSchema: z.object({
        networkSlug: z.string().describe("Network slug or ID"),
        prompt: z.string().describe("Requested change"),
        topologyJson: z.record(z.any()).describe("Current network topology JSON"),
        primitives: z.array(z.record(z.any())).optional().describe("Network primitives"),
        selected: z.record(z.any()).optional().describe("Optional selected node")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ networkSlug, prompt, topologyJson, primitives, selected }) => {
        return callInternalApi(`/api/networks/${networkSlug}/designer-chat`, {
            method: "POST",
            body: { prompt, topologyJson, primitives, selected }
        });
    }
});
