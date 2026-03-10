# Create New Tool

**Trigger**: User asks to add a new tool, create a tool, or register a tool for agents to use.

**Description**: Adds a new tool to the AgentC2 tool registry following project conventions.

## Instructions

### Step 1: Understand what the tool does

Get from the user:

- **Name**: Tool identifier (kebab-case, e.g., `weather-lookup`)
- **Description**: What the tool does (this is shown to the LLM)
- **Parameters**: Input schema (Zod)
- **Logic**: What the tool actually executes

### Step 2: Read the existing tool registry

```
Read packages/agentc2/src/tools/registry.ts
```

Understand the registration pattern and existing tools.

### Step 3: Read existing tool implementations

Look at how existing tools are structured:

```
Glob packages/agentc2/src/tools/**/*.ts
```

Read 2-3 existing tools to understand the pattern.

### Step 4: Create the tool

Follow the existing pattern exactly. A tool typically needs:

```typescript
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const myTool = createTool({
    id: "my-tool",
    description: "Clear description of what this tool does and when to use it",
    inputSchema: z.object({
        param1: z.string().describe("Description for the LLM"),
        param2: z.number().optional().describe("Optional parameter")
    }),
    outputSchema: z.object({
        result: z.string()
    }),
    execute: async ({ context }) => {
        // Implementation
        return { result: "..." };
    }
});
```

### Step 5: Register the tool

Add the tool to the registry in `packages/agentc2/src/tools/registry.ts`.

### Step 6: Export the tool

Ensure the tool is exported from the package index.

### Step 7: Type-check and build

```bash
bun run type-check && bun run build
```

### Tool Best Practices

- **Descriptions matter**: The LLM reads the description to decide when to use the tool. Be specific.
- **Parameter descriptions**: Every parameter should have `.describe()` — the LLM needs this context.
- **Error handling**: Return structured errors, don't throw unhandled exceptions.
- **Keep tools focused**: One tool = one capability. Don't make Swiss Army knife tools.
- **Idempotent when possible**: Tools that modify state should be safe to retry.
