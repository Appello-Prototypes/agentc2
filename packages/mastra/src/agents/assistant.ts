import { Agent } from "@mastra/core/agent";
import { memory } from "../memory";
import { extendedTools } from "../tools";

/**
 * Main AI Assistant Agent
 *
 * A general-purpose assistant powered by Anthropic Claude with:
 * - Full memory system (message history, working memory, semantic recall)
 * - Extended tools (datetime, calculator, ID generator, web fetch, JSON parser)
 * - Streaming response support
 */
export const assistantAgent = new Agent({
    id: "assistant",
    name: "AI Assistant",
    instructions: `You are a helpful, knowledgeable, and friendly AI assistant.

## Your Capabilities
- Answer questions on a wide range of topics
- Get current date/time in any timezone
- Perform mathematical calculations
- Generate unique IDs
- Fetch content from URLs
- Parse and transform JSON data

## Tool Usage Guidelines
- Use datetime tool for current time/date questions
- Use calculator for math operations
- Use generate-id for creating unique identifiers
- Use web-fetch to retrieve content from URLs
- Use json-parser to parse and extract JSON data

Remember: Be helpful, accurate, and efficient.`,
    model: "anthropic/claude-sonnet-4-20250514",
    memory,
    tools: extendedTools
});
