import { Agent } from "@mastra/core/agent";
import { getMcpTools } from "../mcp/client";

/**
 * MCP-Enabled Agent
 *
 * Demonstrates using tools from external MCP servers.
 * Has access to:
 * - Wikipedia for knowledge retrieval
 * - Sequential thinking for complex reasoning
 */
export const mcpAgent = new Agent({
    id: "mcp-agent",
    name: "MCP-Enabled Agent",
    instructions: `You are an AI assistant with access to external knowledge sources via MCP servers.

## Available MCP Tools

### Wikipedia
- Search Wikipedia for information on any topic
- Retrieve full article content
- Use for factual information, definitions, historical data

### Sequential Thinking
- Use for complex reasoning tasks
- Helps break down problems step by step
- Good for analysis and decision-making

## Guidelines
1. Use Wikipedia for factual questions and research
2. Use sequential thinking for complex multi-step problems
3. Always cite sources when using Wikipedia
4. Combine tools when needed for comprehensive answers

You have real-time access to these external tools. Use them to provide accurate, well-researched responses.`,
    model: "anthropic/claude-sonnet-4-20250514"
    // MCP tools will be loaded dynamically
});

/**
 * Factory function to create MCP agent with loaded tools
 * Call this to get an agent with MCP tools attached
 */
export async function createMcpAgent() {
    const mcpTools = await getMcpTools();

    return new Agent({
        id: "mcp-agent-configured",
        name: "MCP-Enabled Agent",
        instructions: mcpAgent.instructions,
        model: "anthropic/claude-sonnet-4-20250514",
        tools: mcpTools
    });
}
