import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { callInternalApi } from "./internal-api";

const baseOutputSchema = z.object({ success: z.boolean().optional() }).passthrough();

export const workflowGenerateTool = createTool({
    id: "workflow-generate",
    description: "Generate a workflow definition from a prompt.",
    inputSchema: z.object({
        prompt: z.string().describe("Prompt to generate a workflow")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ prompt, ...rest }) => {
        return callInternalApi("/api/workflows/generate", {
            method: "POST",
            body: { prompt },
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
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
    execute: async ({ definitionJson, ...rest }) => {
        return callInternalApi("/api/workflows/validate", {
            method: "POST",
            body: { definitionJson },
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
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
    execute: async ({ workflowSlug, prompt, definitionJson, selected, ...rest }) => {
        return callInternalApi(`/api/workflows/${workflowSlug}/designer-chat`, {
            method: "POST",
            body: { prompt, definitionJson, selected },
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
        });
    }
});
