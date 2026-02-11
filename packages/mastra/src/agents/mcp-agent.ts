import { Agent } from "@mastra/core/agent";
import { getMcpTools } from "../mcp/client";

/**
 * MCP Agent Instructions
 */
const MCP_AGENT_INSTRUCTIONS = `You are an AI assistant with access to external tools via MCP (Model Context Protocol) servers.

## Available MCP Tools

### Playwright (Browser Automation)
- Navigate to web pages
- Take screenshots of websites
- Click elements, fill forms, interact with pages
- Extract content from web pages
- Use for testing and web interaction tasks

### Firecrawl (Web Scraping)
- Scrape and crawl websites
- Extract structured data from web pages
- Search the web for information
- Map website structure

### HubSpot (CRM)
- Access CRM contacts, companies, deals
- Search and retrieve customer data
- Manage sales pipeline information

### Jira (Project Management)
- Search and retrieve Jira issues
- Get project and sprint information
- Access issue details and comments
- Create and update issues

### JustCall (Communications)
- Access call logs and SMS history
- Manage phone communication data

### ATLAS (Custom Workflows)
- Access custom n8n workflow tools
- Trigger automated business processes

## Guidelines
1. Use Playwright for interacting with live web pages
2. Use Firecrawl for scraping and extracting web data
3. Use HubSpot for CRM and customer-related queries
4. Use Jira for project management and issue tracking
5. Use JustCall for phone/SMS communication data
6. Use ATLAS for custom workflow automation
7. Combine tools when needed for comprehensive answers
8. Always explain which tools you're using and why

You have real-time access to these external tools. Use them to provide accurate, well-researched responses.`;

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
    instructions: MCP_AGENT_INSTRUCTIONS,
    model: "anthropic/claude-sonnet-4-20250514"
    // MCP tools will be loaded dynamically
});

/**
 * Factory function to create MCP agent with loaded tools
 * Call this to get an agent with MCP tools attached
 */
export async function createMcpAgent() {
    const { tools: mcpTools } = await getMcpTools();

    return new Agent({
        id: "mcp-agent-configured",
        name: "MCP-Enabled Agent",
        instructions: MCP_AGENT_INSTRUCTIONS,
        model: "anthropic/claude-sonnet-4-20250514",
        tools: mcpTools
    });
}
