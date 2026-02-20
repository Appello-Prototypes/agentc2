# Mastra Primitives Demo - Master Plan

**Parent Plan**: [mastra_primitives_demo_53f8acc9.plan.md](../../.cursor/plans/mastra_primitives_demo_53f8acc9.plan.md)

## Overview

This folder contains detailed implementation plans for demonstrating all Mastra AI primitives. Each phase has been audited against official documentation and enhanced with demo specifications, dependency mapping, acceptance criteria, and test plans.

**Last Audited**: January 2026  
**Documentation Sources**:

- Mastra Docs (https://mastra.ai/docs) - Primary
- Mastra Guides (https://mastra.ai/guides) - Patterns
- Vercel AI SDK (https://ai-sdk.dev/docs/) - Underlying primitives

## Implementation Order

| Phase | Plan File                                              | Description                                               | Status  | Standalone |
| ----- | ------------------------------------------------------ | --------------------------------------------------------- | ------- | ---------- |
| 1     | [01-semantic-recall.md](./01-semantic-recall.md)       | Enable semantic recall with Supabase pgvector             | Pending | Yes        |
| 2     | [02-observability.md](./02-observability.md)           | Add tracing and observability                             | Pending | Yes        |
| 3     | [03-enhanced-agents.md](./03-enhanced-agents.md)       | Create structured output, vision, and research agents     | Pending | Yes        |
| 4     | [04-advanced-tools.md](./04-advanced-tools.md)         | Add web search, memory recall, and workflow trigger tools | Pending | Partial    |
| 5     | [05-advanced-workflows.md](./05-advanced-workflows.md) | Build parallel, branch, loop, suspend/resume workflows    | Pending | Yes        |
| 6     | [06-rag-pipeline.md](./06-rag-pipeline.md)             | Implement RAG with chunking, embedding, and retrieval     | Pending | Partial    |
| 7     | [07-evals-scorers.md](./07-evals-scorers.md)           | Add relevancy and toxicity scorers                        | Pending | Partial    |
| 8     | [08-mcp-client.md](./08-mcp-client.md)                 | Connect to external MCP servers                           | Pending | Yes        |
| 9     | [09-demo-pages.md](./09-demo-pages.md)                 | Create UI demo pages for each feature                     | Pending | Partial    |
| 10    | [10-voice-agents.md](./10-voice-agents.md)             | Add TTS, STT, and voice chat with OpenAI & ElevenLabs     | Pending | Yes        |

## Documentation Audit Summary

### Corrections Made

| Phase   | Issue                                                 | Correction                                                           |
| ------- | ----------------------------------------------------- | -------------------------------------------------------------------- |
| Phase 2 | Used non-existent `@mastra/observability` package     | Changed to use built-in `telemetry` config in Mastra constructor     |
| Phase 2 | Used `DefaultExporter`, `SensitiveDataFilter` classes | Removed - these don't exist in current API                           |
| Phase 5 | Used `bail()` incorrectly for rejection               | Changed to return result directly; bail is for early exit with error |
| Phase 7 | Incorrect import path for scorers                     | Changed to `@mastra/evals/scorers/prebuilt`                          |

### Experimental/Custom Features

| Phase   | Feature                            | Status                                                |
| ------- | ---------------------------------- | ----------------------------------------------------- |
| Phase 3 | Simulated web search tool          | Connect real API (Tavily, Serper) for production      |
| Phase 4 | Memory recall tool context pattern | Context API may vary; test with actual implementation |
| Phase 7 | Heuristic-based custom scorers     | Consider LLM-graded versions for production           |

## Dependency Graph

```
Phase 1 (Semantic Recall)
    └── Phase 6 (RAG) - Uses vector store
    └── Phase 4 (Memory Recall Tool) - Uses semantic search
    └── Phase 7 (Evals) - Uses embeddings infrastructure

Phase 2 (Observability)
    └── Phase 7 (Trace Scoring) - Requires traces for evaluation

Phase 3 (Enhanced Agents)
    └── Phase 4 (Tools used by agents)
    └── Phase 7 (Scorers on agents)
    └── Phase 10 (Voice Agents) - Adds voice to agents

Phase 5 (Workflows)
    └── Phase 4 (Workflow Trigger Tool)

Phase 8 (MCP) - Standalone

Phase 9 (Demo Pages) - Depends on all phases for full functionality

Phase 10 (Voice Agents) - Standalone (requires OPENAI_API_KEY, ELEVENLABS_API_KEY)
```

## Current Project State

### Existing Implementation (`packages/agentc2/src/`)

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

### Packages to Install (by Phase)

| Phase | Package                    |
| ----- | -------------------------- |
| 6     | `@mastra/rag`              |
| 7     | `@mastra/evals`            |
| 8     | `@mastra/mcp`              |
| 10    | `@mastra/voice-openai`     |
| 10    | `@mastra/voice-elevenlabs` |

### Environment Variables Required

| Variable                      | Phase       | Purpose                      |
| ----------------------------- | ----------- | ---------------------------- |
| `DATABASE_URL`                | All         | PostgreSQL connection        |
| `ANTHROPIC_API_KEY`           | All         | Claude model access          |
| `OPENAI_API_KEY`              | 1, 6, 7, 10 | Embeddings, evals, and voice |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | 2           | Tracing (optional)           |
| `ELEVENLABS_API_KEY`          | 10          | ElevenLabs premium TTS       |

## Architecture

```
packages/agentc2/src/
├── agents/
│   ├── assistant.ts        # Existing
│   ├── structured.ts       # Phase 3
│   ├── vision.ts           # Phase 3
│   ├── research.ts         # Phase 3
│   ├── evaluated.ts        # Phase 7
│   ├── mcp-agent.ts        # Phase 8
│   ├── voice.ts            # Phase 10
│   └── index.ts
├── tools/
│   ├── example-tools.ts    # Existing
│   ├── web-fetch.ts        # Phase 4
│   ├── memory-recall.ts    # Phase 4
│   ├── workflow-trigger.ts # Phase 4
│   ├── json-parser.ts      # Phase 4
│   └── index.ts
├── workflows/
│   ├── example-workflow.ts # Existing
│   ├── parallel.ts         # Phase 5
│   ├── branch.ts           # Phase 5
│   ├── loop.ts             # Phase 5
│   ├── human-approval.ts   # Phase 5
│   └── index.ts
├── rag/
│   ├── pipeline.ts         # Phase 6
│   └── index.ts
├── scorers/
│   └── index.ts            # Phase 7
├── mcp/
│   ├── client.ts           # Phase 8
│   └── index.ts
├── storage.ts              # Existing
├── memory.ts               # Update in Phase 1
├── vector.ts               # Phase 1
├── mastra.ts               # Updates throughout
└── index.ts

apps/agent/src/app/
├── demos/
│   ├── layout.tsx          # Phase 9
│   ├── page.tsx            # Phase 9
│   ├── agents/page.tsx     # Phase 9
│   ├── workflows/page.tsx  # Phase 9
│   ├── memory/page.tsx     # Phase 9
│   ├── rag/page.tsx        # Phase 9
│   ├── evals/page.tsx      # Phase 9
│   ├── mcp/page.tsx        # Phase 9
│   └── voice/page.tsx      # Phase 10
└── api/
    ├── chat/route.ts       # Existing
    ├── workflow/route.ts   # Existing
    ├── rag/
    │   ├── ingest/route.ts # Phase 6
    │   └── query/route.ts  # Phase 6
    ├── mcp/route.ts        # Phase 8
    └── demos/              # Phase 9, 10
        ├── agents/
        ├── workflows/
        ├── memory/
        ├── evals/
        └── voice/          # Phase 10
            ├── tts/route.ts
            ├── stt/route.ts
            └── chat/route.ts
```

## Success Criteria

Each phase should:

1. Be independently testable where marked as "Standalone: Yes"
2. Include working examples with sample inputs
3. Not break existing functionality
4. Have corresponding UI demonstration (Phase 9)
5. Pass all acceptance criteria listed in phase file
6. Pass all tests in the test plan

## Constraints

- Do NOT modify existing working code unless required for the phase
- Preserve backward compatibility with current agent/chat functionality
- If documentation is ambiguous, note it and propose the most common pattern
- Use `@repo/ui` components per project standards
- Follow existing code patterns in the codebase

## Quick Start

1. Review Phase 1 to understand the foundation
2. Check dependency graph above before starting any phase
3. Each phase file contains:
    - Objective (1 sentence)
    - Documentation references (with URLs)
    - Implementation steps (with code)
    - Demo page spec
    - Dependency map
    - Acceptance criteria (binary/testable)
    - Test plan (frontend/backend/integration)
    - Files changed

## Related Resources

- [Mastra Documentation](https://mastra.ai/docs)
- [Mastra GitHub](https://github.com/mastra-ai/mastra)
- [Vercel AI SDK](https://ai-sdk.dev/docs/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
