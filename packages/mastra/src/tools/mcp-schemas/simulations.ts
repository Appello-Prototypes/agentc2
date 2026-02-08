import { McpToolDefinition, McpToolRoute } from "./types";

export const simulationToolDefinitions: McpToolDefinition[] = [
    {
        name: "agent-simulations-list",
        description: "List simulation sessions for an agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                cursor: { type: "string", description: "Pagination cursor" },
                limit: { type: "number", description: "Max sessions to return" }
            },
            required: ["agentId"]
        },
        invoke_url: "/api/mcp",
        category: "simulations"
    },
    {
        name: "agent-simulations-start",
        description: "Start a new simulation session for an agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                theme: { type: "string", description: "Simulation theme" },
                count: { type: "number", description: "Target run count" },
                concurrency: { type: "number", description: "Concurrency level" }
            },
            required: ["agentId", "theme"]
        },
        invoke_url: "/api/mcp",
        category: "simulations"
    },
    {
        name: "agent-simulations-get",
        description: "Get details for a simulation session.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                sessionId: { type: "string", description: "Simulation session ID" }
            },
            required: ["agentId", "sessionId"]
        },
        invoke_url: "/api/mcp",
        category: "simulations"
    }
];

export const simulationToolRoutes: McpToolRoute[] = [
    {
        kind: "internal",
        name: "agent-simulations-list",
        method: "GET",
        path: "/api/agents/{agentId}/simulations",
        pathParams: ["agentId"],
        queryParams: ["cursor", "limit"]
    },
    {
        kind: "internal",
        name: "agent-simulations-start",
        method: "POST",
        path: "/api/agents/{agentId}/simulations",
        pathParams: ["agentId"],
        bodyParams: ["theme", "count", "concurrency"]
    },
    {
        kind: "internal",
        name: "agent-simulations-get",
        method: "GET",
        path: "/api/agents/{agentId}/simulations/{sessionId}",
        pathParams: ["agentId", "sessionId"]
    }
];
