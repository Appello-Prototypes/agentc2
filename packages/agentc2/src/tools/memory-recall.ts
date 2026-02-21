import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { memory } from "../memory";

/**
 * Memory Recall Tool
 *
 * Explicitly searches conversation history using semantic similarity.
 * Requires memory to be configured with semantic recall enabled.
 *
 * The resourceId parameter is critical for tenant isolation -- it ensures
 * the recall is scoped to the current user's org-prefixed resource.
 */
export const memoryRecallTool = createTool({
    id: "memory-recall",
    description:
        "Search through conversation history to find relevant past messages. Use when you need to recall specific information from previous conversations.",
    inputSchema: z.object({
        query: z.string().describe("What to search for in memory"),
        threadId: z.string().optional().default("default").describe("Thread to search in"),
        resourceId: z
            .string()
            .optional()
            .describe("Resource ID for scoped recall (auto-populated by the system)"),
        organizationId: z
            .string()
            .optional()
            .describe("Organization ID for tenant scoping (auto-injected)"),
        topK: z.number().optional().default(5).describe("Number of results to return")
    }),
    outputSchema: z.object({
        found: z.boolean(),
        results: z.array(
            z.object({
                content: z.string(),
                role: z.string(),
                similarity: z.number().optional()
            })
        ),
        searchQuery: z.string()
    }),
    execute: async ({ query, threadId = "default", resourceId, organizationId, topK = 5 }) => {
        try {
            const effectiveThreadId =
                organizationId && !threadId.includes(":")
                    ? `${organizationId}:${threadId}`
                    : threadId;
            const { messages } = await memory.recall({
                threadId: effectiveThreadId,
                vectorSearchString: query,
                ...(resourceId ? { resourceId } : {})
            });

            return {
                found: messages.length > 0,
                results: messages
                    .slice(0, topK)
                    .map((msg: { content: unknown; role: string; similarity?: number }) => ({
                        content:
                            typeof msg.content === "string"
                                ? msg.content
                                : JSON.stringify(msg.content),
                        role: msg.role,
                        similarity: msg.similarity
                    })),
                searchQuery: query
            };
        } catch (error) {
            console.error("[Memory Recall] Error:", error);
            return {
                found: false,
                results: [],
                searchQuery: query
            };
        }
    }
});

/**
 * Factory to create a memory recall tool pre-scoped to a specific resourceId.
 * Use this when the agent resolver constructs tools per-request.
 */
export function createScopedMemoryRecallTool(scopedResourceId: string) {
    return createTool({
        id: "memory-recall",
        description:
            "Search through conversation history to find relevant past messages. Use when you need to recall specific information from previous conversations.",
        inputSchema: z.object({
            query: z.string().describe("What to search for in memory"),
            threadId: z.string().optional().default("default").describe("Thread to search in"),
            topK: z.number().optional().default(5).describe("Number of results to return")
        }),
        outputSchema: z.object({
            found: z.boolean(),
            results: z.array(
                z.object({
                    content: z.string(),
                    role: z.string(),
                    similarity: z.number().optional()
                })
            ),
            searchQuery: z.string()
        }),
        execute: async ({ query, threadId = "default", topK = 5 }) => {
            try {
                const { messages } = await memory.recall({
                    threadId,
                    vectorSearchString: query,
                    resourceId: scopedResourceId
                });

                return {
                    found: messages.length > 0,
                    results: messages
                        .slice(0, topK)
                        .map((msg: { content: unknown; role: string; similarity?: number }) => ({
                            content:
                                typeof msg.content === "string"
                                    ? msg.content
                                    : JSON.stringify(msg.content),
                            role: msg.role,
                            similarity: msg.similarity
                        })),
                    searchQuery: query
                };
            } catch (error) {
                console.error("[Memory Recall] Error:", error);
                return {
                    found: false,
                    results: [],
                    searchQuery: query
                };
            }
        }
    });
}
