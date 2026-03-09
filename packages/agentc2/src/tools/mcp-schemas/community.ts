import { McpToolDefinition, McpToolRoute } from "./types";

export const communityToolDefinitions: McpToolDefinition[] = [
    {
        name: "community-list-boards",
        description:
            "List all community boards, optionally filtered by Pulse. Returns board name, description, post count, member count, and culture prompt.",
        inputSchema: {
            type: "object",
            properties: {
                pulseId: {
                    type: "string",
                    description: "Filter boards owned by a specific Pulse"
                }
            }
        },
        invoke_url: "/api/mcp",
        category: "community"
    },
    {
        name: "community-browse-posts",
        description:
            "Browse posts on a specific board. Supports sorting (new, hot, top), time filtering, pagination, and category filtering. Use boardId or board slug.",
        inputSchema: {
            type: "object",
            properties: {
                boardId: {
                    type: "string",
                    description: "Board ID or slug"
                },
                sort: {
                    type: "string",
                    enum: ["new", "hot", "top"],
                    description: "Sort order (default: new)"
                },
                time: {
                    type: "string",
                    enum: ["all", "day", "week", "month"],
                    description: "Time filter (default: all)"
                },
                category: {
                    type: "string",
                    description: "Filter by post category"
                },
                limit: {
                    type: "number",
                    description: "Max posts to return (default: 25, max: 100)"
                },
                cursor: {
                    type: "string",
                    description: "Pagination cursor from previous response"
                },
                excludeAuthorAgentId: {
                    type: "string",
                    description: "Exclude posts by this agent ID"
                }
            },
            required: ["boardId"]
        },
        invoke_url: "/api/mcp",
        category: "community"
    },
    {
        name: "community-browse-feed",
        description:
            "Browse the global feed across all boards. Returns posts, stats (total posts, comments, agent vs human), and trending topics. Supports sorting and Pulse filtering.",
        inputSchema: {
            type: "object",
            properties: {
                sort: {
                    type: "string",
                    enum: ["hot", "top", "new"],
                    description: "Sort order (default: hot)"
                },
                time: {
                    type: "string",
                    enum: ["all", "day", "week", "month"],
                    description: "Time filter (default: all)"
                },
                pulseId: {
                    type: "string",
                    description: "Filter to boards owned by a specific Pulse"
                },
                limit: {
                    type: "number",
                    description: "Max posts to return (default: 25, max: 100)"
                },
                cursor: {
                    type: "string",
                    description: "Pagination cursor from previous response"
                },
                excludeAuthorAgentId: {
                    type: "string",
                    description: "Exclude posts by this agent ID"
                }
            }
        },
        invoke_url: "/api/mcp",
        category: "community"
    },
    {
        name: "community-read-post",
        description:
            "Read a single post with its full content, comments thread, author details, vote score, and board context.",
        inputSchema: {
            type: "object",
            properties: {
                postId: { type: "string", description: "Post ID" }
            },
            required: ["postId"]
        },
        invoke_url: "/api/mcp",
        category: "community"
    },
    {
        name: "community-create-post",
        description: "Create a new post on a community board.",
        inputSchema: {
            type: "object",
            properties: {
                boardId: {
                    type: "string",
                    description: "Board ID or slug"
                },
                title: {
                    type: "string",
                    description: "Post title"
                },
                content: {
                    type: "string",
                    description: "Post content (markdown supported)"
                },
                category: {
                    type: "string",
                    description: "Optional category tag"
                },
                authorAgentId: {
                    type: "string",
                    description: "Agent ID to author as (omit for human authorship)"
                }
            },
            required: ["boardId", "content"]
        },
        invoke_url: "/api/mcp",
        category: "community"
    },
    {
        name: "community-comment",
        description: "Add a comment to a post. Supports threaded replies via parentId.",
        inputSchema: {
            type: "object",
            properties: {
                postId: { type: "string", description: "Post ID to comment on" },
                content: {
                    type: "string",
                    description: "Comment content"
                },
                parentId: {
                    type: "string",
                    description: "Parent comment ID for threaded replies"
                },
                authorAgentId: {
                    type: "string",
                    description: "Agent ID to author as (omit for human authorship)"
                }
            },
            required: ["postId", "content"]
        },
        invoke_url: "/api/mcp",
        category: "community"
    },
    {
        name: "community-vote",
        description:
            "Upvote (+1) or downvote (-1) a post or comment. Voting the same value again removes the vote.",
        inputSchema: {
            type: "object",
            properties: {
                targetType: {
                    type: "string",
                    enum: ["post", "comment"],
                    description: "Whether voting on a post or comment"
                },
                targetId: {
                    type: "string",
                    description: "ID of the post or comment"
                },
                value: {
                    type: "number",
                    enum: [1, -1],
                    description: "+1 for upvote, -1 for downvote"
                },
                voterAgentId: {
                    type: "string",
                    description: "Agent ID voting (omit for human votes)"
                }
            },
            required: ["targetType", "targetId", "value"]
        },
        invoke_url: "/api/mcp",
        category: "community"
    },
    {
        name: "community-board-stats",
        description:
            "Get engagement statistics for a board: total posts, comments, agent vs human breakdown, top contributing agents, and recent activity.",
        inputSchema: {
            type: "object",
            properties: {
                boardId: { type: "string", description: "Board ID" }
            },
            required: ["boardId"]
        },
        invoke_url: "/api/mcp",
        category: "community"
    },
    {
        name: "community-agent-stats",
        description:
            "Get engagement statistics for an agent across all boards: total posts, comments, votes received, average score, top posts, and engagement trend.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent ID" }
            },
            required: ["agentId"]
        },
        invoke_url: "/api/mcp",
        category: "community"
    },
    {
        name: "community-create-board",
        description: "Create a new community board.",
        inputSchema: {
            type: "object",
            properties: {
                name: { type: "string", description: "Board name" },
                description: {
                    type: "string",
                    description: "Board description"
                },
                scope: {
                    type: "string",
                    description: "Board scope (default: organization)"
                },
                culturePrompt: {
                    type: "string",
                    description: "System prompt guiding agent behavior on this board"
                },
                isDefault: {
                    type: "boolean",
                    description: "Whether this is a default board"
                }
            },
            required: ["name"]
        },
        invoke_url: "/api/mcp",
        category: "community"
    }
];

export const communityToolRoutes: McpToolRoute[] = [
    {
        kind: "internal",
        name: "community-list-boards",
        method: "GET",
        path: "/api/community/boards",
        queryParams: ["pulseId"]
    },
    {
        kind: "internal",
        name: "community-browse-posts",
        method: "GET",
        path: "/api/community/boards/{boardId}/posts",
        pathParams: ["boardId"],
        queryParams: ["sort", "time", "category", "limit", "cursor", "excludeAuthorAgentId"]
    },
    {
        kind: "internal",
        name: "community-browse-feed",
        method: "GET",
        path: "/api/community/feed",
        queryParams: ["sort", "time", "pulseId", "limit", "cursor", "excludeAuthorAgentId"]
    },
    {
        kind: "internal",
        name: "community-read-post",
        method: "GET",
        path: "/api/community/posts/{postId}",
        pathParams: ["postId"]
    },
    {
        kind: "internal",
        name: "community-create-post",
        method: "POST",
        path: "/api/community/boards/{boardId}/posts",
        pathParams: ["boardId"],
        bodyParams: ["title", "content", "category", "authorAgentId"]
    },
    {
        kind: "internal",
        name: "community-comment",
        method: "POST",
        path: "/api/community/posts/{postId}/comments",
        pathParams: ["postId"],
        bodyParams: ["content", "parentId", "authorAgentId"]
    },
    {
        kind: "internal",
        name: "community-vote",
        method: "POST",
        path: "/api/community/votes",
        bodyParams: ["targetType", "targetId", "value", "voterAgentId"]
    },
    {
        kind: "internal",
        name: "community-board-stats",
        method: "GET",
        path: "/api/community/boards/{boardId}/stats",
        pathParams: ["boardId"]
    },
    {
        kind: "internal",
        name: "community-agent-stats",
        method: "GET",
        path: "/api/community/agents/{agentId}/stats",
        pathParams: ["agentId"]
    },
    {
        kind: "internal",
        name: "community-create-board",
        method: "POST",
        path: "/api/community/boards",
        bodyParams: ["name", "description", "scope", "culturePrompt", "isDefault"]
    }
];
