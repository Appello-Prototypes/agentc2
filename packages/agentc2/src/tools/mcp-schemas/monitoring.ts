import { McpToolDefinition, McpToolRoute } from "./types";

export const monitoringToolDefinitions: McpToolDefinition[] = [
    {
        name: "live-runs",
        description: "List live production runs with filters.",
        inputSchema: {
            type: "object",
            properties: {
                status: { type: "string", description: "Run status filter" },
                source: { type: "string", description: "Source channel filter" },
                agentId: { type: "string", description: "Agent ID filter" },
                versionId: { type: "string", description: "Agent version filter" },
                modelName: { type: "string", description: "Model name filter" },
                runType: { type: "string", description: "Run type filter" },
                toolUsage: { type: "string", description: "Tool usage filter" },
                search: { type: "string", description: "Search by run ID or keyword" },
                from: { type: "string", description: "Start ISO timestamp" },
                to: { type: "string", description: "End ISO timestamp" },
                limit: { type: "number", description: "Max runs to return" },
                offset: { type: "number", description: "Pagination offset" }
            }
        },
        invoke_url: "/api/mcp",
        category: "monitoring"
    },
    {
        name: "live-metrics",
        description: "Get aggregate live performance metrics.",
        inputSchema: {
            type: "object",
            properties: {
                runType: { type: "string", description: "Run type filter" },
                from: { type: "string", description: "Start ISO timestamp" },
                to: { type: "string", description: "End ISO timestamp" }
            }
        },
        invoke_url: "/api/mcp",
        category: "monitoring"
    },
    {
        name: "live-stats",
        description: "Get live production stats for active agents.",
        inputSchema: {
            type: "object",
            properties: {}
        },
        invoke_url: "/api/mcp",
        category: "monitoring"
    },
    {
        name: "audit-logs-list",
        description: "Query audit logs with filtering and pagination.",
        inputSchema: {
            type: "object",
            properties: {
                entityType: { type: "string", description: "Entity type filter" },
                entityId: { type: "string", description: "Entity ID filter" },
                action: { type: "string", description: "Action filter" },
                from: { type: "string", description: "Start ISO timestamp" },
                to: { type: "string", description: "End ISO timestamp" },
                limit: { type: "number", description: "Max results to return" },
                cursor: { type: "string", description: "Pagination cursor" }
            }
        },
        invoke_url: "/api/mcp",
        category: "monitoring"
    }
];

export const monitoringToolRoutes: McpToolRoute[] = [
    {
        kind: "internal",
        name: "live-runs",
        method: "GET",
        path: "/api/live/runs",
        queryParams: [
            "status",
            "source",
            "agentId",
            "versionId",
            "modelName",
            "runType",
            "toolUsage",
            "search",
            "from",
            "to",
            "limit",
            "offset"
        ]
    },
    {
        kind: "internal",
        name: "live-metrics",
        method: "GET",
        path: "/api/live/metrics",
        queryParams: ["runType", "from", "to"]
    },
    {
        kind: "internal",
        name: "live-stats",
        method: "GET",
        path: "/api/live/stats"
    },
    {
        kind: "internal",
        name: "audit-logs-list",
        method: "GET",
        path: "/api/audit-logs",
        queryParams: ["entityType", "entityId", "action", "from", "to", "limit", "cursor"]
    }
];
