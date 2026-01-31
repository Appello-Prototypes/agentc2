# Phase 4: Add Advanced Tools

## Objective

Create additional tools demonstrating various Mastra tool capabilities: web content fetching, memory recall queries, workflow triggering from agents, and JSON parsing.

## Documentation References

| Feature | Source | URL |
|---------|--------|-----|
| Creating Tools | Mastra Docs | https://mastra.ai/docs/agents/using-tools |
| Tool Reference | Mastra Docs | https://mastra.ai/reference/tools/create-tool |
| Tool Context | Mastra Docs | https://mastra.ai/docs/agents/using-tools#tool-context |
| Workflow Execution | Mastra Docs | https://mastra.ai/docs/workflows/overview#running-workflows |
| Memory Recall | Mastra Docs | https://mastra.ai/docs/memory/semantic-recall#using-the-recall-method |

## Implementation Steps

### Step 1: Create Web Fetch Tool

Create `packages/mastra/src/tools/web-fetch.ts`:

```typescript
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Web Fetch Tool
 * 
 * Fetches content from a URL and returns text or structured data.
 */
export const webFetchTool = createTool({
  id: "web-fetch",
  description: "Fetch content from a URL. Returns the text content of the page or API response.",
  inputSchema: z.object({
    url: z.string().url().describe("The URL to fetch"),
    extractText: z.boolean().optional().default(true)
      .describe("Extract plain text from HTML"),
    maxLength: z.number().optional().default(5000)
      .describe("Maximum characters to return"),
  }),
  outputSchema: z.object({
    url: z.string(),
    status: z.number(),
    contentType: z.string(),
    content: z.string(),
    truncated: z.boolean(),
  }),
  execute: async ({ url, extractText = true, maxLength = 5000 }) => {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "MastraBot/1.0 (AI Assistant)",
          "Accept": "text/html,application/json,text/plain",
        },
      });

      const contentType = response.headers.get("content-type") || "text/plain";
      let content = await response.text();

      // Simple HTML text extraction
      if (extractText && contentType.includes("text/html")) {
        content = content
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      }

      const truncated = content.length > maxLength;
      if (truncated) {
        content = content.substring(0, maxLength) + "...";
      }

      return {
        url,
        status: response.status,
        contentType,
        content,
        truncated,
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch URL: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});
```

- Doc reference: https://mastra.ai/docs/agents/using-tools

### Step 2: Create Memory Recall Tool

Create `packages/mastra/src/tools/memory-recall.ts`:

```typescript
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
  description: "Search through conversation history to find relevant past messages. Use when you need to recall specific information from previous conversations.",
  inputSchema: z.object({
    query: z.string().describe("What to search for in memory"),
    topK: z.number().optional().default(5).describe("Number of results to return"),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    results: z.array(z.object({
      content: z.string(),
      role: z.string(),
      similarity: z.number().optional(),
    })),
    searchQuery: z.string(),
  }),
  execute: async ({ query, topK = 5 }, context) => {
    // Access memory from context if available
    const memory = context?.memory;
    
    if (!memory) {
      console.log(`[Memory Recall] Memory not available in context`);
      return {
        found: false,
        results: [],
        searchQuery: query,
      };
    }

    try {
      // Use the recall method with semantic search
      const { messages } = await memory.recall({
        threadId: context?.threadId || "default",
        vectorSearchString: query,
        threadConfig: {
          semanticRecall: true,
        },
      });

      return {
        found: messages.length > 0,
        results: messages.slice(0, topK).map((msg: any) => ({
          content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
          role: msg.role,
          similarity: msg.similarity,
        })),
        searchQuery: query,
      };
    } catch (error) {
      console.error("[Memory Recall] Error:", error);
      return {
        found: false,
        results: [],
        searchQuery: query,
      };
    }
  },
});
```

- Doc reference: https://mastra.ai/docs/memory/semantic-recall#using-the-recall-method

### Step 3: Create Workflow Trigger Tool

Create `packages/mastra/src/tools/workflow-trigger.ts`:

```typescript
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Workflow Trigger Tool
 * 
 * Allows an agent to trigger and execute workflows.
 * Demonstrates agent-workflow integration.
 */
export const workflowTriggerTool = createTool({
  id: "trigger-workflow",
  description: "Trigger a workflow to perform complex multi-step operations. Use for tasks that require structured, multi-step processing.",
  inputSchema: z.object({
    workflowId: z.string().describe("The workflow ID to run"),
    input: z.record(z.any()).describe("Input data for the workflow"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    workflowId: z.string(),
    runId: z.string().optional(),
    status: z.string(),
    result: z.any().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ workflowId, input }, context) => {
    try {
      const mastra = context?.mastra;
      if (!mastra) {
        throw new Error("Mastra context not available");
      }

      const workflow = mastra.getWorkflow(workflowId);
      if (!workflow) {
        throw new Error(`Workflow "${workflowId}" not found`);
      }

      const run = await workflow.createRun();
      const result = await run.start({ inputData: input });

      return {
        success: result.status === "success",
        workflowId,
        runId: run.runId,
        status: result.status,
        result: result.status === "success" ? result.result : undefined,
        error: result.status === "failed" ? result.error?.message : undefined,
      };
    } catch (error) {
      return {
        success: false,
        workflowId,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
```

- Doc reference: https://mastra.ai/docs/workflows/overview#running-workflows

### Step 4: Create JSON Parser Tool

Create `packages/mastra/src/tools/json-parser.ts`:

```typescript
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * JSON Parser Tool
 * 
 * Parses JSON strings and extracts specific fields.
 */
export const jsonParserTool = createTool({
  id: "json-parser",
  description: "Parse a JSON string and optionally extract specific fields using dot notation paths.",
  inputSchema: z.object({
    jsonString: z.string().describe("The JSON string to parse"),
    extractPaths: z.array(z.string()).optional()
      .describe("Optional dot-notation paths to extract (e.g., 'user.name', 'items[0].id')"),
  }),
  outputSchema: z.object({
    parsed: z.any(),
    extracted: z.record(z.any()).optional(),
    type: z.string(),
    keys: z.array(z.string()).optional(),
  }),
  execute: async ({ jsonString, extractPaths }) => {
    try {
      const parsed = JSON.parse(jsonString);
      const type = Array.isArray(parsed) ? "array" : typeof parsed;
      
      let extracted: Record<string, any> | undefined;
      
      if (extractPaths && extractPaths.length > 0) {
        extracted = {};
        for (const path of extractPaths) {
          const value = getNestedValue(parsed, path);
          extracted[path] = value;
        }
      }

      const keys = type === "object" ? Object.keys(parsed) : undefined;

      return {
        parsed,
        extracted,
        type,
        keys,
      };
    } catch (error) {
      throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : "Parse error"}`);
    }
  },
});

function getNestedValue(obj: any, path: string): any {
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".");
  let current = obj;
  
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  
  return current;
}
```

### Step 5: Update Tool Exports

Update `packages/mastra/src/tools/index.ts`:

```typescript
export { dateTimeTool, calculatorTool, generateIdTool } from "./example-tools";
export { webFetchTool } from "./web-fetch";
export { memoryRecallTool } from "./memory-recall";
export { workflowTriggerTool } from "./workflow-trigger";
export { jsonParserTool } from "./json-parser";

import { dateTimeTool, calculatorTool, generateIdTool } from "./example-tools";
import { webFetchTool } from "./web-fetch";
import { jsonParserTool } from "./json-parser";

// Basic tools bundle
export const tools = {
  dateTimeTool,
  calculatorTool,
  generateIdTool,
};

// Extended tools bundle (includes web and parsing)
export const extendedTools = {
  dateTimeTool,
  calculatorTool,
  generateIdTool,
  webFetchTool,
  jsonParserTool,
};
```

### Step 6: Update Assistant Agent with Extended Tools

Update `packages/mastra/src/agents/assistant.ts`:

```typescript
import { Agent } from "@mastra/core/agent";
import { memory } from "../memory";
import { extendedTools } from "../tools";

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
  tools: extendedTools,
});
```

## Documentation Deviations

| Deviation | Status | Justification |
|-----------|--------|---------------|
| Memory recall tool uses context pattern | **Experimental** | The tool context API may vary; test with actual memory instance |
| Workflow trigger uses context.mastra | **Valid** | Context provides access to registered workflows |

## Demo Page Spec

- **Route**: `/demos/tools`
- **Inputs**:
  - Tool selector dropdown
  - Dynamic input form based on tool schema
  - URL input for web fetch
  - JSON input for parser
  - Workflow ID selector for trigger
- **Outputs**:
  - Tool execution result (formatted JSON)
  - Execution time
  - Error messages if applicable
- **Sample data**:
  - Web Fetch: `https://example.com`
  - JSON Parser: `{"user": {"name": "John", "age": 30}}`
  - Memory Recall: "What is my name?"

### Sample Inputs/Test Data

```typescript
// Web Fetch Examples
const webFetchExamples = [
  { url: "https://example.com", extractText: true, maxLength: 1000 },
  { url: "https://api.github.com/repos/mastra-ai/mastra", extractText: false },
];

// JSON Parser Examples
const jsonParserExamples = [
  {
    jsonString: '{"user": {"name": "John", "age": 30}}',
    extractPaths: ["user.name", "user.age"],
    expected: { "user.name": "John", "user.age": 30 }
  },
  {
    jsonString: '[{"id": 1}, {"id": 2}]',
    extractPaths: ["0.id", "1.id"],
    expected: { "0.id": 1, "1.id": 2 }
  }
];

// Workflow Trigger Examples
const workflowTriggerExamples = [
  { workflowId: "analysis-workflow", input: { query: "What is AI?" } }
];
```

### Error State Handling

- Display "Invalid URL" for malformed URLs
- Show "Fetch failed: [error]" for network errors
- Display JSON parse errors with line/column info
- Show "Workflow not found" for invalid workflow IDs
- Handle timeout errors gracefully

### Loading States

- Spinner during tool execution
- Progress indicator for long-running operations
- Skeleton loader for result area

## Dependency Map

- **Requires**: Phase 1 (for memory recall tool), Phase 5 (for workflow trigger)
- **Enables**: Phase 9 (demo pages use tools)
- **Standalone**: Partial - web-fetch and json-parser work independently

## Acceptance Criteria

- [ ] User can fetch content from any public URL via web-fetch tool
- [ ] Web-fetch correctly extracts text from HTML pages
- [ ] User can parse JSON and extract nested values via json-parser
- [ ] Memory recall tool returns semantically similar messages (requires Phase 1)
- [ ] Workflow trigger tool executes registered workflows
- [ ] Tool errors are caught and returned as structured error responses
- [ ] All tools accessible via agent tool calls
- [ ] Extended tools bundle is used by assistant agent

## Test Plan

### Frontend

- [ ] Tool demo page renders tool selector
- [ ] Dynamic form generates inputs based on tool schema
- [ ] Submit button triggers tool execution
- [ ] Results display as formatted JSON
- [ ] Error messages display in red/warning style
- [ ] Loading states show during execution

### Backend

- [ ] Web-fetch successfully retrieves example.com
- [ ] Web-fetch handles 404 and other HTTP errors
- [ ] Web-fetch respects maxLength parameter
- [ ] JSON-parser validates input is valid JSON
- [ ] JSON-parser extracts nested paths correctly
- [ ] Workflow-trigger returns success for valid workflow
- [ ] Workflow-trigger returns error for unknown workflow
- [ ] Memory-recall gracefully handles missing memory context

### Integration

- [ ] Agent uses web-fetch when asked to get URL content
- [ ] Agent uses json-parser when asked to parse JSON
- [ ] Agent uses workflow-trigger when multi-step processing needed
- [ ] Tool calls appear in traces (requires Phase 2)
- [ ] Authentication required for tool API endpoints

## Files Changed

| File | Action |
|------|--------|
| `packages/mastra/src/tools/web-fetch.ts` | Create |
| `packages/mastra/src/tools/memory-recall.ts` | Create |
| `packages/mastra/src/tools/workflow-trigger.ts` | Create |
| `packages/mastra/src/tools/json-parser.ts` | Create |
| `packages/mastra/src/tools/index.ts` | Update |
| `packages/mastra/src/agents/assistant.ts` | Update |
