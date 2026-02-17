import { McpToolDefinition, McpToolRoute } from "./types";

export const backlogToolDefinitions: McpToolDefinition[] = [
    {
        name: "backlog-get",
        description:
            "Get an agent's backlog with task counts by status. Auto-creates backlog if none exists.",
        inputSchema: {
            type: "object",
            properties: {
                agentSlug: { type: "string", description: "Agent slug to get backlog for" }
            },
            required: ["agentSlug"]
        },
        invoke_url: "/api/mcp",
        category: "backlog"
    },
    {
        name: "backlog-add-task",
        description:
            "Add a task to an agent's backlog. Auto-creates backlog if needed. Tasks persist across sessions.",
        inputSchema: {
            type: "object",
            properties: {
                agentSlug: { type: "string", description: "Agent slug to add task to" },
                title: { type: "string", description: "Short task title" },
                description: { type: "string", description: "Detailed task description" },
                priority: {
                    type: "number",
                    description: "Priority 0-10 (default: 5, 10=critical)"
                },
                dueDate: { type: "string", description: "Due date (ISO 8601)" },
                tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Tags for categorization"
                },
                source: {
                    type: "string",
                    description: "Source: human, agent, heartbeat, campaign, trigger, slack"
                },
                createdById: {
                    type: "string",
                    description: "User ID or agent slug that created this task"
                },
                contextJson: { type: "object", description: "Additional context as JSON" }
            },
            required: ["agentSlug", "title"]
        },
        invoke_url: "/api/mcp",
        category: "backlog"
    },
    {
        name: "backlog-list-tasks",
        description:
            "List tasks from an agent's backlog. Default: pending and in-progress, sorted by priority.",
        inputSchema: {
            type: "object",
            properties: {
                agentSlug: { type: "string", description: "Agent slug" },
                status: {
                    type: "string",
                    description:
                        "Filter by status: PENDING, IN_PROGRESS, COMPLETED, FAILED, DEFERRED. Comma-separated."
                },
                limit: { type: "number", description: "Max tasks to return (default: 20)" },
                sortBy: {
                    type: "string",
                    enum: ["priority", "dueDate", "createdAt"],
                    description: "Sort field (default: priority)"
                }
            },
            required: ["agentSlug"]
        },
        invoke_url: "/api/mcp",
        category: "backlog"
    },
    {
        name: "backlog-update-task",
        description:
            "Update a backlog task: change status, add notes, update priority, or set result.",
        inputSchema: {
            type: "object",
            properties: {
                taskId: { type: "string", description: "Task ID to update" },
                status: {
                    type: "string",
                    enum: ["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "DEFERRED"],
                    description: "New status"
                },
                priority: { type: "number", description: "New priority (0-10)" },
                lastAttemptNote: {
                    type: "string",
                    description: "Note about what was attempted"
                },
                result: { type: "string", description: "Task result" },
                dueDate: { type: "string", description: "New due date (ISO 8601)" }
            },
            required: ["taskId"]
        },
        invoke_url: "/api/mcp",
        category: "backlog"
    },
    {
        name: "backlog-complete-task",
        description: "Mark a backlog task as completed with a result summary.",
        inputSchema: {
            type: "object",
            properties: {
                taskId: { type: "string", description: "Task ID to complete" },
                result: { type: "string", description: "What was accomplished" }
            },
            required: ["taskId", "result"]
        },
        invoke_url: "/api/mcp",
        category: "backlog"
    }
];

export const backlogToolRoutes: McpToolRoute[] = [
    { kind: "registry", name: "backlog-get" },
    { kind: "registry", name: "backlog-add-task" },
    { kind: "registry", name: "backlog-list-tasks" },
    { kind: "registry", name: "backlog-update-task" },
    { kind: "registry", name: "backlog-complete-task" }
];
