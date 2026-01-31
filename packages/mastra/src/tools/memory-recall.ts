import { createTool } from "@mastra/core/tools";
import { z } from "zod";

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
    execute: async ({ query, topK = 5 }, context) => {
        // Access memory from context if available
        const memory = context?.memory;

        if (!memory) {
            console.log(`[Memory Recall] Memory not available in context`);
            return {
                found: false,
                results: [],
                searchQuery: query
            };
        }

        try {
            // Use the recall method with semantic search
            const { messages } = await memory.recall({
                threadId: context?.threadId || "default",
                vectorSearchString: query,
                threadConfig: {
                    semanticRecall: true
                }
            });

            return {
                found: messages.length > 0,
                results: messages.slice(0, topK).map((msg: any) => ({
                    content:
                        typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
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
