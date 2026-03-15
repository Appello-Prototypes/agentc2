import { McpToolDefinition, McpToolRoute } from "./types";

export const scheduleToolDefinitions: McpToolDefinition[] = [
    {
        name: "agent-schedule-create",
        description: "Create a schedule for an agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                name: { type: "string", description: "Schedule name" },
                description: { type: "string" },
                cronExpr: { type: "string" },
                timezone: { type: "string" },
                input: { type: "string" },
                context: { type: "object" },
                maxSteps: { type: "number" },
                isActive: { type: "boolean" },
                modelOverride: {
                    type: "object",
                    description:
                        "Override the agent model for scheduled runs. E.g. { provider: 'openai', name: 'gpt-4.1-nano' }",
                    properties: {
                        provider: { type: "string" },
                        name: { type: "string" }
                    }
                }
            },
            required: ["agentId", "name", "cronExpr"]
        },
        invoke_url: "/api/mcp",
        category: "schedules"
    },
    {
        name: "agent-schedule-list",
        description: "List schedules for an agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" }
            },
            required: ["agentId"]
        },
        invoke_url: "/api/mcp",
        category: "schedules"
    },
    {
        name: "agent-schedule-update",
        description: "Update a schedule for an agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                scheduleId: { type: "string", description: "Schedule ID" },
                name: { type: "string" },
                description: { type: "string" },
                cronExpr: { type: "string" },
                timezone: { type: "string" },
                input: { type: "string" },
                context: { type: "object" },
                maxSteps: { type: "number" },
                isActive: { type: "boolean" },
                modelOverride: {
                    type: "object",
                    description:
                        "Override the agent model for scheduled runs. E.g. { provider: 'openai', name: 'gpt-4.1-nano' }. Set to null to clear.",
                    properties: {
                        provider: { type: "string" },
                        name: { type: "string" }
                    }
                }
            },
            required: ["agentId", "scheduleId"]
        },
        invoke_url: "/api/mcp",
        category: "schedules"
    },
    {
        name: "agent-schedule-delete",
        description: "Delete a schedule for an agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                scheduleId: { type: "string", description: "Schedule ID" }
            },
            required: ["agentId", "scheduleId"]
        },
        invoke_url: "/api/mcp",
        category: "schedules"
    }
];

export const scheduleToolRoutes: McpToolRoute[] = [
    {
        kind: "internal",
        name: "agent-schedule-create",
        method: "POST",
        path: "/api/agents/{agentId}/schedules",
        pathParams: ["agentId"],
        bodyParams: [
            "name",
            "description",
            "cronExpr",
            "timezone",
            "input",
            "context",
            "maxSteps",
            "isActive",
            "modelOverride"
        ]
    },
    {
        kind: "internal",
        name: "agent-schedule-list",
        method: "GET",
        path: "/api/agents/{agentId}/schedules",
        pathParams: ["agentId"]
    },
    {
        kind: "internal",
        name: "agent-schedule-update",
        method: "PATCH",
        path: "/api/agents/{agentId}/schedules/{scheduleId}",
        pathParams: ["agentId", "scheduleId"],
        bodyParams: [
            "name",
            "description",
            "cronExpr",
            "timezone",
            "input",
            "context",
            "maxSteps",
            "isActive",
            "modelOverride"
        ]
    },
    {
        kind: "internal",
        name: "agent-schedule-delete",
        method: "DELETE",
        path: "/api/agents/{agentId}/schedules/{scheduleId}",
        pathParams: ["agentId", "scheduleId"]
    }
];
