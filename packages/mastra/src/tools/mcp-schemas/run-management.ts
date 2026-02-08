import { McpToolDefinition, McpToolRoute } from "./types";

export const runManagementToolDefinitions: McpToolDefinition[] = [
    {
        name: "agent-run-cancel",
        description: "Cancel a running agent execution.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                runId: { type: "string", description: "Run ID" }
            },
            required: ["agentId", "runId"]
        },
        invoke_url: "/api/mcp",
        category: "run-management"
    },
    {
        name: "agent-run-rerun",
        description: "Rerun an agent execution with the same input.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                runId: { type: "string", description: "Run ID" },
                versionId: { type: "string", description: "Optional version ID" }
            },
            required: ["agentId", "runId"]
        },
        invoke_url: "/api/mcp",
        category: "run-management"
    },
    {
        name: "agent-run-trace",
        description: "Get the trace for a specific run.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                runId: { type: "string", description: "Run ID" }
            },
            required: ["agentId", "runId"]
        },
        invoke_url: "/api/mcp",
        category: "run-management"
    }
];

export const runManagementToolRoutes: McpToolRoute[] = [
    {
        kind: "internal",
        name: "agent-run-cancel",
        method: "POST",
        path: "/api/agents/{agentId}/runs/{runId}/cancel",
        pathParams: ["agentId", "runId"]
    },
    {
        kind: "internal",
        name: "agent-run-rerun",
        method: "POST",
        path: "/api/agents/{agentId}/runs/{runId}/rerun",
        pathParams: ["agentId", "runId"],
        bodyParams: ["versionId"]
    },
    {
        kind: "internal",
        name: "agent-run-trace",
        method: "GET",
        path: "/api/agents/{agentId}/runs/{runId}/trace",
        pathParams: ["agentId", "runId"]
    }
];
