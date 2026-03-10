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
                },
                scoreFunction: {
                    type: "string",
                    description:
                        "Description of the single number that measures goal progress (e.g., 'Number of page-1 keywords')"
                },
                scoreFunctionType: {
                    type: "string",
                    enum: [
                        "manual",
                        "milestone_completion",
                        "task_completion",
                        "community_activity"
                    ],
                    description:
                        "How the score is computed. manual = God Agent measures it; others are auto-computed"
                },
                scoreDirection: {
                    type: "string",
                    enum: ["higher", "lower"],
                    description: "Whether higher or lower score values are better"
                },
                targetScore: {
                    type: "number",
                    description: "Target score value to reach"
                },
                settings: {
                    type: "object",
                    description: "General Pulse settings including reviewConfig and godAgentConfig"
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
                reportConfig: { type: "object" },
                scoreFunction: { type: "string" },
                scoreFunctionType: {
                    type: "string",
                    enum: [
                        "manual",
                        "milestone_completion",
                        "task_completion",
                        "community_activity"
                    ]
                },
                scoreDirection: { type: "string", enum: ["higher", "lower"] },
                targetScore: { type: "number" },
                settings: { type: "object" }
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
    },
    {
        name: "pulse-create-milestone",
        description:
            "Create a milestone for a Pulse with a target metric, target value, and optional due date.",
        inputSchema: {
            type: "object",
            properties: {
                pulseId: { type: "string", description: "Pulse ID" },
                title: { type: "string", description: "Milestone title" },
                description: { type: "string", description: "Milestone description" },
                targetMetric: {
                    type: "string",
                    description: "What metric this milestone tracks"
                },
                targetValue: { type: "number", description: "Target value for completion" },
                dueDate: {
                    type: "string",
                    description: "Due date in ISO 8601 format"
                },
                sortOrder: { type: "number", description: "Display order (default: 0)" }
            },
            required: ["pulseId", "title"]
        },
        invoke_url: "/api/mcp",
        category: "pulse"
    },
    {
        name: "pulse-update-milestone",
        description: "Update a milestone's status, current value, or other fields.",
        inputSchema: {
            type: "object",
            properties: {
                pulseId: { type: "string", description: "Pulse ID" },
                milestoneId: { type: "string", description: "Milestone ID" },
                title: { type: "string" },
                description: { type: "string" },
                status: {
                    type: "string",
                    enum: ["pending", "in_progress", "completed", "blocked"],
                    description: "Milestone status"
                },
                currentValue: { type: "number", description: "Current progress value" },
                targetValue: { type: "number" },
                targetMetric: { type: "string" },
                dueDate: { type: "string" }
            },
            required: ["pulseId", "milestoneId"]
        },
        invoke_url: "/api/mcp",
        category: "pulse"
    },
    {
        name: "pulse-list-milestones",
        description: "List all milestones for a Pulse with their progress status.",
        inputSchema: {
            type: "object",
            properties: {
                pulseId: { type: "string", description: "Pulse ID" },
                status: {
                    type: "string",
                    enum: ["pending", "in_progress", "completed", "blocked"],
                    description: "Filter by status"
                }
            },
            required: ["pulseId"]
        },
        invoke_url: "/api/mcp",
        category: "pulse"
    },
    {
        name: "pulse-assign-task",
        description:
            "Assign a community post as a task to an agent with a status, optional deadline, and optional milestone link.",
        inputSchema: {
            type: "object",
            properties: {
                postId: { type: "string", description: "Community post ID to assign as task" },
                assignedAgentId: { type: "string", description: "Agent ID to assign to" },
                taskStatus: {
                    type: "string",
                    enum: ["open", "in_progress", "done", "blocked"],
                    description: "Task status (default: open)"
                },
                dueDate: { type: "string", description: "Due date in ISO 8601 format" },
                milestoneId: {
                    type: "string",
                    description: "Link task to a milestone"
                }
            },
            required: ["postId", "assignedAgentId"]
        },
        invoke_url: "/api/mcp",
        category: "pulse"
    },
    {
        name: "pulse-update-task-status",
        description: "Update the status of a task (community post with task fields).",
        inputSchema: {
            type: "object",
            properties: {
                postId: { type: "string", description: "Community post ID" },
                taskStatus: {
                    type: "string",
                    enum: ["open", "in_progress", "done", "blocked"],
                    description: "New task status"
                }
            },
            required: ["postId", "taskStatus"]
        },
        invoke_url: "/api/mcp",
        category: "pulse"
    },
    {
        name: "pulse-update-score",
        description:
            "Update the current score for a Pulse and append to score history. Used by the God Agent to record score measurements.",
        inputSchema: {
            type: "object",
            properties: {
                pulseId: { type: "string", description: "Pulse ID" },
                score: { type: "number", description: "New score value" },
                notes: {
                    type: "string",
                    description: "Notes about this score measurement"
                },
                source: {
                    type: "string",
                    description: "Source of the measurement (e.g. 'manual', 'auto', 'god-agent')"
                }
            },
            required: ["pulseId", "score"]
        },
        invoke_url: "/api/mcp",
        category: "pulse"
    },
    {
        name: "pulse-log-experiment",
        description:
            "Log a structured experiment result to the experiment-log board. Creates a community post with structured metadata for querying. Every experiment (keep, discard, or crash) must be logged.",
        inputSchema: {
            type: "object",
            properties: {
                pulseId: { type: "string", description: "Pulse ID" },
                boardId: {
                    type: "string",
                    description: "Experiment-log board ID"
                },
                agentSlug: {
                    type: "string",
                    description: "Slug of the agent that ran the experiment"
                },
                agentId: {
                    type: "string",
                    description: "ID of the agent that ran the experiment"
                },
                scoreDelta: {
                    type: "number",
                    description: "Score change from this experiment (positive = improvement)"
                },
                status: {
                    type: "string",
                    enum: ["keep", "discard", "crash"],
                    description: "Experiment outcome"
                },
                hypothesis: {
                    type: "string",
                    description: "What was being tested"
                },
                result: {
                    type: "string",
                    description: "What happened"
                },
                constraintSuggestion: {
                    type: "string",
                    description:
                        "For discard/crash: suggested constraint to prevent this failure pattern"
                }
            },
            required: ["pulseId", "boardId", "agentSlug", "status", "hypothesis", "result"]
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
            "reportConfig",
            "scoreFunction",
            "scoreFunctionType",
            "scoreDirection",
            "targetScore",
            "settings"
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
            "reportConfig",
            "scoreFunction",
            "scoreFunctionType",
            "scoreDirection",
            "targetScore",
            "settings"
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
    },
    {
        kind: "internal",
        name: "pulse-create-milestone",
        method: "POST",
        path: "/api/pulse/{pulseId}/milestones",
        pathParams: ["pulseId"],
        bodyParams: ["title", "description", "targetMetric", "targetValue", "dueDate", "sortOrder"]
    },
    {
        kind: "internal",
        name: "pulse-update-milestone",
        method: "PUT",
        path: "/api/pulse/{pulseId}/milestones/{milestoneId}",
        pathParams: ["pulseId", "milestoneId"],
        bodyParams: [
            "title",
            "description",
            "status",
            "currentValue",
            "targetValue",
            "targetMetric",
            "dueDate"
        ]
    },
    {
        kind: "internal",
        name: "pulse-list-milestones",
        method: "GET",
        path: "/api/pulse/{pulseId}/milestones",
        pathParams: ["pulseId"],
        queryParams: ["status"]
    },
    {
        kind: "internal",
        name: "pulse-assign-task",
        method: "POST",
        path: "/api/pulse/{pulseId}/tasks/assign",
        pathParams: ["pulseId"],
        bodyParams: ["postId", "assignedAgentId", "taskStatus", "dueDate", "milestoneId"]
    },
    {
        kind: "internal",
        name: "pulse-update-task-status",
        method: "PUT",
        path: "/api/pulse/{pulseId}/tasks/status",
        pathParams: ["pulseId"],
        bodyParams: ["postId", "taskStatus"]
    },
    {
        kind: "internal",
        name: "pulse-update-score",
        method: "POST",
        path: "/api/pulse/{pulseId}/score",
        pathParams: ["pulseId"],
        bodyParams: ["score", "notes", "source"]
    },
    {
        kind: "internal",
        name: "pulse-log-experiment",
        method: "POST",
        path: "/api/pulse/{pulseId}/experiment-log",
        pathParams: ["pulseId"],
        bodyParams: [
            "boardId",
            "agentSlug",
            "agentId",
            "scoreDelta",
            "status",
            "hypothesis",
            "result",
            "constraintSuggestion"
        ]
    }
];
