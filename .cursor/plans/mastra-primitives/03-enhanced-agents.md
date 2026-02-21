# Phase 3: Create Enhanced Agents

## Objective

Create multiple specialized agents demonstrating different Mastra agent capabilities: structured output, vision analysis, and multi-step research with tool usage.

## Documentation References

| Feature               | Source      | URL                                                       |
| --------------------- | ----------- | --------------------------------------------------------- |
| Agent Overview        | Mastra Docs | https://mastra.ai/docs/agents/overview                    |
| Structured Output     | Mastra Docs | https://mastra.ai/docs/agents/structured-output           |
| Image Analysis        | Mastra Docs | https://mastra.ai/docs/agents/overview#analyzing-images   |
| maxSteps Usage        | Mastra Docs | https://mastra.ai/docs/agents/overview#using-maxsteps     |
| onStepFinish Callback | Mastra Docs | https://mastra.ai/docs/agents/overview#using-onstepfinish |
| Using Tools           | Mastra Docs | https://mastra.ai/docs/agents/using-tools                 |
| Agent Reference       | Mastra Docs | https://mastra.ai/reference/agents/agent                  |

## Implementation Steps

### Step 1: Create Structured Output Agent

Create `packages/agentc2/src/agents/structured.ts`:

```typescript
import { Agent } from "@mastra/core/agent";
import { z } from "zod";

/**
 * Structured Output Agent
 *
 * Returns typed JSON objects instead of plain text.
 * Useful for API responses, data extraction, and programmatic processing.
 */
export const structuredAgent = new Agent({
    id: "structured-output",
    name: "Structured Output Agent",
    instructions: `You are a data extraction specialist. When given text or questions:
1. Extract structured information
2. Organize it into the requested format
3. Be precise and complete

Always provide accurate, well-structured responses.`,
    model: "anthropic/claude-sonnet-4-20250514"
});

/**
 * Common output schemas for demonstration
 */
export const schemas = {
    taskBreakdown: z.object({
        title: z.string().describe("Task title"),
        steps: z.array(
            z.object({
                order: z.number(),
                description: z.string(),
                estimatedMinutes: z.number().optional(),
                dependencies: z.array(z.string()).optional()
            })
        ),
        totalEstimatedTime: z.string().optional(),
        difficulty: z.enum(["easy", "medium", "hard"])
    }),

    entityExtraction: z.object({
        people: z.array(
            z.object({
                name: z.string(),
                role: z.string().optional()
            })
        ),
        organizations: z.array(z.string()),
        locations: z.array(z.string()),
        dates: z.array(z.string()),
        topics: z.array(z.string())
    }),

    sentimentAnalysis: z.object({
        overall: z.enum(["positive", "negative", "neutral", "mixed"]),
        confidence: z.number().min(0).max(1),
        aspects: z.array(
            z.object({
                topic: z.string(),
                sentiment: z.enum(["positive", "negative", "neutral"]),
                keywords: z.array(z.string())
            })
        ),
        summary: z.string()
    })
};
```

- Doc reference: https://mastra.ai/docs/agents/structured-output

### Step 2: Create Vision Agent

Create `packages/agentc2/src/agents/vision.ts`:

```typescript
import { Agent } from "@mastra/core/agent";
import { z } from "zod";

/**
 * Vision Agent
 *
 * Analyzes images and extracts information.
 * Supports image URLs and base64-encoded images.
 */
export const visionAgent = new Agent({
    id: "vision-analyst",
    name: "Vision Analyst",
    instructions: `You are an expert image analyst. When shown an image:

1. Describe what you see in detail
2. Identify key objects, people, text, and elements
3. Note colors, composition, and style
4. Extract any text visible in the image
5. Provide relevant context or insights

Be thorough but concise. Structure your analysis clearly.`,
    model: "anthropic/claude-sonnet-4-20250514"
});

/**
 * Vision analysis output schema
 */
export const visionAnalysisSchema = z.object({
    description: z.string().describe("Overall description of the image"),
    objects: z.array(
        z.object({
            name: z.string(),
            confidence: z.enum(["high", "medium", "low"]),
            location: z.string().optional().describe("Where in the image")
        })
    ),
    text: z.array(z.string()).describe("Any text visible in the image"),
    colors: z.array(z.string()).describe("Dominant colors"),
    mood: z.string().optional().describe("Overall mood or atmosphere"),
    tags: z.array(z.string()).describe("Relevant tags for the image")
});
```

- Doc reference: https://mastra.ai/docs/agents/overview#analyzing-images

### Step 3: Create Research Agent

Create `packages/agentc2/src/agents/research.ts`:

```typescript
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
```

- Doc reference: https://mastra.ai/docs/agents/overview#using-maxsteps

### Step 4: Update Agent Exports

Update `packages/agentc2/src/agents/index.ts`:

```typescript
export { assistantAgent } from "./assistant";
export { structuredAgent, schemas } from "./structured";
export { visionAgent, visionAnalysisSchema } from "./vision";
export { researchAgent, researchTools } from "./research";
```

### Step 5: Update Mastra Instance

Update `packages/agentc2/src/mastra.ts` to register new agents:

```typescript
import { assistantAgent, structuredAgent, visionAgent, researchAgent } from "./agents";

// In getMastra():
global.mastraInstance = new Mastra({
    agents: {
        assistant: assistantAgent,
        structured: structuredAgent,
        vision: visionAgent,
        research: researchAgent
    }
    // ... rest of config
});
```

## Documentation Deviations

| Deviation                              | Status            | Justification                                               |
| -------------------------------------- | ----------------- | ----------------------------------------------------------- |
| Using simulated web search tool        | **Experimental**  | Real search API (Tavily, Serper) recommended for production |
| Schemas exported separately from agent | **Valid pattern** | Allows reuse of schemas across different agents             |

## Demo Page Spec

- **Route**: `/demos/agents`
- **Inputs**:
    - Agent type selector (tabs: Structured, Vision, Research)
    - Text input for structured output prompts
    - Image URL or file upload for vision analysis
    - Research query input with maxSteps control
- **Outputs**:
    - JSON viewer for structured output
    - Formatted image analysis results
    - Step-by-step research progress log
    - Tool call history display
- **Sample data**:
    - Structured: "Break down the task: Build a website"
    - Vision: Sample image URL (https://placebear.com/cache/395-205.jpg)
    - Research: "What are the benefits of TypeScript?"

### Sample Inputs/Test Data

```typescript
// Structured Output Demo
const structuredExamples = [
  {
    prompt: "Break down the task: Build a website",
    schema: "taskBreakdown",
    expected: { title: "Build a website", steps: [...], difficulty: "medium" }
  },
  {
    prompt: "Extract entities from: Apple CEO Tim Cook announced new products in San Francisco on March 15.",
    schema: "entityExtraction",
    expected: { people: [{ name: "Tim Cook", role: "CEO" }], organizations: ["Apple"], ... }
  }
];

// Vision Demo
const visionExamples = [
  {
    imageUrl: "https://placebear.com/cache/395-205.jpg",
    question: "Describe this image in detail",
  }
];

// Research Demo
const researchExamples = [
  {
    query: "What are the benefits of TypeScript?",
    maxSteps: 5,
  }
];
```

### Error State Handling

- Display schema validation errors for structured output
- Show "Image not found" for invalid URLs
- Display "Max steps reached" when research agent hits limit
- Handle API rate limits gracefully

### Loading States

- Skeleton loader for response areas
- Step progress indicator for research agent
- Image loading placeholder for vision agent

## Dependency Map

- **Requires**: None (agents are standalone primitives)
- **Enables**: Phase 4 (tools can be used by agents), Phase 7 (agents can have scorers)
- **Standalone**: Yes - can be demoed independently

## Acceptance Criteria

- [ ] User can send text to structured agent and receive typed JSON response
- [ ] Structured output matches Zod schema (no validation errors)
- [ ] User can upload/provide image URL and receive analysis from vision agent
- [ ] Vision agent correctly identifies objects, text, and colors in images
- [ ] Research agent makes multiple tool calls in a single query
- [ ] onStepFinish callback fires for each research step
- [ ] maxSteps limit is respected (agent stops after N steps)
- [ ] All three agents are registered and accessible via mastra.getAgent()

## Test Plan

### Frontend

- [ ] Agent selector tabs switch between agents correctly
- [ ] Structured output renders as formatted JSON
- [ ] Vision agent accepts image URL and file upload
- [ ] Research progress shows step-by-step updates
- [ ] Tool calls display in expandable panels
- [ ] Error messages display for invalid inputs
- [ ] Responsive on mobile/desktop

### Backend

- [ ] `/api/demos/agents/structured` returns valid JSON matching schema
- [ ] `/api/demos/agents/vision` accepts multipart form or URL
- [ ] `/api/demos/agents/research` supports maxSteps parameter
- [ ] Invalid schema name returns 400 error
- [ ] Missing image returns 400 error
- [ ] Token usage tracked in response metadata

### Integration

- [ ] End-to-end structured output: prompt → agent → validated JSON
- [ ] Vision analysis works with various image formats (jpg, png, webp)
- [ ] Research agent completes multi-step query with tool calls
- [ ] All agents respect authentication requirements
- [ ] Traces generated for each agent interaction (requires Phase 2)

## Usage Examples

### Structured Output

```typescript
const response = await structuredAgent.generate(
    "Extract entities from: Apple CEO Tim Cook announced new products in San Francisco on March 15.",
    {
        structuredOutput: {
            schema: schemas.entityExtraction
        }
    }
);
console.log(response.object);
// { people: [{ name: "Tim Cook", role: "CEO" }], organizations: ["Apple"], ... }
```

### Vision Analysis

```typescript
const response = await visionAgent.generate([
    {
        role: "user",
        content: [
            { type: "image", image: imageUrl, mimeType: "image/jpeg" },
            { type: "text", text: "Describe this image in detail" }
        ]
    }
]);
```

### Research with Steps

```typescript
const response = await researchAgent.generate("What are the benefits of TypeScript?", {
    maxSteps: 5,
    onStepFinish: (step) => console.log("Step:", step.finishReason)
});
```

## Files Changed

| File                                        | Action |
| ------------------------------------------- | ------ |
| `packages/agentc2/src/agents/structured.ts` | Create |
| `packages/agentc2/src/agents/vision.ts`     | Create |
| `packages/agentc2/src/agents/research.ts`   | Create |
| `packages/agentc2/src/agents/index.ts`      | Update |
| `packages/agentc2/src/mastra.ts`            | Update |
| `packages/agentc2/src/index.ts`             | Update |
