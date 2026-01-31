# Phase 8: Setup MCP Client

## Objective

Connect to external MCP (Model Context Protocol) servers to give agents access to external tools like Wikipedia search and sequential thinking.

## Documentation References

| Feature                 | Source      | URL                                                                    |
| ----------------------- | ----------- | ---------------------------------------------------------------------- |
| MCPClient Reference     | Mastra Docs | https://mastra.ai/reference/tools/mcp-client                           |
| MCPClient Configuration | Mastra Docs | https://mastra.ai/reference/tools/mcp-configuration                    |
| MCP Migration Guide     | Mastra Docs | https://mastra.ai/guides/v1/migrations/upgrade-to-v1/mcp               |
| Static Tool Config      | Mastra Docs | https://mastra.ai/reference/tools/mcp-client#static-tool-configuration |
| Dynamic Toolsets        | Mastra Docs | https://mastra.ai/reference/tools/mcp-client#dynamic-toolsets          |
| MCP Specification       | External    | https://modelcontextprotocol.io/specification                          |

## Documentation Corrections

**IMPORTANT**: The original plan is mostly correct. Key points from official documentation:

1. `MCPClient` is imported from `@mastra/mcp`
2. `listTools()` returns tools for Agent definitions (static)
3. `listToolsets()` returns toolsets for dynamic per-request usage
4. Tool names are namespaced as `serverName_toolName`
5. Must call `disconnect()` to clean up resources

## Implementation Steps

### Step 1: Install MCP Package

```bash
cd packages/mastra
bun add @mastra/mcp
```

### Step 2: Create MCP Client Module

Create `packages/mastra/src/mcp/client.ts`:

```typescript
import { MCPClient } from "@mastra/mcp";

declare global {
    var mcpClient: MCPClient | undefined;
}

/**
 * MCP Client Configuration
 *
 * Connects to external MCP servers to provide additional tools.
 * Currently configured:
 * - Wikipedia: Search and retrieve Wikipedia articles
 * - Sequential Thinking: Break down complex reasoning
 */
function getMcpClient(): MCPClient {
    if (!global.mcpClient) {
        global.mcpClient = new MCPClient({
            id: "mastra-mcp-client",
            servers: {
                // Wikipedia MCP Server - Free, no API key required
                wikipedia: {
                    command: "npx",
                    args: ["-y", "wikipedia-mcp"]
                },

                // Sequential Thinking MCP Server (via Smithery)
                sequentialThinking: {
                    command: "npx",
                    args: [
                        "-y",
                        "@smithery/cli@latest",
                        "run",
                        "@smithery-ai/server-sequential-thinking",
                        "--config",
                        "{}"
                    ]
                }
            },
            timeout: 60000 // 60 second timeout
        });
    }

    return global.mcpClient;
}

export const mcpClient = getMcpClient();

/**
 * Get all available MCP tools
 * Use this when configuring an agent with static tools
 */
export async function getMcpTools() {
    return await mcpClient.listTools();
}

/**
 * Get MCP toolsets for dynamic per-request configuration
 * Use this when tools need to vary by request (e.g., different API keys per user)
 */
export async function getMcpToolsets() {
    return await mcpClient.listToolsets();
}

/**
 * Disconnect MCP client
 * Call when shutting down the application
 */
export async function disconnectMcp() {
    await mcpClient.disconnect();
}
```

- Doc reference: https://mastra.ai/reference/tools/mcp-client

### Step 3: Create MCP-Enabled Agent

Create `packages/mastra/src/agents/mcp-agent.ts`:

```typescript
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
```

- Doc reference: https://mastra.ai/reference/tools/mcp-client#static-tool-configuration

### Step 4: Update Agent Exports

Update `packages/mastra/src/agents/index.ts`:

```typescript
export { assistantAgent } from "./assistant";
export { structuredAgent, schemas } from "./structured";
export { visionAgent, visionAnalysisSchema } from "./vision";
export { researchAgent, researchTools } from "./research";
export { evaluatedAgent } from "./evaluated";
export { mcpAgent, createMcpAgent } from "./mcp-agent";
```

### Step 5: Create MCP Exports

Create `packages/mastra/src/mcp/index.ts`:

```typescript
export { mcpClient, getMcpTools, getMcpToolsets, disconnectMcp } from "./client";
```

### Step 6: Update Main Exports

Update `packages/mastra/src/index.ts`:

```typescript
// MCP
export { mcpClient, getMcpTools, getMcpToolsets, disconnectMcp } from "./mcp";
export { mcpAgent, createMcpAgent } from "./agents";
```

### Step 7: Create MCP API Route

Create `apps/agent/src/app/api/mcp/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createMcpAgent } from "@repo/mastra";
import { auth } from "@repo/auth";
import { headers } from "next/headers";

export async function POST(req: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { message } = await req.json();

        if (!message) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        // Create agent with MCP tools loaded
        const agent = await createMcpAgent();

        // Generate response
        const response = await agent.generate(message, {
            maxSteps: 5
        });

        return NextResponse.json({
            text: response.text,
            toolCalls: response.toolCalls
        });
    } catch (error) {
        console.error("MCP agent error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "MCP request failed" },
            { status: 500 }
        );
    }
}
```

## Documentation Deviations

| Deviation                 | Status          | Justification                                    |
| ------------------------- | --------------- | ------------------------------------------------ |
| Using Wikipedia MCP       | **Valid**       | Free, no API key required, good for demos        |
| Using Smithery CLI        | **Valid**       | Official pattern for Smithery-hosted servers     |
| Factory pattern for agent | **Recommended** | Tools must be loaded async before agent creation |

## Demo Page Spec

- **Route**: `/demos/mcp`
- **Inputs**:
    - Query textarea for questions
    - MCP server status indicators
    - Tool usage toggle (verbose mode)
- **Outputs**:
    - Agent response text
    - Tool calls made (which MCP tools were used)
    - Tool inputs/outputs in expandable panels
- **Sample data**:
    - "What is the history of artificial intelligence?"
    - "Tell me about the Mastra AI framework" (may not find if not on Wikipedia)
    - "Break down how to build a web application step by step"

### Sample Inputs/Test Data

```typescript
const mcpExamples = [
    {
        query: "What is the history of artificial intelligence?",
        expectedTool: "wikipedia_search",
        description: "Should search Wikipedia for AI history"
    },
    {
        query: "Who invented the telephone?",
        expectedTool: "wikipedia_get_article",
        description: "Should retrieve Wikipedia article"
    },
    {
        query: "Help me think through the steps to launch a startup",
        expectedTool: "sequentialThinking_think",
        description: "Should use sequential thinking"
    }
];
```

### Error State Handling

- Display "MCP server not responding" for connection failures
- Show "Tool execution failed" with error details
- Handle timeout errors (60s default)
- Graceful fallback if MCP tools unavailable

### Loading States

- Server connection status indicator (connecting/connected/error)
- Tool execution spinner
- Response streaming indicator

## Dependency Map

- **Requires**: None (MCP is standalone)
- **Enables**: External tool access for any agent
- **Standalone**: Yes - can be demoed independently

## Acceptance Criteria

- [ ] MCPClient connects to Wikipedia MCP server
- [ ] MCPClient connects to Sequential Thinking server
- [ ] listTools() returns tools with namespaced names (serverName_toolName)
- [ ] Agent can call Wikipedia search tool
- [ ] Agent can call Wikipedia get_article tool
- [ ] Agent can use sequential thinking tool
- [ ] Tool calls appear in response metadata
- [ ] disconnect() cleans up resources
- [ ] Timeout errors handled gracefully

## Test Plan

### Frontend

- [ ] MCP demo page renders with query input
- [ ] Server status shows connected/disconnected state
- [ ] Response displays after query
- [ ] Tool calls section shows which tools were used
- [ ] Expandable panels show tool inputs/outputs
- [ ] Error messages display for failures
- [ ] Loading states during tool execution

### Backend

- [ ] `/api/mcp` endpoint accepts message
- [ ] Creates MCP agent with tools loaded
- [ ] Returns response with toolCalls array
- [ ] Missing message returns 400 error
- [ ] MCP connection timeout returns 504
- [ ] Tool execution errors return 500 with details

### Integration

- [ ] End-to-end: query → MCP tools → agent response
- [ ] Wikipedia search returns relevant results
- [ ] Sequential thinking produces step-by-step output
- [ ] Multiple tool calls in single query work
- [ ] Authentication required for API endpoint
- [ ] Traces show MCP tool executions (requires Phase 2)

## MCP Server Options

### NPM-based Servers (Stdio transport)

```typescript
{
  wikipedia: {
    command: "npx",
    args: ["-y", "wikipedia-mcp"],
  }
}
```

### HTTP/SSE Servers

```typescript
{
  weather: {
    url: new URL("https://api.example.com/mcp"),
    requestInit: {
      headers: { "Authorization": "Bearer xxx" },
    },
  }
}
```

### Smithery Registry Servers

```typescript
{
  sequential: {
    command: "npx",
    args: [
      "-y",
      "@smithery/cli@latest",
      "run",
      "@smithery-ai/server-sequential-thinking",
      "--config", "{}",
    ],
  }
}
```

## Available MCP Registries

| Registry  | URL              | Description               |
| --------- | ---------------- | ------------------------- |
| Smithery  | smithery.ai      | CLI-based MCP servers     |
| mcp.run   | mcp.run          | Pre-authenticated servers |
| Composio  | mcp.composio.dev | SSE-based servers         |
| Klavis AI | klavis.ai        | Enterprise-grade servers  |

## Troubleshooting

### "Cannot find module 'wikipedia-mcp'"

The MCP server is downloaded on first use via npx. Ensure you have internet access.

### MCP Tools Not Loading

Check that the command paths are correct and npx is available.

### Slow First Request

First request downloads MCP servers. Subsequent requests are faster.

### Connection Timeout

Some MCP servers take time to start. Increase timeout or pre-warm.

## Files Changed

| File                                      | Action          |
| ----------------------------------------- | --------------- |
| `packages/mastra/package.json`            | Add @mastra/mcp |
| `packages/mastra/src/mcp/client.ts`       | Create          |
| `packages/mastra/src/mcp/index.ts`        | Create          |
| `packages/mastra/src/agents/mcp-agent.ts` | Create          |
| `packages/mastra/src/agents/index.ts`     | Update          |
| `packages/mastra/src/index.ts`            | Update          |
| `apps/agent/src/app/api/mcp/route.ts`     | Create          |
