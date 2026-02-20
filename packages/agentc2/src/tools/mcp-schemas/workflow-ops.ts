import { McpToolDefinition, McpToolRoute } from "./types";

export const workflowOpsToolDefinitions: McpToolDefinition[] = [
    {
        name: "workflow.execute",
        description: "Execute a workflow by slug or ID.",
        inputSchema: {
            type: "object",
            properties: {
                workflowSlug: { type: "string", description: "Workflow slug or ID" },
                input: { type: "object", description: "Workflow input payload" },
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
                requestContext: { type: "object", description: "Optional request context" }
            },
            required: ["workflowSlug", "input"]
        },
        invoke_url: "/api/mcp",
        category: "workflow-ops"
    },
    {
        name: "workflow.list-runs",
        description: "List workflow runs with filters and time range.",
        inputSchema: {
            type: "object",
            properties: {
                workflowSlug: { type: "string", description: "Workflow slug or ID" },
                limit: { type: "number", description: "Max runs to return" },
                status: { type: "string", description: "Run status filter" },
                environment: { type: "string", description: "Environment filter" },
                triggerType: { type: "string", description: "Trigger type filter" },
                from: { type: "string", description: "Start ISO timestamp" },
                to: { type: "string", description: "End ISO timestamp" },
                search: { type: "string", description: "Search run ID" }
            },
            required: ["workflowSlug"]
        },
        invoke_url: "/api/mcp",
        category: "workflow-ops"
    },
    {
        name: "workflow.get-run",
        description: "Fetch workflow run details including steps.",
        inputSchema: {
            type: "object",
            properties: {
                workflowSlug: { type: "string", description: "Workflow slug or ID" },
                runId: { type: "string", description: "Run ID" }
            },
            required: ["workflowSlug", "runId"]
        },
        invoke_url: "/api/mcp",
        category: "workflow-ops"
    },
    {
        name: "workflow-resume",
        description: "Resume a suspended workflow run.",
        inputSchema: {
            type: "object",
            properties: {
                workflowSlug: { type: "string", description: "Workflow slug or ID" },
                runId: { type: "string", description: "Run ID" },
                resumeData: { type: "object", description: "Resume payload" },
                requestContext: { type: "object", description: "Optional request context" }
            },
            required: ["workflowSlug", "runId"]
        },
        invoke_url: "/api/mcp",
        category: "workflow-ops"
    },
    {
        name: "workflow-metrics",
        description: "Get workflow metrics for a recent period.",
        inputSchema: {
            type: "object",
            properties: {
                workflowSlug: { type: "string", description: "Workflow slug or ID" },
                days: { type: "number", description: "Number of days to include" }
            },
            required: ["workflowSlug"]
        },
        invoke_url: "/api/mcp",
        category: "workflow-ops"
    },
    {
        name: "workflow-versions",
        description: "List workflow versions.",
        inputSchema: {
            type: "object",
            properties: {
                workflowSlug: { type: "string", description: "Workflow slug or ID" }
            },
            required: ["workflowSlug"]
        },
        invoke_url: "/api/mcp",
        category: "workflow-ops"
    },
    {
        name: "workflow-stats",
        description: "Get workflow statistics across the workspace.",
        inputSchema: {
            type: "object",
            properties: {
                from: { type: "string", description: "Start ISO timestamp" },
                to: { type: "string", description: "End ISO timestamp" }
            }
        },
        invoke_url: "/api/mcp",
        category: "workflow-ops"
    }
];

export const workflowOpsToolRoutes: McpToolRoute[] = [
    {
        kind: "custom",
        name: "workflow.execute",
        handler: "workflowExecute"
    },
    {
        kind: "internal",
        name: "workflow.list-runs",
        method: "GET",
        path: "/api/workflows/{workflowSlug}/runs",
        pathParams: ["workflowSlug"],
        queryParams: ["limit", "status", "environment", "triggerType", "from", "to", "search"],
        expectSuccess: false
    },
    {
        kind: "internal",
        name: "workflow.get-run",
        method: "GET",
        path: "/api/workflows/{workflowSlug}/runs/{runId}",
        pathParams: ["workflowSlug", "runId"],
        expectSuccess: false
    },
    {
        kind: "internal",
        name: "workflow-resume",
        method: "POST",
        path: "/api/workflows/{workflowSlug}/runs/{runId}/resume",
        pathParams: ["workflowSlug", "runId"],
        bodyParams: ["resumeData", "requestContext"]
    },
    {
        kind: "internal",
        name: "workflow-metrics",
        method: "GET",
        path: "/api/workflows/{workflowSlug}/metrics",
        pathParams: ["workflowSlug"],
        queryParams: ["days"]
    },
    {
        kind: "internal",
        name: "workflow-versions",
        method: "GET",
        path: "/api/workflows/{workflowSlug}/versions",
        pathParams: ["workflowSlug"]
    },
    {
        kind: "internal",
        name: "workflow-stats",
        method: "GET",
        path: "/api/workflows/stats",
        queryParams: ["from", "to"]
    }
];
