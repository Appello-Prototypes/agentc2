import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { callInternalApi } from "./internal-api";

const baseOutputSchema = z.object({ success: z.boolean().optional() }).passthrough();

export const agentRunCancelTool = createTool({
    id: "agent-run-cancel",
    description: "Cancel a running agent execution.",
    inputSchema: z.object({
        agentId: z.string(),
        runId: z.string()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, runId, ...rest }) => {
        return callInternalApi(`/api/agents/${agentId}/runs/${runId}/cancel`, {
            method: "POST",
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
        });
    }
});

export const agentRunRerunTool = createTool({
    id: "agent-run-rerun",
    description: "Rerun an agent execution with the same input.",
    inputSchema: z.object({
        agentId: z.string(),
        runId: z.string(),
        versionId: z.string().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, runId, versionId, ...rest }) => {
        return callInternalApi(`/api/agents/${agentId}/runs/${runId}/rerun`, {
            method: "POST",
            body: { versionId },
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
        });
    }
});

export const agentRunTraceTool = createTool({
    id: "agent-run-trace",
    description: "Get the trace for a specific run.",
    inputSchema: z.object({
        agentId: z.string(),
        runId: z.string()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, runId, ...rest }) => {
        return callInternalApi(`/api/agents/${agentId}/runs/${runId}/trace`, {
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
        });
    }
});
