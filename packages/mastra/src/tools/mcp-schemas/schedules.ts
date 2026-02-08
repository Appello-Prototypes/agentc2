import { McpToolDefinition, McpToolRoute } from "./types";

export const scheduleToolDefinitions: McpToolDefinition[] = [
    {
        name: "agent_schedule_create",
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
                isActive: { type: "boolean" }
            },
            required: ["agentId", "name", "cronExpr"]
        },
        invoke_url: "/api/mcp",
        category: "schedules"
    },
    {
        name: "agent_schedule_list",
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
        name: "agent_schedule_update",
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
                isActive: { type: "boolean" }
            },
            required: ["agentId", "scheduleId"]
        },
        invoke_url: "/api/mcp",
        category: "schedules"
    },
    {
        name: "agent_schedule_delete",
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
        name: "agent_schedule_create",
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
            "isActive"
        ]
    },
    {
        kind: "internal",
        name: "agent_schedule_list",
        method: "GET",
        path: "/api/agents/{agentId}/schedules",
        pathParams: ["agentId"]
    },
    {
        kind: "internal",
        name: "agent_schedule_update",
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
            "isActive"
        ]
    },
    {
        kind: "internal",
        name: "agent_schedule_delete",
        method: "DELETE",
        path: "/api/agents/{agentId}/schedules/{scheduleId}",
        pathParams: ["agentId", "scheduleId"]
    }
];
