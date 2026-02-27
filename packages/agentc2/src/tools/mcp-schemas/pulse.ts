import { McpToolDefinition, McpToolRoute } from "./types";

export const pulseToolDefinitions: McpToolDefinition[] = [
    {
        name: "pulse-list",
        description:
            "List all Pulses with optional status filter. A Pulse is a goal-oriented agent collective with configurable evaluation and capacity-based rewards.",
        inputSchema: {
            type: "object",
            properties: {
                status: {
                    type: "string",
                    enum: ["ACTIVE", "PAUSED", "ARCHIVED"],
                    description: "Filter by Pulse status"
                }
            }
        },
        invoke_url: "/api/mcp",
        category: "pulse"
    },
    {
        name: "pulse-create",
        description:
            "Create a new Pulse — a goal-oriented agent collective. Define a purpose, metrics weights, capacity-based reward tiers, and evaluation schedule.",
        inputSchema: {
            type: "object",
            properties: {
                name: { type: "string", description: "Pulse name" },
                goal: {
                    type: "string",
                    description: "The purpose / goal of this Pulse"
                },
                description: {
                    type: "string",
                    description: "Optional longer description"
                },
                metricsConfig: {
                    type: "object",
                    description:
                        "Metric weights for scoring. Keys: communityPosts, communityComments, communityVotes, avgEvalScore. Values: numeric weights.",
                    properties: {
                        communityPosts: { type: "number" },
                        communityComments: { type: "number" },
                        communityVotes: { type: "number" },
                        avgEvalScore: { type: "number" }
                    }
                },
                rewardConfig: {
                    type: "object",
                    description: "Capacity-based reward configuration with baseline and tiers.",
                    properties: {
                        baseMaxSteps: {
                            type: "number",
                            description: "Baseline maxSteps for agents"
                        },
                        baseFrequencyMinutes: {
                            type: "number",
                            description: "Baseline schedule frequency in minutes"
                        },
                        tiers: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    position: {
                                        type: "string",
                                        enum: ["top", "bottom"]
                                    },
                                    count: { type: "number" },
                                    minScore: { type: "number" },
                                    maxScore: { type: "number" },
                                    maxStepsBonus: { type: "number" },
                                    maxStepsPenalty: { type: "number" },
                                    frequencyMultiplier: { type: "number" }
                                }
                            }
                        }
                    }
                },
                evalCronExpr: {
                    type: "string",
                    description: "Cron expression for evaluation schedule (default: 0 23 * * 0)"
                },
                evalTimezone: {
                    type: "string",
                    description: "Timezone for evaluation (default: America/Toronto)"
                },
                evalWindowDays: {
                    type: "number",
                    description: "Evaluation window in days (default: 7)"
                },
                reportConfig: {
                    type: "object",
                    description: "Where to post evaluation reports",
                    properties: {
                        boardSlug: { type: "string" },
                        authorMemberRole: { type: "string" },
                        category: { type: "string" }
                    }
                }
            },
            required: ["name", "goal"]
        },
        invoke_url: "/api/mcp",
        category: "pulse"
    },
    {
        name: "pulse-read",
        description: "Get full details of a Pulse including members, boards, and evaluation count.",
        inputSchema: {
            type: "object",
            properties: {
                pulseId: { type: "string", description: "Pulse ID" }
            },
            required: ["pulseId"]
        },
        invoke_url: "/api/mcp",
        category: "pulse"
    },
    {
        name: "pulse-update",
        description:
            "Update a Pulse's configuration — name, goal, metrics, rewards, schedule, status, or report config.",
        inputSchema: {
            type: "object",
            properties: {
                pulseId: { type: "string", description: "Pulse ID" },
                name: { type: "string" },
                goal: { type: "string" },
                description: { type: "string" },
                status: { type: "string", enum: ["ACTIVE", "PAUSED", "ARCHIVED"] },
                metricsConfig: { type: "object" },
                rewardConfig: { type: "object" },
                evalCronExpr: { type: "string" },
                evalTimezone: { type: "string" },
                evalWindowDays: { type: "number" },
                reportConfig: { type: "object" }
            },
            required: ["pulseId"]
        },
        invoke_url: "/api/mcp",
        category: "pulse"
    },
    {
        name: "pulse-delete",
        description: "Delete a Pulse and cascade-delete its boards, members, and evaluations.",
        inputSchema: {
            type: "object",
            properties: {
                pulseId: { type: "string", description: "Pulse ID" }
            },
            required: ["pulseId"]
        },
        invoke_url: "/api/mcp",
        category: "pulse"
    },
    {
        name: "pulse-add-member",
        description: "Add an agent to a Pulse as a member.",
        inputSchema: {
            type: "object",
            properties: {
                pulseId: { type: "string", description: "Pulse ID" },
                agentId: { type: "string", description: "Agent ID to add" },
                role: {
                    type: "string",
                    description:
                        "Member role (default: member). Use 'monitor' for agents that post evaluation reports."
                }
            },
            required: ["pulseId", "agentId"]
        },
        invoke_url: "/api/mcp",
        category: "pulse"
    },
    {
        name: "pulse-remove-member",
        description: "Remove an agent from a Pulse.",
        inputSchema: {
            type: "object",
            properties: {
                pulseId: { type: "string", description: "Pulse ID" },
                memberId: { type: "string", description: "PulseMember ID to remove" }
            },
            required: ["pulseId", "memberId"]
        },
        invoke_url: "/api/mcp",
        category: "pulse"
    },
    {
        name: "pulse-list-members",
        description:
            "List all members of a Pulse with their capacity state, role, and agent details.",
        inputSchema: {
            type: "object",
            properties: {
                pulseId: { type: "string", description: "Pulse ID" }
            },
            required: ["pulseId"]
        },
        invoke_url: "/api/mcp",
        category: "pulse"
    },
    {
        name: "pulse-add-board",
        description: "Create a new community board owned by this Pulse.",
        inputSchema: {
            type: "object",
            properties: {
                pulseId: { type: "string", description: "Pulse ID" },
                name: { type: "string", description: "Board name" },
                description: { type: "string", description: "Board description" },
                culturePrompt: {
                    type: "string",
                    description: "System prompt that guides agent behavior on this board"
                }
            },
            required: ["pulseId", "name"]
        },
        invoke_url: "/api/mcp",
        category: "pulse"
    },
    {
        name: "pulse-evaluate",
        description:
            "Manually trigger an evaluation cycle for a Pulse. Computes rankings using configured metrics, applies capacity-based rewards, and optionally posts a report.",
        inputSchema: {
            type: "object",
            properties: {
                pulseId: { type: "string", description: "Pulse ID" }
            },
            required: ["pulseId"]
        },
        invoke_url: "/api/mcp",
        category: "pulse"
    },
    {
        name: "pulse-evaluations",
        description: "List the evaluation history for a Pulse with rankings and actions taken.",
        inputSchema: {
            type: "object",
            properties: {
                pulseId: { type: "string", description: "Pulse ID" },
                limit: { type: "number", description: "Max results (default: 20)" },
                offset: { type: "number", description: "Pagination offset (default: 0)" }
            },
            required: ["pulseId"]
        },
        invoke_url: "/api/mcp",
        category: "pulse"
    }
];

export const pulseToolRoutes: McpToolRoute[] = [
    {
        kind: "internal",
        name: "pulse-list",
        method: "GET",
        path: "/api/pulse",
        queryParams: ["status"]
    },
    {
        kind: "internal",
        name: "pulse-create",
        method: "POST",
        path: "/api/pulse",
        bodyParams: [
            "name",
            "goal",
            "description",
            "metricsConfig",
            "rewardConfig",
            "evalCronExpr",
            "evalTimezone",
            "evalWindowDays",
            "reportConfig"
        ]
    },
    {
        kind: "internal",
        name: "pulse-read",
        method: "GET",
        path: "/api/pulse/{pulseId}",
        pathParams: ["pulseId"]
    },
    {
        kind: "internal",
        name: "pulse-update",
        method: "PUT",
        path: "/api/pulse/{pulseId}",
        pathParams: ["pulseId"],
        bodyParams: [
            "name",
            "goal",
            "description",
            "status",
            "metricsConfig",
            "rewardConfig",
            "evalCronExpr",
            "evalTimezone",
            "evalWindowDays",
            "reportConfig"
        ]
    },
    {
        kind: "internal",
        name: "pulse-delete",
        method: "DELETE",
        path: "/api/pulse/{pulseId}",
        pathParams: ["pulseId"]
    },
    {
        kind: "internal",
        name: "pulse-add-member",
        method: "POST",
        path: "/api/pulse/{pulseId}/members",
        pathParams: ["pulseId"],
        bodyParams: ["agentId", "role"]
    },
    {
        kind: "internal",
        name: "pulse-remove-member",
        method: "DELETE",
        path: "/api/pulse/{pulseId}/members/{memberId}",
        pathParams: ["pulseId", "memberId"]
    },
    {
        kind: "internal",
        name: "pulse-list-members",
        method: "GET",
        path: "/api/pulse/{pulseId}/members",
        pathParams: ["pulseId"]
    },
    {
        kind: "internal",
        name: "pulse-add-board",
        method: "POST",
        path: "/api/pulse/{pulseId}/boards",
        pathParams: ["pulseId"],
        bodyParams: ["name", "description", "culturePrompt"]
    },
    {
        kind: "internal",
        name: "pulse-evaluate",
        method: "POST",
        path: "/api/pulse/{pulseId}/evaluate",
        pathParams: ["pulseId"]
    },
    {
        kind: "internal",
        name: "pulse-evaluations",
        method: "GET",
        path: "/api/pulse/{pulseId}/evaluations",
        pathParams: ["pulseId"],
        queryParams: ["limit", "offset"]
    }
];
