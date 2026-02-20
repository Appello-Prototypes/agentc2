import { McpToolDefinition, McpToolRoute } from "./types";

export const campaignToolDefinitions: McpToolDefinition[] = [
    {
        name: "campaign-create",
        description:
            "Create a new campaign using Mission Command principles. Define WHAT to achieve (intent + end state), and the platform autonomously decomposes into missions, assigns agents, executes, and generates After Action Reviews.",
        inputSchema: {
            type: "object",
            properties: {
                name: { type: "string", description: "Campaign name" },
                intent: {
                    type: "string",
                    description:
                        "Commander's intent: WHAT to achieve, not HOW. The platform determines the approach autonomously."
                },
                endState: {
                    type: "string",
                    description:
                        "Observable conditions that define success — what the world looks like when the campaign is done."
                },
                description: {
                    type: "string",
                    description: "Additional context or background for the campaign"
                },
                constraints: {
                    type: "array",
                    items: { type: "string" },
                    description: "Restrictions on HOW the campaign executes (must/must not rules)"
                },
                restraints: {
                    type: "array",
                    items: { type: "string" },
                    description: "Limitations on resources or approach"
                },
                requireApproval: {
                    type: "boolean",
                    description:
                        "If true, campaign pauses in READY status for human approval before execution. Default: false."
                },
                maxCostUsd: {
                    type: "number",
                    description: "Maximum cost budget in USD"
                },
                timeoutMinutes: {
                    type: "number",
                    description: "Maximum execution time in minutes"
                }
            },
            required: ["name", "intent", "endState"]
        },
        invoke_url: "/api/mcp",
        category: "campaigns"
    },
    {
        name: "campaign-list",
        description:
            "List all campaigns with optional status filter and pagination. Returns campaigns with their missions summary.",
        inputSchema: {
            type: "object",
            properties: {
                status: {
                    type: "string",
                    enum: [
                        "PLANNING",
                        "ANALYZING",
                        "READY",
                        "EXECUTING",
                        "REVIEWING",
                        "COMPLETE",
                        "FAILED",
                        "PAUSED"
                    ],
                    description: "Filter by campaign status"
                },
                limit: {
                    type: "number",
                    description: "Max results per page (default: 50)"
                },
                offset: {
                    type: "number",
                    description: "Pagination offset (default: 0)"
                }
            }
        },
        invoke_url: "/api/mcp",
        category: "campaigns"
    },
    {
        name: "campaign-get",
        description:
            "Get full campaign details including missions, tasks, evaluations, After Action Reviews, and activity logs.",
        inputSchema: {
            type: "object",
            properties: {
                campaignId: { type: "string", description: "Campaign ID" }
            },
            required: ["campaignId"]
        },
        invoke_url: "/api/mcp",
        category: "campaigns"
    },
    {
        name: "campaign-update",
        description:
            "Update a campaign's configuration or perform lifecycle actions. Actions: 'approve' starts a READY campaign, 'cancel' stops a running campaign, 'resume' restarts a PAUSED campaign. Field updates only allowed in PLANNING or READY status.",
        inputSchema: {
            type: "object",
            properties: {
                campaignId: { type: "string", description: "Campaign ID" },
                action: {
                    type: "string",
                    enum: ["approve", "cancel", "resume"],
                    description:
                        "Lifecycle action: 'approve' (start READY campaign), 'cancel' (stop campaign), 'resume' (resume PAUSED campaign)"
                },
                name: { type: "string", description: "Update campaign name" },
                intent: { type: "string", description: "Update intent" },
                endState: { type: "string", description: "Update end state" },
                description: { type: "string", description: "Update description" },
                constraints: {
                    type: "array",
                    items: { type: "string" },
                    description: "Update constraints"
                },
                restraints: {
                    type: "array",
                    items: { type: "string" },
                    description: "Update restraints"
                },
                requireApproval: {
                    type: "boolean",
                    description: "Update approval requirement"
                },
                maxCostUsd: { type: "number", description: "Update cost budget" },
                timeoutMinutes: { type: "number", description: "Update timeout" }
            },
            required: ["campaignId"]
        },
        invoke_url: "/api/mcp",
        category: "campaigns"
    },
    {
        name: "campaign-delete",
        description:
            "Delete a campaign and all related data (missions, tasks, logs). Cannot delete campaigns in EXECUTING status — cancel first.",
        inputSchema: {
            type: "object",
            properties: {
                campaignId: { type: "string", description: "Campaign ID" }
            },
            required: ["campaignId"]
        },
        invoke_url: "/api/mcp",
        category: "campaigns"
    }
];

export const campaignToolRoutes: McpToolRoute[] = [
    { kind: "registry", name: "campaign-create" },
    { kind: "registry", name: "campaign-list" },
    { kind: "registry", name: "campaign-get" },
    { kind: "registry", name: "campaign-update" },
    { kind: "registry", name: "campaign-delete" }
];
