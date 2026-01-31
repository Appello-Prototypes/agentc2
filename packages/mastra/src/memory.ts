import { Memory } from "@mastra/memory";
import { ModelRouterEmbeddingModel } from "@mastra/core/llm";
import { storage } from "./storage";
import { vector } from "./vector";

// Extend global type for Next.js HMR singleton pattern
declare global {
    var mastraMemory: Memory | undefined;
}

/**
 * Memory singleton with full feature set:
 * - Message History: Recent conversation messages
 * - Working Memory: Persistent structured user data
 * - Semantic Recall: Vector search across older conversations
 *
 * Requires OPENAI_API_KEY for embeddings.
 */
function getMemory(): Memory {
    if (!global.mastraMemory) {
        global.mastraMemory = new Memory({
            storage,
            vector,
            embedder: new ModelRouterEmbeddingModel("openai/text-embedding-3-small"),
            options: {
                // Automatically generate titles for threads
                generateTitle: true,
                // Number of recent messages to include
                lastMessages: 10,
                // Enable working memory for user context persistence
                workingMemory: {
                    enabled: true
                },
                // Semantic recall configuration
                semanticRecall: {
                    // Number of semantically similar messages to retrieve
                    topK: 3,
                    // Include N messages before and after each match for context
                    messageRange: 2,
                    // Search across all threads for this user (vs "thread" for current thread only)
                    scope: "resource"
                }
            }
        });
    }

    return global.mastraMemory;
}

export const memory = getMemory();
