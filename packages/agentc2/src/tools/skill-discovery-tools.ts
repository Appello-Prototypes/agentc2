/**
 * Skill Discovery Meta-Tools
 *
 * These tools enable progressive tool disclosure via the Dynamic ReAct
 * "Search and Load" pattern. Agents use these meta-tools to discover
 * and activate skills at runtime during their reasoning loop.
 *
 * - search_skills: Search available skills by query (returns descriptions only)
 * - activate_skill: Load a skill's tools for the current conversation
 * - list_active_skills: Show currently activated skills and their tools
 *
 * Reference: Dynamic ReAct (arXiv:2509.20386)
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const baseOutputSchema = z.object({ success: z.boolean().optional() }).passthrough();

const getInternalBaseUrl = () =>
    process.env.MASTRA_API_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

const buildHeaders = () => {
    const headers: Record<string, string> = {
        "Content-Type": "application/json"
    };
    const apiKey = process.env.MASTRA_API_KEY || process.env.MCP_API_KEY;
    if (apiKey) {
        headers["X-API-Key"] = apiKey;
    }
    const orgSlug = process.env.MASTRA_ORGANIZATION_SLUG || process.env.MCP_API_ORGANIZATION_SLUG;
    if (orgSlug) {
        headers["X-Organization-Slug"] = orgSlug;
    }
    return headers;
};

const callInternalApi = async (
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
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, String(value));
            }
        });
    }

    const response = await fetch(url.toString(), {
        method: options?.method ?? "GET",
        headers: buildHeaders(),
        body: options?.body ? JSON.stringify(options.body) : undefined
    });
    const data = await response.json();
    if (!response.ok) {
        const errorMessage =
            (data && typeof data === "object" && "error" in data ? data.error : undefined) ||
            `Request failed (${response.status})`;
        throw new Error(String(errorMessage));
    }
    return data;
};

/**
 * search_skills: Search available skills by natural language queries.
 *
 * Returns skill descriptions (manifests) without loading the tools.
 * The agent reviews results and decides which to activate.
 *
 * Aligned with Dynamic ReAct's search_tools meta-tool pattern.
 */
export const searchSkillsTool = createTool({
    id: "search-skills",
    description:
        "Search available skills by query to find capabilities you need. Returns skill descriptions without loading tools. Use this BEFORE activate-skill to discover what skills are available for a task. Each query should be atomic and specific (e.g., 'CRM contact management', 'create Jira tickets', 'web scraping').",
    inputSchema: z.object({
        queries: z
            .array(z.string())
            .describe(
                "Atomic search queries describing capabilities you need. Each query should focus on a single action or domain."
            )
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ queries }) => {
        // Call the skills search API endpoint
        const result = await callInternalApi("/api/skills/search", {
            method: "POST",
            body: { queries }
        });
        return {
            success: true,
            ...result,
            hint: "Review the skills above. Use activate-skill with the slug(s) of skills you need to load their tools."
        };
    }
});

/**
 * activate_skill: Load a skill's tools into the current conversation.
 *
 * After reviewing search results, the agent selects specific skills to activate.
 * Activated skills persist across conversation turns via ThreadSkillState.
 *
 * Aligned with Dynamic ReAct's load_tools meta-tool pattern.
 */
export const activateSkillTool = createTool({
    id: "activate-skill",
    description:
        "Activate one or more skills to load their tools for this conversation. Tools from activated skills become available on the NEXT message in this conversation. Use search-skills first to find available skills, then activate the ones you need.",
    inputSchema: z.object({
        skillSlugs: z
            .array(z.string())
            .describe("Skill slugs to activate (from search-skills results)."),
        threadId: z
            .string()
            .optional()
            .describe(
                "Thread ID for this conversation. If provided, skill activations persist across turns."
            ),
        agentId: z.string().optional().describe("Agent ID for tracking.")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ skillSlugs, threadId, agentId }) => {
        const result = await callInternalApi("/api/skills/activate", {
            method: "POST",
            body: { skillSlugs, threadId, agentId }
        });
        return {
            success: true,
            ...result,
            hint: "Skills activated. Their tools will be available on the next message in this conversation. For now, you can tell the user what you plan to do and ask them to continue."
        };
    }
});

/**
 * list_active_skills: Show currently activated skills and their tools.
 *
 * Useful for the agent to know what tools it already has access to.
 */
export const listActiveSkillsTool = createTool({
    id: "list-active-skills",
    description:
        "List the skills currently activated for this conversation, including their tools. Use this to check what capabilities are already available before searching for more.",
    inputSchema: z.object({
        threadId: z.string().optional().describe("Thread ID to check activated skills for.")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ threadId }) => {
        if (!threadId) {
            return {
                success: true,
                skills: [],
                message: "No thread ID provided — only pinned skills are available."
            };
        }

        const result = await callInternalApi("/api/skills/active", {
            method: "GET",
            query: { threadId }
        });
        return {
            success: true,
            ...result
        };
    }
});
