import { Memory } from "@mastra/memory";
import { storage } from "./storage";

// Extend global type for Next.js HMR singleton pattern
declare global {
  var mastraMemory: Memory | undefined;
}

/**
 * Memory singleton with full feature set:
 * - Message History: Recent conversation messages
 * - Working Memory: Persistent structured user data
 * - Semantic Recall: Vector search across older conversations
 */
function getMemory(): Memory {
  if (!global.mastraMemory) {
    global.mastraMemory = new Memory({
      storage,
      options: {
        // Automatically generate titles for threads
        generateTitle: true,
        // Number of recent messages to include
        lastMessages: 10,
        // Enable working memory for user context persistence
        workingMemory: {
          enabled: true,
        },
        // Semantic recall is disabled until a vector store is configured
        // To enable, add a vector store (e.g., pgvector, pinecone) and embedder
        // See: https://mastra.ai/docs/memory/semantic-recall
        semanticRecall: false,
      },
    });
  }

  return global.mastraMemory;
}

export const memory = getMemory();
