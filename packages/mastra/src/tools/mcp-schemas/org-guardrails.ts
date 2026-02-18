import { McpToolDefinition, McpToolRoute } from "./types";

export const orgGuardrailToolDefinitions: McpToolDefinition[] = [
    {
        name: "org-guardrails-get",
        description:
            "Get the organization-wide guardrail policy. This baseline policy applies to ALL agents in the org.",
        inputSchema: {
            type: "object",
            properties: {
                orgId: { type: "string", description: "Organization ID or slug" }
            },
            required: ["orgId"]
        },
        invoke_url: "/api/mcp",
        category: "organization"
    },
    {
        name: "org-guardrails-update",
        description:
            "Create or update the organization-wide guardrail policy. This sets the baseline guardrail floor that ALL agents inherit. Agent-specific policies can add further restrictions but cannot weaken org-level rules.",
        inputSchema: {
            type: "object",
            properties: {
                orgId: { type: "string", description: "Organization ID or slug" },
                configJson: {
                    type: "object",
                    description:
                        "Full guardrail configuration object with input, output, and execution sections. input/output can contain: maxLength, blockPII, blockPromptInjection, blockToxicity, blockedPatterns (array of regex strings). execution can contain: maxDurationMs, maxToolCalls, maxCostUsd."
                },
                createdBy: {
                    type: "string",
                    description: "ID of the user making the change (for audit trail)"
                }
            },
            required: ["orgId", "configJson"]
        },
        invoke_url: "/api/mcp",
        category: "organization"
    }
];

export const orgGuardrailToolRoutes: McpToolRoute[] = [
    {
        kind: "internal",
        name: "org-guardrails-get",
        method: "GET",
        path: "/api/organizations/{orgId}/guardrails",
        pathParams: ["orgId"]
    },
    {
        kind: "internal",
        name: "org-guardrails-update",
        method: "PUT",
        path: "/api/organizations/{orgId}/guardrails",
        pathParams: ["orgId"],
        bodyParams: ["configJson", "createdBy"]
    }
];
