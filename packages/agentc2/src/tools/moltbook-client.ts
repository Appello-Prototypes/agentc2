/**
 * MoltBook Client Tools
 *
 * Wraps the MoltBook REST API so AgentC2 agents can participate
 * in the MoltBook agent social network — registering, posting,
 * commenting, voting, and browsing the agent-native internet.
 *
 * API Reference: https://www.moltbook.com/api/v1
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { resolveMoltBookToken, moltbookRequest } from "./moltbook-helpers";

/* ─── Agent Management ──────────────────────────────────────────────────── */

export const moltbookRegisterAgentTool = createTool({
    id: "moltbook-register-agent",
    description:
        "Register a new agent on MoltBook. Returns the API key and claim URL. " +
        "IMPORTANT: Save the returned api_key — it cannot be retrieved later.",
    inputSchema: z.object({
        name: z
            .string()
            .describe("Agent display name on MoltBook (must be unique across the platform)"),
        description: z
            .string()
            .describe("Short description of the agent's purpose and capabilities")
    }),
    outputSchema: z.object({
        agent: z.object({
            api_key: z.string(),
            claim_url: z.string(),
            verification_code: z.string()
        })
    }),
    execute: async ({ name, description }) => {
        return moltbookRequest("/agents/register", "", {
            method: "POST",
            body: { name, description }
        });
    }
});

export const moltbookGetProfileTool = createTool({
    id: "moltbook-get-profile",
    description:
        "Get the current agent's MoltBook profile including karma, post count, and comment count.",
    inputSchema: z.object({
        organizationId: z.string().optional().describe("Organization ID for credential lookup")
    }),
    outputSchema: z.object({}).passthrough(),
    execute: async ({ organizationId }) => {
        const token = await resolveMoltBookToken(organizationId);
        return moltbookRequest("/agents/me", token);
    }
});

export const moltbookUpdateProfileTool = createTool({
    id: "moltbook-update-profile",
    description: "Update the current agent's MoltBook profile description.",
    inputSchema: z.object({
        description: z.string().describe("Updated agent description"),
        organizationId: z.string().optional().describe("Organization ID for credential lookup")
    }),
    outputSchema: z.object({}).passthrough(),
    execute: async ({ description, organizationId }) => {
        const token = await resolveMoltBookToken(organizationId);
        return moltbookRequest("/agents/me", token, {
            method: "PATCH",
            body: { description }
        });
    }
});

export const moltbookViewAgentTool = createTool({
    id: "moltbook-view-agent",
    description:
        "View another agent's MoltBook profile by name. Useful for discovering agents and checking their reputation (karma).",
    inputSchema: z.object({
        name: z.string().describe("The agent name to look up"),
        organizationId: z.string().optional().describe("Organization ID for credential lookup")
    }),
    outputSchema: z.object({}).passthrough(),
    execute: async ({ name, organizationId }) => {
        const token = await resolveMoltBookToken(organizationId);
        return moltbookRequest("/agents/profile", token, {
            query: { name }
        });
    }
});

/* ─── Posts ──────────────────────────────────────────────────────────────── */

export const moltbookCreatePostTool = createTool({
    id: "moltbook-create-post",
    description:
        "Create a new post on MoltBook. Can be a text post (with content) or a link post " +
        "(with url). Posts must be submitted to a submolt (community). " +
        "Rate limit: 1 post per 30 minutes.",
    inputSchema: z.object({
        submolt: z
            .string()
            .describe("Submolt (community) name to post in, e.g. 'general', 'aithoughts'"),
        title: z.string().describe("Post title"),
        content: z
            .string()
            .optional()
            .describe("Post body text (for text posts). Supports Markdown."),
        url: z.string().optional().describe("URL to share (for link posts)"),
        organizationId: z.string().optional().describe("Organization ID for credential lookup")
    }),
    outputSchema: z.object({}).passthrough(),
    execute: async ({ submolt, title, content, url, organizationId }) => {
        const token = await resolveMoltBookToken(organizationId);
        const body: Record<string, unknown> = { submolt, title };
        if (content) body.content = content;
        if (url) body.url = url;
        return moltbookRequest("/posts", token, { method: "POST", body });
    }
});

export const moltbookGetFeedTool = createTool({
    id: "moltbook-get-feed",
    description:
        "Browse the MoltBook feed. Returns posts sorted by the chosen algorithm. " +
        "Use 'hot' for trending, 'new' for latest, 'top' for highest-voted, 'rising' for gaining traction.",
    inputSchema: z.object({
        sort: z
            .enum(["hot", "new", "top", "rising"])
            .default("hot")
            .describe("Feed sort algorithm"),
        limit: z.number().min(1).max(100).default(25).describe("Number of posts to return"),
        organizationId: z.string().optional().describe("Organization ID for credential lookup")
    }),
    outputSchema: z.object({}).passthrough(),
    execute: async ({ sort, limit, organizationId }) => {
        const token = await resolveMoltBookToken(organizationId);
        return moltbookRequest("/posts", token, {
            query: { sort, limit }
        });
    }
});

export const moltbookGetPersonalizedFeedTool = createTool({
    id: "moltbook-get-personalized-feed",
    description:
        "Get the agent's personalized MoltBook feed based on subscribed submolts and followed agents.",
    inputSchema: z.object({
        sort: z
            .enum(["hot", "new", "top", "rising"])
            .default("hot")
            .describe("Feed sort algorithm"),
        limit: z.number().min(1).max(100).default(25).describe("Number of posts to return"),
        organizationId: z.string().optional().describe("Organization ID for credential lookup")
    }),
    outputSchema: z.object({}).passthrough(),
    execute: async ({ sort, limit, organizationId }) => {
        const token = await resolveMoltBookToken(organizationId);
        return moltbookRequest("/feed", token, {
            query: { sort, limit }
        });
    }
});

export const moltbookGetPostTool = createTool({
    id: "moltbook-get-post",
    description: "Get a single MoltBook post by ID, including its full content and vote score.",
    inputSchema: z.object({
        postId: z.string().describe("The post ID to retrieve"),
        organizationId: z.string().optional().describe("Organization ID for credential lookup")
    }),
    outputSchema: z.object({}).passthrough(),
    execute: async ({ postId, organizationId }) => {
        const token = await resolveMoltBookToken(organizationId);
        return moltbookRequest(`/posts/${postId}`, token);
    }
});

export const moltbookDeletePostTool = createTool({
    id: "moltbook-delete-post",
    description: "Delete one of the agent's own posts from MoltBook.",
    inputSchema: z.object({
        postId: z.string().describe("The post ID to delete"),
        organizationId: z.string().optional().describe("Organization ID for credential lookup")
    }),
    outputSchema: z.object({}).passthrough(),
    execute: async ({ postId, organizationId }) => {
        const token = await resolveMoltBookToken(organizationId);
        return moltbookRequest(`/posts/${postId}`, token, { method: "DELETE" });
    }
});

/* ─── Comments ──────────────────────────────────────────────────────────── */

export const moltbookCommentTool = createTool({
    id: "moltbook-comment",
    description:
        "Add a comment on a MoltBook post. Supports nested replies via parent_id. " +
        "Rate limit: 50 comments per hour.",
    inputSchema: z.object({
        postId: z.string().describe("The post ID to comment on"),
        content: z.string().describe("Comment text (Markdown supported)"),
        parentId: z
            .string()
            .optional()
            .describe("Parent comment ID to reply to (for nested threads)"),
        organizationId: z.string().optional().describe("Organization ID for credential lookup")
    }),
    outputSchema: z.object({}).passthrough(),
    execute: async ({ postId, content, parentId, organizationId }) => {
        const token = await resolveMoltBookToken(organizationId);
        const body: Record<string, unknown> = { content };
        if (parentId) body.parent_id = parentId;
        return moltbookRequest(`/posts/${postId}/comments`, token, {
            method: "POST",
            body
        });
    }
});

export const moltbookGetCommentsTool = createTool({
    id: "moltbook-get-comments",
    description:
        "Get comments on a MoltBook post. Sort by 'top' (highest-voted), 'new' (latest), or 'controversial'.",
    inputSchema: z.object({
        postId: z.string().describe("The post ID to get comments for"),
        sort: z.enum(["top", "new", "controversial"]).default("top").describe("Comment sort order"),
        organizationId: z.string().optional().describe("Organization ID for credential lookup")
    }),
    outputSchema: z.object({}).passthrough(),
    execute: async ({ postId, sort, organizationId }) => {
        const token = await resolveMoltBookToken(organizationId);
        return moltbookRequest(`/posts/${postId}/comments`, token, {
            query: { sort }
        });
    }
});

/* ─── Voting ────────────────────────────────────────────────────────────── */

export const moltbookVotePostTool = createTool({
    id: "moltbook-vote-post",
    description:
        "Upvote or downvote a MoltBook post. Votes affect the post's score and the author's karma.",
    inputSchema: z.object({
        postId: z.string().describe("The post ID to vote on"),
        direction: z.enum(["upvote", "downvote"]).describe("Vote direction"),
        organizationId: z.string().optional().describe("Organization ID for credential lookup")
    }),
    outputSchema: z.object({}).passthrough(),
    execute: async ({ postId, direction, organizationId }) => {
        const token = await resolveMoltBookToken(organizationId);
        return moltbookRequest(`/posts/${postId}/${direction}`, token, {
            method: "POST"
        });
    }
});

export const moltbookVoteCommentTool = createTool({
    id: "moltbook-vote-comment",
    description: "Upvote a MoltBook comment.",
    inputSchema: z.object({
        commentId: z.string().describe("The comment ID to upvote"),
        organizationId: z.string().optional().describe("Organization ID for credential lookup")
    }),
    outputSchema: z.object({}).passthrough(),
    execute: async ({ commentId, organizationId }) => {
        const token = await resolveMoltBookToken(organizationId);
        return moltbookRequest(`/comments/${commentId}/upvote`, token, {
            method: "POST"
        });
    }
});

/* ─── Submolts (Communities) ────────────────────────────────────────────── */

export const moltbookListSubmoltsTool = createTool({
    id: "moltbook-list-submolts",
    description:
        "List available MoltBook submolts (communities). Useful for discovering where to post and which communities to join.",
    inputSchema: z.object({
        organizationId: z.string().optional().describe("Organization ID for credential lookup")
    }),
    outputSchema: z.object({}).passthrough(),
    execute: async ({ organizationId }) => {
        const token = await resolveMoltBookToken(organizationId);
        return moltbookRequest("/submolts", token);
    }
});

export const moltbookGetSubmoltTool = createTool({
    id: "moltbook-get-submolt",
    description: "Get details about a specific MoltBook submolt (community) by name.",
    inputSchema: z.object({
        name: z.string().describe("Submolt name (e.g. 'general', 'aithoughts')"),
        organizationId: z.string().optional().describe("Organization ID for credential lookup")
    }),
    outputSchema: z.object({}).passthrough(),
    execute: async ({ name, organizationId }) => {
        const token = await resolveMoltBookToken(organizationId);
        return moltbookRequest(`/submolts/${name}`, token);
    }
});

export const moltbookCreateSubmoltTool = createTool({
    id: "moltbook-create-submolt",
    description:
        "Create a new submolt (community) on MoltBook. Use when a topic deserves its own dedicated space.",
    inputSchema: z.object({
        name: z.string().describe("Submolt slug (lowercase, no spaces, e.g. 'agentc2-builders')"),
        displayName: z.string().describe("Human-readable display name"),
        description: z.string().describe("Description of the community's purpose"),
        organizationId: z.string().optional().describe("Organization ID for credential lookup")
    }),
    outputSchema: z.object({}).passthrough(),
    execute: async ({ name, displayName, description, organizationId }) => {
        const token = await resolveMoltBookToken(organizationId);
        return moltbookRequest("/submolts", token, {
            method: "POST",
            body: { name, display_name: displayName, description }
        });
    }
});

export const moltbookSubscribeSubmoltTool = createTool({
    id: "moltbook-subscribe-submolt",
    description:
        "Subscribe to a MoltBook submolt. Posts from subscribed submolts appear in the personalized feed.",
    inputSchema: z.object({
        name: z.string().describe("Submolt name to subscribe to"),
        organizationId: z.string().optional().describe("Organization ID for credential lookup")
    }),
    outputSchema: z.object({}).passthrough(),
    execute: async ({ name, organizationId }) => {
        const token = await resolveMoltBookToken(organizationId);
        return moltbookRequest(`/submolts/${name}/subscribe`, token, {
            method: "POST"
        });
    }
});

export const moltbookUnsubscribeSubmoltTool = createTool({
    id: "moltbook-unsubscribe-submolt",
    description: "Unsubscribe from a MoltBook submolt.",
    inputSchema: z.object({
        name: z.string().describe("Submolt name to unsubscribe from"),
        organizationId: z.string().optional().describe("Organization ID for credential lookup")
    }),
    outputSchema: z.object({}).passthrough(),
    execute: async ({ name, organizationId }) => {
        const token = await resolveMoltBookToken(organizationId);
        return moltbookRequest(`/submolts/${name}/subscribe`, token, {
            method: "DELETE"
        });
    }
});

/* ─── Social (Following) ───────────────────────────────────────────────── */

export const moltbookFollowAgentTool = createTool({
    id: "moltbook-follow-agent",
    description:
        "Follow another agent on MoltBook. Their posts will appear in the personalized feed.",
    inputSchema: z.object({
        name: z.string().describe("Agent name to follow"),
        organizationId: z.string().optional().describe("Organization ID for credential lookup")
    }),
    outputSchema: z.object({}).passthrough(),
    execute: async ({ name, organizationId }) => {
        const token = await resolveMoltBookToken(organizationId);
        return moltbookRequest(`/agents/${name}/follow`, token, {
            method: "POST"
        });
    }
});

export const moltbookUnfollowAgentTool = createTool({
    id: "moltbook-unfollow-agent",
    description: "Unfollow an agent on MoltBook.",
    inputSchema: z.object({
        name: z.string().describe("Agent name to unfollow"),
        organizationId: z.string().optional().describe("Organization ID for credential lookup")
    }),
    outputSchema: z.object({}).passthrough(),
    execute: async ({ name, organizationId }) => {
        const token = await resolveMoltBookToken(organizationId);
        return moltbookRequest(`/agents/${name}/follow`, token, {
            method: "DELETE"
        });
    }
});

/* ─── Search ────────────────────────────────────────────────────────────── */

export const moltbookSearchTool = createTool({
    id: "moltbook-search",
    description:
        "Search across MoltBook for posts, agents, and submolts matching a query. " +
        "Useful for finding relevant conversations, potential collaborators, or communities to join.",
    inputSchema: z.object({
        query: z.string().describe("Search query"),
        limit: z.number().min(1).max(100).default(25).describe("Max results to return"),
        organizationId: z.string().optional().describe("Organization ID for credential lookup")
    }),
    outputSchema: z.object({}).passthrough(),
    execute: async ({ query, limit, organizationId }) => {
        const token = await resolveMoltBookToken(organizationId);
        return moltbookRequest("/search", token, {
            query: { q: query, limit }
        });
    }
});
