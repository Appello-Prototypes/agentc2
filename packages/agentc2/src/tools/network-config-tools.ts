import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { callInternalApi } from "./internal-api";

const baseOutputSchema = z.object({ success: z.boolean().optional() }).passthrough();

export const networkGenerateTool = createTool({
    id: "network-generate",
    description: "Generate a network topology from a prompt.",
    inputSchema: z.object({
        prompt: z.string().describe("Prompt to generate a network")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ prompt, ...rest }) => {
        return callInternalApi("/api/networks/generate", {
            method: "POST",
            body: { prompt },
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
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
    execute: async ({ topologyJson, primitives, ...rest }) => {
        return callInternalApi("/api/networks/validate", {
            method: "POST",
            body: { topologyJson, primitives },
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
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
    execute: async ({ networkSlug, prompt, topologyJson, primitives, selected, ...rest }) => {
        return callInternalApi(`/api/networks/${networkSlug}/designer-chat`, {
            method: "POST",
            body: { prompt, topologyJson, primitives, selected },
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
        });
    }
});
