# Mastra Primitives Demo - Master Plan

**Parent Plan**: [mastra_primitives_demo_53f8acc9.plan.md](../../.cursor/plans/mastra_primitives_demo_53f8acc9.plan.md)

## Overview

This folder contains detailed implementation plans for demonstrating all Mastra AI primitives. Execute them in order for best results.

## Implementation Order

| Phase | Plan File | Description | Status |
|-------|-----------|-------------|--------|
| 1 | [01-semantic-recall.md](./01-semantic-recall.md) | Enable semantic recall with Supabase pgvector | Pending |
| 2 | [02-observability.md](./02-observability.md) | Add tracing and observability | Pending |
| 3 | [03-enhanced-agents.md](./03-enhanced-agents.md) | Create structured output, vision, and research agents | Pending |
| 4 | [04-advanced-tools.md](./04-advanced-tools.md) | Add web search, memory recall, and workflow trigger tools | Pending |
| 5 | [05-advanced-workflows.md](./05-advanced-workflows.md) | Build parallel, branch, loop, suspend/resume workflows | Pending |
| 6 | [06-rag-pipeline.md](./06-rag-pipeline.md) | Implement RAG with chunking, embedding, and retrieval | Pending |
| 7 | [07-evals-scorers.md](./07-evals-scorers.md) | Add relevancy and toxicity scorers | Pending |
| 8 | [08-mcp-client.md](./08-mcp-client.md) | Connect to external MCP servers | Pending |
| 9 | [09-demo-pages.md](./09-demo-pages.md) | Create UI demo pages for each feature | Pending |

## Current Project State

### Existing Implementation (`packages/mastra/src/`)

- **Agent**: `assistantAgent` - Anthropic Claude with basic tools and working memory
- **Tools**: `dateTimeTool`, `calculatorTool`, `generateIdTool`
- **Workflow**: `analysisWorkflow` - 2 sequential steps
- **Memory**: Message history + working memory (semantic recall disabled)
- **Storage**: Supabase PostgreSQL via `@mastra/pg`

### Package Dependencies Already Installed

```json
{
  "@mastra/core": "latest",
  "@mastra/memory": "latest",
  "@mastra/pg": "latest",
  "zod": "^3.x",
  "@anthropic-ai/sdk": "latest"
}
```

### Environment Variables Available

```
DATABASE_URL=postgresql://...supabase.co:5432/postgres
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Architecture

```
packages/mastra/src/
├── agents/
│   ├── assistant.ts        # Existing
│   ├── structured.ts       # Phase 3
│   ├── vision.ts           # Phase 3
│   └── research.ts         # Phase 3
├── tools/
│   ├── example-tools.ts    # Existing
│   ├── web-search.ts       # Phase 4
│   └── index.ts
├── workflows/
│   ├── example-workflow.ts # Existing
│   ├── parallel.ts         # Phase 5
│   ├── branch.ts           # Phase 5
│   ├── loop.ts             # Phase 5
│   └── human-approval.ts   # Phase 5
├── rag/
│   ├── pipeline.ts         # Phase 6
│   └── index.ts
├── scorers/
│   ├── custom.ts           # Phase 7
│   └── index.ts
├── mcp/
│   └── client.ts           # Phase 8
├── storage.ts              # Existing
├── memory.ts               # Update in Phase 1
├── vector.ts               # Phase 1
├── observability.ts        # Phase 2
├── mastra.ts               # Updates throughout
└── index.ts

apps/agent/src/app/
├── demos/
│   ├── agents/page.tsx     # Phase 9
│   ├── workflows/page.tsx  # Phase 9
│   ├── memory/page.tsx     # Phase 9
│   ├── rag/page.tsx        # Phase 9
│   ├── evals/page.tsx      # Phase 9
│   └── mcp/page.tsx        # Phase 9
└── api/
    ├── chat/route.ts       # Existing
    ├── workflow/route.ts   # Existing
    ├── rag/route.ts        # Phase 6
    └── demos/*/route.ts    # Phase 9
```

## Success Criteria

Each phase should:
1. Be independently testable
2. Include working examples
3. Not break existing functionality
4. Have corresponding UI demonstration (where applicable)
