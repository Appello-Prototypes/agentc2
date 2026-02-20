import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Web search tool (simulated for demo)
 */
const webSearchTool = createTool({
    id: "web-search",
    description: "Search the web for information. Use for current events, facts, or research.",
    inputSchema: z.object({
        query: z.string().describe("Search query"),
        maxResults: z.number().optional().default(5)
    }),
    outputSchema: z.object({
        results: z.array(
            z.object({
                title: z.string(),
                snippet: z.string(),
                url: z.string()
            })
        )
    }),
    execute: async ({ query, maxResults = 5 }) => {
        // Simulated search results for demo
        return {
            results: [
                {
                    title: `Result for: ${query}`,
                    snippet: `This is a simulated search result for "${query}". Connect a real search API for production use.`,
                    url: `https://example.com/search?q=${encodeURIComponent(query)}`
                }
            ]
        };
    }
});

/**
 * Note-taking tool for research
 */
const noteTool = createTool({
    id: "take-note",
    description: "Save a research note or finding for later synthesis.",
    inputSchema: z.object({
        topic: z.string(),
        content: z.string(),
        source: z.string().optional(),
        importance: z.enum(["high", "medium", "low"]).optional()
    }),
    outputSchema: z.object({
        saved: z.boolean(),
        noteId: z.string()
    }),
    execute: async ({ topic, content }) => {
        const noteId = `note_${Date.now()}`;
        console.log(`[Research Note] ${topic}: ${content.substring(0, 50)}...`);
        return { saved: true, noteId };
    }
});

/**
 * Research Agent
 *
 * Demonstrates:
 * - Multi-step reasoning with maxSteps
 * - Multiple tool usage
 * - Step-by-step progress tracking with onStepFinish
 */
export const researchAgent = new Agent({
    id: "research-assistant",
    name: "Research Assistant",
    instructions: `You are a thorough research assistant. Your process:

1. **Understand**: Clarify the research question
2. **Search**: Use web search to find relevant information
3. **Note**: Save important findings using the note tool
4. **Synthesize**: Combine findings into a coherent response
5. **Cite**: Reference sources when possible

Be systematic. Use multiple searches if needed. Take notes on key findings.
After gathering information, provide a comprehensive answer.`,
    model: "anthropic/claude-sonnet-4-20250514",
    tools: {
        webSearch: webSearchTool,
        takeNote: noteTool
    }
});

export const researchTools = { webSearchTool, noteTool };
