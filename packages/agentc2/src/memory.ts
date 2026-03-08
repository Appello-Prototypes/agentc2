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
                generateTitle: true,
                lastMessages: 10,
                workingMemory: {
                    enabled: true,
                    template: `# User Information
- **First Name**:
- **Last Name**:
- **Location**:
- **Occupation**:
- **Interests**:
- **Goals**:
- **Events**:
- **Facts**:
- **Projects**:`
                },
                semanticRecall: {
                    topK: 2,
                    messageRange: 1,
                    scope: "resource"
                }
            }
        });
    }

    return global.mastraMemory;
}

function createMemoryProxy(): Memory {
    return new Proxy({} as Memory, {
        get(_target, prop) {
            const memory = getMemory();
            const value = memory[prop as keyof Memory];
            return typeof value === "function" ? value.bind(memory) : value;
        }
    });
}

export const memory = createMemoryProxy();
