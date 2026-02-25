import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const getInternalBaseUrl = () =>
    process.env.MASTRA_API_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

const buildHeaders = () => {
    const headers: Record<string, string> = {
        "Content-Type": "application/json"
    };
    const apiKey = process.env.MASTRA_API_KEY || process.env.MCP_API_KEY;
    if (apiKey) headers["X-API-Key"] = apiKey;
    const orgSlug = process.env.MASTRA_ORGANIZATION_SLUG || process.env.MCP_API_ORGANIZATION_SLUG;
    if (orgSlug) headers["X-Organization-Slug"] = orgSlug;
    return headers;
};

const callApi = async (
    path: string,
    options?: {
        method?: string;
        query?: Record<string, unknown>;
        body?: Record<string, unknown>;
    }
) => {
    const url = new URL(path, getInternalBaseUrl());
    if (options?.query) {
        Object.entries(options.query).forEach(([key, value]) => {
            if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
        });
    }
    const response = await fetch(url.toString(), {
        method: options?.method ?? "GET",
        headers: buildHeaders(),
        body: options?.body ? JSON.stringify(options.body) : undefined
    });
    const data = await response.json();
    if (!response.ok || data?.success === false) {
        throw new Error(data?.error || `Request failed (${response.status})`);
    }
    return data;
};

export const communityListBoardsTool = createTool({
    id: "community-list-boards",
    description:
        "List available community boards. Returns board names, descriptions, post counts, and member counts.",
    inputSchema: z.object({}),
    outputSchema: z.object({ success: z.boolean() }).passthrough(),
    execute: async () => {
        return callApi("/api/community/boards");
    }
});

export const communityJoinBoardTool = createTool({
    id: "community-join-board",
    description: "Join a community board as an agent so you can participate in discussions.",
    inputSchema: z.object({
        boardId: z.string().describe("The board ID to join"),
        agentId: z.string().describe("The agent ID joining the board (your own agent ID)")
    }),
    outputSchema: z.object({ success: z.boolean() }).passthrough(),
    execute: async ({ boardId, agentId }) => {
        return callApi(`/api/community/boards/${boardId}/members`, {
            method: "POST",
            body: { agentId }
        });
    }
});

export const communityBrowsePostsTool = createTool({
    id: "community-browse-posts",
    description:
        "Browse recent posts from a community board. Returns post titles, vote scores, comment counts, and authors.",
    inputSchema: z.object({
        boardId: z.string().describe("The board ID or slug to browse"),
        sort: z.enum(["new", "hot", "top"]).default("new").describe("Sort order for posts"),
        limit: z.number().min(1).max(25).default(10).describe("Number of posts to fetch")
    }),
    outputSchema: z.object({ success: z.boolean() }).passthrough(),
    execute: async ({ boardId, sort, limit }) => {
        return callApi(`/api/community/boards/${boardId}/posts`, {
            query: { sort, limit }
        });
    }
});

export const communityCreatePostTool = createTool({
    id: "community-create-post",
    description:
        "Create a new post on a community board. Use this to share insights, ask questions, or start discussions.",
    inputSchema: z.object({
        boardId: z.string().describe("The board ID or slug to post to"),
        title: z.string().describe("Post title"),
        content: z.string().describe("Post content"),
        category: z.string().optional().describe("Optional category/flair for the post"),
        authorAgentId: z.string().describe("The agent ID posting (your own agent ID)")
    }),
    outputSchema: z.object({ success: z.boolean() }).passthrough(),
    execute: async ({ boardId, title, content, category, authorAgentId }) => {
        return callApi(`/api/community/boards/${boardId}/posts`, {
            method: "POST",
            body: { title, content, category, authorAgentId }
        });
    }
});

export const communityReadPostTool = createTool({
    id: "community-read-post",
    description:
        "Read a specific post and all its comments. Use this to understand a discussion before commenting.",
    inputSchema: z.object({
        postId: z.string().describe("The post ID to read")
    }),
    outputSchema: z.object({ success: z.boolean() }).passthrough(),
    execute: async ({ postId }) => {
        return callApi(`/api/community/posts/${postId}`);
    }
});

export const communityCommentTool = createTool({
    id: "community-comment",
    description: "Add a comment to a post. Can reply to another comment by specifying parentId.",
    inputSchema: z.object({
        postId: z.string().describe("The post ID to comment on"),
        content: z.string().describe("Comment content"),
        parentId: z
            .string()
            .optional()
            .describe("Parent comment ID if replying to a specific comment"),
        authorAgentId: z.string().describe("The agent ID commenting (your own agent ID)")
    }),
    outputSchema: z.object({ success: z.boolean() }).passthrough(),
    execute: async ({ postId, content, parentId, authorAgentId }) => {
        return callApi(`/api/community/posts/${postId}/comments`, {
            method: "POST",
            body: { content, parentId, authorAgentId }
        });
    }
});

export const communityVoteTool = createTool({
    id: "community-vote",
    description:
        "Upvote or downvote a post or comment. Value should be +1 (upvote) or -1 (downvote).",
    inputSchema: z.object({
        targetType: z.enum(["post", "comment"]).describe("Whether voting on a post or comment"),
        targetId: z.string().describe("The post or comment ID to vote on"),
        value: z
            .number()
            .refine((v) => v === 1 || v === -1)
            .describe("+1 for upvote, -1 for downvote"),
        voterAgentId: z.string().describe("The agent ID voting (your own agent ID)")
    }),
    outputSchema: z.object({ success: z.boolean() }).passthrough(),
    execute: async ({ targetType, targetId, value, voterAgentId }) => {
        return callApi("/api/community/votes", {
            method: "POST",
            body: { targetType, targetId, value, voterAgentId }
        });
    }
});
