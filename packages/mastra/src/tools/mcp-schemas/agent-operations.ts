import { McpToolDefinition, McpToolRoute } from "./types";

export const agentOperationsToolDefinitions: McpToolDefinition[] = [
    {
        name: "agent-list",
        description: "List all agents with filters.",
        inputSchema: {
            type: "object",
            properties: {
                active: { type: "boolean", description: "Filter to active agents only" },
                system: { type: "boolean", description: "Only include system agents" }
            }
        },
        invoke_url: "/api/mcp",
        category: "agent-operations"
    },
    {
        name: "agent-overview",
        description: "Get overview stats for an agent.",
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
        category: "agent-operations"
    },
    {
        name: "agent-analytics",
        description: "Get analytics summary for an agent.",
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
        category: "agent-operations"
    },
    {
        name: "agent-costs",
        description: "Get cost breakdown for an agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                from: { type: "string", description: "Start ISO timestamp" },
                to: { type: "string", description: "End ISO timestamp" },
                source: { type: "string", description: "Run source filter" }
            },
            required: ["agentId"]
        },
        invoke_url: "/api/mcp",
        category: "agent-operations"
    },
    {
        name: "agent-budget-get",
        description: "Get budget policy for an agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" }
            },
            required: ["agentId"]
        },
        invoke_url: "/api/mcp",
        category: "agent-operations"
    },
    {
        name: "agent-budget-update",
        description: "Update budget policy for an agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                enabled: { type: "boolean" },
                monthlyLimitUsd: { type: "number" },
                alertAtPct: { type: "number" },
                hardLimit: { type: "boolean" }
            },
            required: ["agentId"]
        },
        invoke_url: "/api/mcp",
        category: "agent-operations"
    }
];

export const agentOperationsToolRoutes: McpToolRoute[] = [
    {
        kind: "internal",
        name: "agent-list",
        method: "GET",
        path: "/api/agents",
        queryParams: ["active", "system"]
    },
    {
        kind: "internal",
        name: "agent-overview",
        method: "GET",
        path: "/api/agents/{agentId}/overview",
        pathParams: ["agentId"],
        queryParams: ["from", "to"]
    },
    {
        kind: "internal",
        name: "agent-analytics",
        method: "GET",
        path: "/api/agents/{agentId}/analytics",
        pathParams: ["agentId"],
        queryParams: ["from", "to"]
    },
    {
        kind: "internal",
        name: "agent-costs",
        method: "GET",
        path: "/api/agents/{agentId}/costs",
        pathParams: ["agentId"],
        queryParams: ["from", "to", "source"]
    },
    {
        kind: "internal",
        name: "agent-budget-get",
        method: "GET",
        path: "/api/agents/{agentId}/budget",
        pathParams: ["agentId"]
    },
    {
        kind: "internal",
        name: "agent-budget-update",
        method: "PUT",
        path: "/api/agents/{agentId}/budget",
        pathParams: ["agentId"],
        bodyParams: ["enabled", "monthlyLimitUsd", "alertAtPct", "hardLimit"]
    }
];
