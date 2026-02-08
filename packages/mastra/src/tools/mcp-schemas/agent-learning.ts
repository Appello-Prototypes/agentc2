import { McpToolDefinition, McpToolRoute } from "./types";

export const agentLearningToolDefinitions: McpToolDefinition[] = [
    {
        name: "agent-learning-sessions",
        description: "List learning sessions for an agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                status: { type: "string", description: "Session status filter" },
                limit: { type: "number", description: "Max sessions to return" },
                cursor: { type: "string", description: "Pagination cursor" }
            },
            required: ["agentId"]
        },
        invoke_url: "/api/mcp",
        category: "agent-learning"
    },
    {
        name: "agent-learning-start",
        description: "Start a new learning session for an agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                triggerReason: { type: "string", description: "Reason for triggering learning" }
            },
            required: ["agentId"]
        },
        invoke_url: "/api/mcp",
        category: "agent-learning"
    },
    {
        name: "agent-learning-session-get",
        description: "Get detailed learning session information.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                sessionId: { type: "string", description: "Learning session ID" }
            },
            required: ["agentId", "sessionId"]
        },
        invoke_url: "/api/mcp",
        category: "agent-learning"
    },
    {
        name: "agent-learning-proposal-approve",
        description: "Approve a learning session and promote the candidate version.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                sessionId: { type: "string", description: "Learning session ID" },
                approvedBy: { type: "string", description: "Approver ID" },
                rationale: { type: "string", description: "Approval rationale" }
            },
            required: ["agentId", "sessionId", "approvedBy"]
        },
        invoke_url: "/api/mcp",
        category: "agent-learning"
    },
    {
        name: "agent-learning-proposal-reject",
        description: "Reject a learning session proposal.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                sessionId: { type: "string", description: "Learning session ID" },
                rejectedBy: { type: "string", description: "Rejecting user ID" },
                rationale: { type: "string", description: "Rejection rationale" }
            },
            required: ["agentId", "sessionId", "rejectedBy"]
        },
        invoke_url: "/api/mcp",
        category: "agent-learning"
    },
    {
        name: "agent-learning-experiments",
        description: "List active and recent experiments for an agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                status: { type: "string", description: "Experiment status filter" },
                limit: { type: "number", description: "Max experiments to return" }
            },
            required: ["agentId"]
        },
        invoke_url: "/api/mcp",
        category: "agent-learning"
    },
    {
        name: "agent-learning-metrics",
        description: "Get learning KPIs and metrics for an agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                days: { type: "number", description: "Number of days to include" }
            },
            required: ["agentId"]
        },
        invoke_url: "/api/mcp",
        category: "agent-learning"
    },
    {
        name: "agent-learning-policy",
        description: "Get the learning policy for an agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" }
            },
            required: ["agentId"]
        },
        invoke_url: "/api/mcp",
        category: "agent-learning"
    }
];

export const agentLearningToolRoutes: McpToolRoute[] = [
    {
        kind: "internal",
        name: "agent-learning-sessions",
        method: "GET",
        path: "/api/agents/{agentId}/learning",
        pathParams: ["agentId"],
        queryParams: ["status", "limit", "cursor"]
    },
    {
        kind: "internal",
        name: "agent-learning-start",
        method: "POST",
        path: "/api/agents/{agentId}/learning",
        pathParams: ["agentId"],
        bodyParams: ["triggerReason"]
    },
    {
        kind: "internal",
        name: "agent-learning-session-get",
        method: "GET",
        path: "/api/agents/{agentId}/learning/{sessionId}",
        pathParams: ["agentId", "sessionId"]
    },
    {
        kind: "internal",
        name: "agent-learning-proposal-approve",
        method: "POST",
        path: "/api/agents/{agentId}/learning/{sessionId}/approve",
        pathParams: ["agentId", "sessionId"],
        bodyParams: ["approvedBy", "rationale"]
    },
    {
        kind: "internal",
        name: "agent-learning-proposal-reject",
        method: "POST",
        path: "/api/agents/{agentId}/learning/{sessionId}/reject",
        pathParams: ["agentId", "sessionId"],
        bodyParams: ["rejectedBy", "rationale"]
    },
    {
        kind: "internal",
        name: "agent-learning-experiments",
        method: "GET",
        path: "/api/agents/{agentId}/learning/experiments",
        pathParams: ["agentId"],
        queryParams: ["status", "limit"]
    },
    {
        kind: "internal",
        name: "agent-learning-metrics",
        method: "GET",
        path: "/api/agents/{agentId}/learning/metrics",
        pathParams: ["agentId"],
        queryParams: ["days"]
    },
    {
        kind: "internal",
        name: "agent-learning-policy",
        method: "GET",
        path: "/api/agents/{agentId}/learning/policy",
        pathParams: ["agentId"]
    }
];
