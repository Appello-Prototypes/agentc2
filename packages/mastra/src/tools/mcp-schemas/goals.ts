import { McpToolDefinition, McpToolRoute } from "./types";

export const goalToolDefinitions: McpToolDefinition[] = [
    {
        name: "goal-create",
        description: "Create a new goal.",
        inputSchema: {
            type: "object",
            properties: {
                title: { type: "string", description: "Goal title" },
                description: { type: "string", description: "Goal description" },
                priority: { type: "number", description: "Priority score" }
            },
            required: ["title", "description"]
        },
        invoke_url: "/api/mcp",
        category: "goals"
    },
    {
        name: "goal-list",
        description: "List all goals for the current user.",
        inputSchema: {
            type: "object",
            properties: {}
        },
        invoke_url: "/api/mcp",
        category: "goals"
    },
    {
        name: "goal-get",
        description: "Get a single goal by ID.",
        inputSchema: {
            type: "object",
            properties: {
                goalId: { type: "string", description: "Goal ID" }
            },
            required: ["goalId"]
        },
        invoke_url: "/api/mcp",
        category: "goals"
    },
    {
        name: "goal-update",
        description: "Update a goal (retry failed goals or cancel running goals).",
        inputSchema: {
            type: "object",
            properties: {
                goalId: { type: "string", description: "Goal ID" },
                action: {
                    type: "string",
                    enum: ["retry", "cancel"],
                    description: "Action: 'retry' for failed goals, 'cancel' for running goals"
                }
            },
            required: ["goalId", "action"]
        },
        invoke_url: "/api/mcp",
        category: "goals"
    },
    {
        name: "goal-delete",
        description: "Delete a goal.",
        inputSchema: {
            type: "object",
            properties: {
                goalId: { type: "string", description: "Goal ID" }
            },
            required: ["goalId"]
        },
        invoke_url: "/api/mcp",
        category: "goals"
    }
];

export const goalToolRoutes: McpToolRoute[] = [
    { kind: "registry", name: "goal-create" },
    { kind: "registry", name: "goal-list" },
    { kind: "registry", name: "goal-get" },
    { kind: "registry", name: "goal-update" },
    { kind: "registry", name: "goal-delete" }
];
