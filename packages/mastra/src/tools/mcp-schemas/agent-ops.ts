import { McpToolDefinition, McpToolRoute } from "./types";

export const agentOpsToolDefinitions: McpToolDefinition[] = [
    {
        name: "agent-runs-list",
        description: "List agent runs with filters and time range.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                status: { type: "string", description: "Run status filter" },
                search: { type: "string", description: "Search text" },
                from: { type: "string", description: "Start ISO timestamp" },
                to: { type: "string", description: "End ISO timestamp" },
                cursor: { type: "string", description: "Pagination cursor" },
                limit: { type: "number", description: "Max runs to return" },
                source: {
                    type: "string",
                    description: "Source filter: production, simulation, or all"
                }
            },
            required: ["agentId"]
        },
        invoke_url: "/api/mcp",
        category: "agent-ops"
    },
    {
        name: "agent-runs-get",
        description: "Fetch an agent run with trace, evaluation, and version.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                runId: { type: "string", description: "Run ID" }
            },
            required: ["agentId", "runId"]
        },
        invoke_url: "/api/mcp",
        category: "agent-ops"
    },
    {
        name: "trigger-events-list",
        description: "List trigger monitoring events with filters and time range.",
        inputSchema: {
            type: "object",
            properties: {
                status: { type: "string", description: "Trigger event status" },
                sourceType: { type: "string", description: "Source type filter" },
                integrationKey: { type: "string", description: "Integration key filter" },
                triggerId: { type: "string", description: "Trigger ID filter" },
                agentId: { type: "string", description: "Agent ID filter" },
                eventName: { type: "string", description: "Event name filter" },
                search: { type: "string", description: "Search text" },
                from: { type: "string", description: "Start ISO timestamp" },
                to: { type: "string", description: "End ISO timestamp" },
                limit: { type: "number", description: "Max events to return" },
                offset: { type: "number", description: "Pagination offset" },
                workspaceId: { type: "string", description: "Workspace override" }
            }
        },
        invoke_url: "/api/mcp",
        category: "agent-ops"
    },
    {
        name: "trigger-events-get",
        description: "Fetch a trigger monitoring event detail.",
        inputSchema: {
            type: "object",
            properties: {
                eventId: { type: "string", description: "Trigger event ID" },
                workspaceId: { type: "string", description: "Workspace override" }
            },
            required: ["eventId"]
        },
        invoke_url: "/api/mcp",
        category: "agent-ops"
    },
    {
        name: "agent-evaluations-list",
        description: "List evaluations for an agent with trends and insights.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                from: { type: "string", description: "Start ISO timestamp" },
                to: { type: "string", description: "End ISO timestamp" },
                limit: { type: "number", description: "Max evaluations to return" },
                cursor: { type: "string", description: "Pagination cursor" },
                source: {
                    type: "string",
                    description: "Source filter: production, simulation, or all"
                }
            },
            required: ["agentId"]
        },
        invoke_url: "/api/mcp",
        category: "agent-ops"
    },
    {
        name: "agent-evaluations-run",
        description: "Run evaluations on unevaluated runs for an agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                limit: { type: "number", description: "Max runs to evaluate" },
                runIds: {
                    type: "array",
                    items: { type: "string" },
                    description: "Optional specific run IDs to evaluate"
                }
            },
            required: ["agentId"]
        },
        invoke_url: "/api/mcp",
        category: "agent-ops"
    },
    {
        name: "agent-versions-list",
        description: "List version history for an agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                limit: { type: "number", description: "Max versions to return" },
                cursor: { type: "number", description: "Version cursor (numeric)" }
            },
            required: ["agentId"]
        },
        invoke_url: "/api/mcp",
        category: "agent-ops"
    }
];

export const agentOpsToolRoutes: McpToolRoute[] = [
    {
        kind: "internal",
        name: "agent-runs-list",
        method: "GET",
        path: "/api/agents/{agentId}/runs",
        pathParams: ["agentId"],
        queryParams: ["status", "search", "from", "to", "cursor", "limit", "source"]
    },
    {
        kind: "internal",
        name: "agent-runs-get",
        method: "GET",
        path: "/api/agents/{agentId}/runs/{runId}",
        pathParams: ["agentId", "runId"]
    },
    {
        kind: "internal",
        name: "trigger-events-list",
        method: "GET",
        path: "/api/live/triggers",
        queryParams: [
            "status",
            "sourceType",
            "integrationKey",
            "triggerId",
            "agentId",
            "eventName",
            "search",
            "from",
            "to",
            "limit",
            "offset",
            "workspaceId"
        ]
    },
    {
        kind: "internal",
        name: "trigger-events-get",
        method: "GET",
        path: "/api/live/triggers/{eventId}",
        pathParams: ["eventId"],
        queryParams: ["workspaceId"]
    },
    {
        kind: "internal",
        name: "agent-evaluations-list",
        method: "GET",
        path: "/api/agents/{agentId}/evaluations",
        pathParams: ["agentId"],
        queryParams: ["from", "to", "limit", "cursor", "source"]
    },
    {
        kind: "internal",
        name: "agent-evaluations-run",
        method: "POST",
        path: "/api/agents/{agentId}/evaluations",
        pathParams: ["agentId"],
        bodyParams: ["limit", "runIds"]
    },
    {
        kind: "custom",
        name: "agent-versions-list",
        handler: "agentVersionsList"
    }
];
