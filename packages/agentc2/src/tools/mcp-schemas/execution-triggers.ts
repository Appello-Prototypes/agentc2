import { McpToolDefinition, McpToolRoute } from "./types";

export const executionTriggerToolDefinitions: McpToolDefinition[] = [
    {
        name: "agent-trigger-unified-list",
        description: "List all execution triggers for an agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" }
            },
            required: ["agentId"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },
    {
        name: "agent-trigger-unified-get",
        description: "Get a unified execution trigger.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                triggerId: { type: "string", description: "Unified trigger ID" }
            },
            required: ["agentId", "triggerId"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },
    {
        name: "agent-trigger-unified-create",
        description: "Create a unified execution trigger.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                type: { type: "string", description: "Trigger type" },
                name: { type: "string" },
                description: { type: "string" },
                config: { type: "object" },
                input: { type: "string" },
                context: { type: "object" },
                maxSteps: { type: "number" },
                environment: { type: "string" },
                filter: { type: "object" },
                inputMapping: { type: "object" },
                isActive: { type: "boolean" }
            },
            required: ["agentId", "type", "name"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },
    {
        name: "agent-trigger-unified-update",
        description: "Update a unified execution trigger.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                triggerId: { type: "string", description: "Unified trigger ID" },
                name: { type: "string" },
                description: { type: "string" },
                config: { type: "object" },
                input: { type: "string" },
                context: { type: "object" },
                maxSteps: { type: "number" },
                environment: { type: "string" },
                filter: { type: "object" },
                inputMapping: { type: "object" },
                isActive: { type: "boolean" }
            },
            required: ["agentId", "triggerId"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },
    {
        name: "agent-trigger-unified-delete",
        description: "Delete a unified execution trigger.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                triggerId: { type: "string", description: "Unified trigger ID" }
            },
            required: ["agentId", "triggerId"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },
    {
        name: "agent-trigger-unified-enable",
        description: "Enable a unified execution trigger.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                triggerId: { type: "string", description: "Unified trigger ID" }
            },
            required: ["agentId", "triggerId"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },
    {
        name: "agent-trigger-unified-disable",
        description: "Disable a unified execution trigger.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                triggerId: { type: "string", description: "Unified trigger ID" }
            },
            required: ["agentId", "triggerId"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },
    {
        name: "agent-trigger-test",
        description: "Dry-run a unified trigger.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                triggerId: { type: "string", description: "Unified trigger ID" },
                payload: { type: "object" },
                input: { type: "string" },
                context: { type: "object" },
                maxSteps: { type: "number" },
                environment: { type: "string" }
            },
            required: ["agentId", "triggerId"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },
    {
        name: "agent-trigger-execute",
        description: "Execute a unified trigger.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                triggerId: { type: "string", description: "Unified trigger ID" },
                payload: { type: "object" },
                input: { type: "string" },
                context: { type: "object" },
                maxSteps: { type: "number" },
                environment: { type: "string" }
            },
            required: ["agentId", "triggerId"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    }
];

export const executionTriggerToolRoutes: McpToolRoute[] = [
    {
        kind: "internal",
        name: "agent-trigger-unified-list",
        method: "GET",
        path: "/api/agents/{agentId}/execution-triggers",
        pathParams: ["agentId"]
    },
    {
        kind: "internal",
        name: "agent-trigger-unified-get",
        method: "GET",
        path: "/api/agents/{agentId}/execution-triggers/{triggerId}",
        pathParams: ["agentId", "triggerId"]
    },
    {
        kind: "internal",
        name: "agent-trigger-unified-create",
        method: "POST",
        path: "/api/agents/{agentId}/execution-triggers",
        pathParams: ["agentId"],
        bodyParams: [
            "type",
            "name",
            "description",
            "config",
            "input",
            "context",
            "maxSteps",
            "environment",
            "filter",
            "inputMapping",
            "isActive"
        ]
    },
    {
        kind: "internal",
        name: "agent-trigger-unified-update",
        method: "PATCH",
        path: "/api/agents/{agentId}/execution-triggers/{triggerId}",
        pathParams: ["agentId", "triggerId"],
        bodyParams: [
            "name",
            "description",
            "config",
            "input",
            "context",
            "maxSteps",
            "environment",
            "filter",
            "inputMapping",
            "isActive"
        ]
    },
    {
        kind: "internal",
        name: "agent-trigger-unified-delete",
        method: "DELETE",
        path: "/api/agents/{agentId}/execution-triggers/{triggerId}",
        pathParams: ["agentId", "triggerId"]
    },
    {
        kind: "internal",
        name: "agent-trigger-unified-enable",
        method: "PATCH",
        path: "/api/agents/{agentId}/execution-triggers/{triggerId}",
        pathParams: ["agentId", "triggerId"],
        staticBody: { isActive: true }
    },
    {
        kind: "internal",
        name: "agent-trigger-unified-disable",
        method: "PATCH",
        path: "/api/agents/{agentId}/execution-triggers/{triggerId}",
        pathParams: ["agentId", "triggerId"],
        staticBody: { isActive: false }
    },
    {
        kind: "internal",
        name: "agent-trigger-test",
        method: "POST",
        path: "/api/agents/{agentId}/execution-triggers/{triggerId}/test",
        pathParams: ["agentId", "triggerId"],
        bodyParams: ["payload", "input", "context", "maxSteps", "environment"]
    },
    {
        kind: "internal",
        name: "agent-trigger-execute",
        method: "POST",
        path: "/api/agents/{agentId}/execution-triggers/{triggerId}/execute",
        pathParams: ["agentId", "triggerId"],
        bodyParams: ["payload", "input", "context", "maxSteps", "environment"]
    }
];
