import { McpToolDefinition, McpToolRoute } from "./types";

export const networkOpsToolDefinitions: McpToolDefinition[] = [
    {
        name: "network.execute",
        description: "Execute a network by slug or ID.",
        inputSchema: {
            type: "object",
            properties: {
                networkSlug: { type: "string", description: "Network slug or ID" },
                message: { type: "string", description: "Message to route" },
                source: {
                    type: "string",
                    description: "Source channel (api, webhook, test, etc.)"
                },
                environment: {
                    type: "string",
                    description: "Environment (development, staging, production)"
                },
                triggerType: {
                    type: "string",
                    description: "Trigger type (manual, api, scheduled, webhook, tool, test, retry)"
                },
                threadId: { type: "string", description: "Optional thread ID" },
                resourceId: { type: "string", description: "Optional resource ID" }
            },
            required: ["networkSlug", "message"]
        },
        invoke_url: "/api/mcp",
        category: "network-ops"
    },
    {
        name: "network.list-runs",
        description: "List network runs with filters and time range.",
        inputSchema: {
            type: "object",
            properties: {
                networkSlug: { type: "string", description: "Network slug or ID" },
                limit: { type: "number", description: "Max runs to return" },
                status: { type: "string", description: "Run status filter" },
                environment: { type: "string", description: "Environment filter" },
                triggerType: { type: "string", description: "Trigger type filter" },
                from: { type: "string", description: "Start ISO timestamp" },
                to: { type: "string", description: "End ISO timestamp" },
                search: { type: "string", description: "Search run ID or text" }
            },
            required: ["networkSlug"]
        },
        invoke_url: "/api/mcp",
        category: "network-ops"
    },
    {
        name: "network.get-run",
        description: "Fetch network run details including steps.",
        inputSchema: {
            type: "object",
            properties: {
                networkSlug: { type: "string", description: "Network slug or ID" },
                runId: { type: "string", description: "Run ID" }
            },
            required: ["networkSlug", "runId"]
        },
        invoke_url: "/api/mcp",
        category: "network-ops"
    },
    {
        name: "network-metrics",
        description: "Get network metrics for a recent period.",
        inputSchema: {
            type: "object",
            properties: {
                networkSlug: { type: "string", description: "Network slug or ID" },
                days: { type: "number", description: "Number of days to include" }
            },
            required: ["networkSlug"]
        },
        invoke_url: "/api/mcp",
        category: "network-ops"
    },
    {
        name: "network-versions",
        description: "List network versions.",
        inputSchema: {
            type: "object",
            properties: {
                networkSlug: { type: "string", description: "Network slug or ID" }
            },
            required: ["networkSlug"]
        },
        invoke_url: "/api/mcp",
        category: "network-ops"
    },
    {
        name: "network-stats",
        description: "Get network statistics across the workspace.",
        inputSchema: {
            type: "object",
            properties: {
                from: { type: "string", description: "Start ISO timestamp" },
                to: { type: "string", description: "End ISO timestamp" }
            }
        },
        invoke_url: "/api/mcp",
        category: "network-ops"
    }
];

export const networkOpsToolRoutes: McpToolRoute[] = [
    {
        kind: "custom",
        name: "network.execute",
        handler: "networkExecute"
    },
    {
        kind: "internal",
        name: "network.list-runs",
        method: "GET",
        path: "/api/networks/{networkSlug}/runs",
        pathParams: ["networkSlug"],
        queryParams: ["limit", "status", "environment", "triggerType", "from", "to", "search"],
        expectSuccess: false
    },
    {
        kind: "internal",
        name: "network.get-run",
        method: "GET",
        path: "/api/networks/{networkSlug}/runs/{runId}",
        pathParams: ["networkSlug", "runId"],
        expectSuccess: false
    },
    {
        kind: "internal",
        name: "network-metrics",
        method: "GET",
        path: "/api/networks/{networkSlug}/metrics",
        pathParams: ["networkSlug"],
        queryParams: ["days"]
    },
    {
        kind: "internal",
        name: "network-versions",
        method: "GET",
        path: "/api/networks/{networkSlug}/versions",
        pathParams: ["networkSlug"]
    },
    {
        kind: "internal",
        name: "network-stats",
        method: "GET",
        path: "/api/networks/stats",
        queryParams: ["from", "to"]
    }
];
