import { McpToolDefinition, McpToolRoute } from "./types";

export const agentQualityToolDefinitions: McpToolDefinition[] = [
    {
        name: "agent-feedback-submit",
        description: "Submit feedback for an agent run.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                runId: { type: "string", description: "Run ID" },
                thumbs: { type: "boolean", description: "Thumbs up/down" },
                rating: { type: "number", description: "Numeric rating" },
                comment: { type: "string", description: "Freeform comment" }
            },
            required: ["agentId", "runId"]
        },
        invoke_url: "/api/mcp",
        category: "agent-quality"
    },
    {
        name: "agent-feedback-list",
        description: "Get feedback summary for an agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                from: { type: "string", description: "Start ISO timestamp" },
                to: { type: "string", description: "End ISO timestamp" }
            },
            required: ["agentId"]
        },
        invoke_url: "/api/mcp",
        category: "agent-quality"
    },
    {
        name: "agent-guardrails-get",
        description: "Get guardrail policy for an agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" }
            },
            required: ["agentId"]
        },
        invoke_url: "/api/mcp",
        category: "agent-quality"
    },
    {
        name: "agent-guardrails-update",
        description: "Update guardrail policy for an agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                configJson: { type: "object", description: "Guardrail config JSON" },
                createdBy: { type: "string", description: "Actor ID" }
            },
            required: ["agentId", "configJson"]
        },
        invoke_url: "/api/mcp",
        category: "agent-quality"
    },
    {
        name: "agent-guardrails-events",
        description: "List guardrail events for an agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                from: { type: "string", description: "Start ISO timestamp" },
                to: { type: "string", description: "End ISO timestamp" },
                limit: { type: "number", description: "Max events to return" },
                cursor: { type: "string", description: "Pagination cursor" }
            },
            required: ["agentId"]
        },
        invoke_url: "/api/mcp",
        category: "agent-quality"
    },
    {
        name: "agent-test-cases-list",
        description: "List test cases for an agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                cursor: { type: "string", description: "Pagination cursor" },
                limit: { type: "number", description: "Max test cases to return" }
            },
            required: ["agentId"]
        },
        invoke_url: "/api/mcp",
        category: "agent-quality"
    },
    {
        name: "agent-test-cases-create",
        description: "Create a new test case for an agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                name: { type: "string", description: "Test case name" },
                inputText: { type: "string", description: "Test input" },
                expectedOutput: { type: "string", description: "Expected output" },
                tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Tags for categorization"
                },
                createdBy: { type: "string", description: "Actor ID" }
            },
            required: ["agentId", "name", "inputText"]
        },
        invoke_url: "/api/mcp",
        category: "agent-quality"
    },
    {
        name: "agent-scorers-list",
        description: "List all available evaluation scorers that can be attached to agents.",
        inputSchema: {
            type: "object",
            properties: {}
        },
        invoke_url: "/api/mcp",
        category: "agent-quality"
    }
];

export const agentQualityToolRoutes: McpToolRoute[] = [
    {
        kind: "internal",
        name: "agent-feedback-submit",
        method: "POST",
        path: "/api/agents/{agentId}/feedback",
        pathParams: ["agentId"],
        bodyParams: ["runId", "thumbs", "rating", "comment"]
    },
    {
        kind: "internal",
        name: "agent-feedback-list",
        method: "GET",
        path: "/api/agents/{agentId}/feedback",
        pathParams: ["agentId"],
        queryParams: ["from", "to"]
    },
    {
        kind: "internal",
        name: "agent-guardrails-get",
        method: "GET",
        path: "/api/agents/{agentId}/guardrails",
        pathParams: ["agentId"]
    },
    {
        kind: "internal",
        name: "agent-guardrails-update",
        method: "PUT",
        path: "/api/agents/{agentId}/guardrails",
        pathParams: ["agentId"],
        bodyParams: ["configJson", "createdBy"]
    },
    {
        kind: "internal",
        name: "agent-guardrails-events",
        method: "GET",
        path: "/api/agents/{agentId}/guardrails/events",
        pathParams: ["agentId"],
        queryParams: ["from", "to", "limit", "cursor"]
    },
    {
        kind: "internal",
        name: "agent-test-cases-list",
        method: "GET",
        path: "/api/agents/{agentId}/test-cases",
        pathParams: ["agentId"],
        queryParams: ["cursor", "limit"]
    },
    {
        kind: "internal",
        name: "agent-test-cases-create",
        method: "POST",
        path: "/api/agents/{agentId}/test-cases",
        pathParams: ["agentId"],
        bodyParams: ["name", "inputText", "expectedOutput", "tags", "createdBy"]
    },
    {
        kind: "internal",
        name: "agent-scorers-list",
        method: "GET",
        path: "/api/agents/scorers"
    }
];
