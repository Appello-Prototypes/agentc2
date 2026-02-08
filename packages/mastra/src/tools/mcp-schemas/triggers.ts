import { McpToolDefinition, McpToolRoute } from "./types";

export const triggerToolDefinitions: McpToolDefinition[] = [
    {
        name: "agent_trigger_create",
        description: "Create a trigger for an agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                name: { type: "string" },
                description: { type: "string" },
                triggerType: { type: "string", description: "webhook or event" },
                eventName: { type: "string" },
                filter: { type: "object" },
                inputMapping: { type: "object" },
                isActive: { type: "boolean" }
            },
            required: ["agentId", "name", "triggerType"]
        },
        invoke_url: "/api/mcp",
        category: "triggers"
    },
    {
        name: "agent_trigger_list",
        description: "List triggers for an agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" }
            },
            required: ["agentId"]
        },
        invoke_url: "/api/mcp",
        category: "triggers"
    },
    {
        name: "agent_trigger_update",
        description: "Update a trigger for an agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                triggerId: { type: "string", description: "Trigger ID" },
                name: { type: "string" },
                description: { type: "string" },
                eventName: { type: "string" },
                filter: { type: "object" },
                inputMapping: { type: "object" },
                isActive: { type: "boolean" }
            },
            required: ["agentId", "triggerId"]
        },
        invoke_url: "/api/mcp",
        category: "triggers"
    },
    {
        name: "agent_trigger_delete",
        description: "Delete a trigger for an agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                triggerId: { type: "string", description: "Trigger ID" }
            },
            required: ["agentId", "triggerId"]
        },
        invoke_url: "/api/mcp",
        category: "triggers"
    }
];

export const triggerToolRoutes: McpToolRoute[] = [
    {
        kind: "internal",
        name: "agent_trigger_create",
        method: "POST",
        path: "/api/agents/{agentId}/triggers",
        pathParams: ["agentId"],
        bodyParams: [
            "name",
            "description",
            "triggerType",
            "eventName",
            "filter",
            "inputMapping",
            "isActive"
        ]
    },
    {
        kind: "internal",
        name: "agent_trigger_list",
        method: "GET",
        path: "/api/agents/{agentId}/triggers",
        pathParams: ["agentId"]
    },
    {
        kind: "internal",
        name: "agent_trigger_update",
        method: "PATCH",
        path: "/api/agents/{agentId}/triggers/{triggerId}",
        pathParams: ["agentId", "triggerId"],
        bodyParams: ["name", "description", "eventName", "filter", "inputMapping", "isActive"]
    },
    {
        kind: "internal",
        name: "agent_trigger_delete",
        method: "DELETE",
        path: "/api/agents/{agentId}/triggers/{triggerId}",
        pathParams: ["agentId", "triggerId"]
    }
];
