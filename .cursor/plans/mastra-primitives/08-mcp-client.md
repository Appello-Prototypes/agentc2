# Phase 8: Setup MCP Client

**Status**: Pending  
**Dependencies**: Phases 1-3 (agents must be configured)  
**Estimated Complexity**: Medium

## Objective

Connect to external MCP (Model Context Protocol) servers to give agents access to external tools:
1. **Wikipedia MCP** - Search and retrieve Wikipedia articles
2. **Weather MCP** - Get weather information (via Smithery)

## What is MCP?

The Model Context Protocol (MCP) is an open standard for connecting AI agents to external tools and resources. It serves as a universal plugin system, enabling agents to call tools regardless of language or hosting environment.

**MCPClient** connects to MCP servers to access their tools, resources, and prompts.

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

// Extend global type for Next.js HMR singleton pattern
declare global {
  var mcpClient: MCPClient | undefined;
}

/**
 * MCP Client Configuration
 * 
 * Connects to external MCP servers to provide additional tools.
 * Currently configured:
 * - Wikipedia: Search and retrieve Wikipedia articles
 * - Weather: Get weather information (requires Smithery API key)
 */
function getMcpClient(): MCPClient {
  if (!global.mcpClient) {
    global.mcpClient = new MCPClient({
      id: "mastra-mcp-client",
      servers: {
        // Wikipedia MCP Server - Free, no API key required
        wikipedia: {
          command: "npx",
          args: ["-y", "wikipedia-mcp"],
        },
        
        // Sequential Thinking MCP Server (via Smithery) - Good for reasoning
        sequentialThinking: {
          command: "npx",
          args: [
            "-y",
            "@smithery/cli@latest",
            "run",
            "@smithery-ai/server-sequential-thinking",
            "--config",
            "{}",
          ],
        },
      },
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
  model: "anthropic/claude-sonnet-4-20250514",
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
    tools: mcpTools,
  });
}
```

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
export { 
  mcpClient, 
  getMcpTools, 
  getMcpToolsets, 
  disconnectMcp 
} from "./client";
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
      maxSteps: 5, // Allow multiple tool calls
    });

    return NextResponse.json({
      text: response.text,
      toolCalls: response.toolCalls,
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

## Using Dynamic Toolsets

For multi-tenant applications where different users need different tool configurations:

```typescript
import { MCPClient } from "@mastra/mcp";
import { mastra } from "./mastra";

async function handleRequest(userPrompt: string, userApiKey: string) {
  // Create per-request MCP client with user's API key
  const userMcp = new MCPClient({
    id: "user-mcp",
    servers: {
      weather: {
        url: new URL("http://weather-api.example.com/mcp"),
        requestInit: {
          headers: {
            Authorization: `Bearer ${userApiKey}`,
          },
        },
      },
    },
  });

  const agent = mastra.getAgent("assistant");
  
  // Use toolsets for dynamic per-request tools
  const response = await agent.generate(userPrompt, {
    toolsets: await userMcp.listToolsets(),
  });

  // Clean up
  await userMcp.disconnect();

  return response;
}
```

## MCP Server Options

### NPM-based Servers (command + args)

```typescript
{
  wikipedia: {
    command: "npx",
    args: ["-y", "wikipedia-mcp"],
  }
}
```

### HTTP/SSE Servers (url)

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

| Registry | URL | Description |
|----------|-----|-------------|
| Smithery | smithery.ai | CLI-based MCP servers |
| mcp.run | mcp.run | Pre-authenticated servers |
| Composio | mcp.composio.dev | SSE-based servers |
| Klavis AI | klavis.ai | Enterprise-grade servers |

## Verification Checklist

- [ ] `@mastra/mcp` package installed
- [ ] `client.ts` created with MCPClient configuration
- [ ] `mcp-agent.ts` created with MCP instructions
- [ ] Factory function `createMcpAgent()` works
- [ ] MCP tools load successfully
- [ ] Agent can use Wikipedia tool
- [ ] Agent can use sequential thinking tool
- [ ] API route created and tested

## Testing Examples

### List Available MCP Tools

```typescript
import { getMcpTools } from "@repo/mastra";

const tools = await getMcpTools();
console.log("Available MCP tools:", Object.keys(tools));
```

### Use MCP Agent

```typescript
import { createMcpAgent } from "@repo/mastra";

const agent = await createMcpAgent();
const response = await agent.generate(
  "What is the history of artificial intelligence?",
  { maxSteps: 5 }
);

console.log(response.text);
// Will search Wikipedia and provide a well-researched answer
```

### Use Specific MCP Tool

```typescript
const response = await agent.generate(
  "Using Wikipedia, tell me about the Mastra AI framework",
  { maxSteps: 3 }
);
```

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

| File | Action |
|------|--------|
| `packages/mastra/package.json` | Add @mastra/mcp |
| `packages/mastra/src/mcp/client.ts` | Create |
| `packages/mastra/src/mcp/index.ts` | Create |
| `packages/mastra/src/agents/mcp-agent.ts` | Create |
| `packages/mastra/src/agents/index.ts` | Update |
| `packages/mastra/src/index.ts` | Update |
| `apps/agent/src/app/api/mcp/route.ts` | Create |
