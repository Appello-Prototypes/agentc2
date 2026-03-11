import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { callInternalApi } from "./internal-api";

const baseOutputSchema = z.object({ success: z.boolean().optional() }).passthrough();

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
    execute: async ({ agentId, runId, thumbs, rating, comment, ...rest }) => {
        return callInternalApi(`/api/agents/${agentId}/feedback`, {
            method: "POST",
            body: { runId, thumbs, rating, comment },
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
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
    execute: async ({ agentId, from, to, ...rest }) => {
        return callInternalApi(`/api/agents/${agentId}/feedback`, {
            query: { from, to },
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
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
    execute: async ({ agentId, ...rest }) => {
        return callInternalApi(`/api/agents/${agentId}/guardrails`, {
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
        });
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
    execute: async ({ agentId, configJson, createdBy, ...rest }) => {
        return callInternalApi(`/api/agents/${agentId}/guardrails`, {
            method: "PUT",
            body: { configJson, createdBy },
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
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
    execute: async ({ agentId, from, to, limit, cursor, ...rest }) => {
        return callInternalApi(`/api/agents/${agentId}/guardrails/events`, {
            query: { from, to, limit, cursor },
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
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
    execute: async ({ agentId, cursor, limit, ...rest }) => {
        return callInternalApi(`/api/agents/${agentId}/test-cases`, {
            query: { cursor, limit },
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
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
    execute: async ({ agentId, name, inputText, expectedOutput, tags, createdBy, ...rest }) => {
        return callInternalApi(`/api/agents/${agentId}/test-cases`, {
            method: "POST",
            body: { name, inputText, expectedOutput, tags, createdBy },
            organizationId: (rest as Record<string, unknown>).organizationId as string | undefined
        });
    }
});
