import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { memory } from "../memory";

/**
 * Memory Recall Tool
 *
 * Explicitly searches conversation history using semantic similarity.
 * Note: Requires memory to be configured with semantic recall enabled.
 */
export const memoryRecallTool = createTool({
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
            // Use the recall method with semantic search
            const { messages } = await memory.recall({
                threadId,
                vectorSearchString: query
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
