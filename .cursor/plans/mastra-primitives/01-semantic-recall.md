# Phase 1: Enable Semantic Recall with Supabase pgvector

## Objective

Enable semantic recall in the memory system using Supabase PostgreSQL with pgvector extension, allowing the agent to recall semantically similar messages from past conversations.

## Documentation References

| Feature | Source | URL |
|---------|--------|-----|
| Semantic Recall Overview | Mastra Docs | https://mastra.ai/docs/memory/semantic-recall |
| Memory Configuration | Mastra Docs | https://mastra.ai/docs/memory/overview |
| PgVector Reference | Mastra Docs | https://mastra.ai/reference/vectors/pg |
| Embedder Configuration | Mastra Docs | https://mastra.ai/docs/memory/semantic-recall#embedder-configuration |
| Storage Configuration | Mastra Docs | https://mastra.ai/docs/memory/storage |

## Implementation Steps

### Step 1: Enable pgvector Extension in Supabase

Run this SQL in Supabase SQL Editor:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify it's enabled
SELECT * FROM pg_extension WHERE extname = 'vector';
```

- Doc reference: https://mastra.ai/docs/memory/semantic-recall#storage-configuration

### Step 2: Create Vector Store Singleton

Create new file: `packages/mastra/src/vector.ts`

```typescript
import { PgVector } from "@mastra/pg";

declare global {
  var pgVector: PgVector | undefined;
}

function getPgVector(): PgVector {
  if (!global.pgVector) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not defined in environment variables");
    }

    global.pgVector = new PgVector({
      id: "mastra-vector",
      connectionString: process.env.DATABASE_URL,
    });
  }

  return global.pgVector;
}

export const vector = getPgVector();
```

- Doc reference: https://mastra.ai/reference/vectors/pg

### Step 3: Update Memory Configuration

Update `packages/mastra/src/memory.ts`:

```typescript
import { Memory } from "@mastra/memory";
import { ModelRouterEmbeddingModel } from "@mastra/core/llm";
import { storage } from "./storage";
import { vector } from "./vector";

declare global {
  var mastraMemory: Memory | undefined;
}

function getMemory(): Memory {
  if (!global.mastraMemory) {
    global.mastraMemory = new Memory({
      storage,
      vector,
      embedder: new ModelRouterEmbeddingModel("openai/text-embedding-3-small"),
      options: {
        generateTitle: true,
        lastMessages: 10,
        workingMemory: {
          enabled: true,
        },
        semanticRecall: {
          topK: 3,
          messageRange: 2,
          scope: "resource",
        },
      },
    });
  }

  return global.mastraMemory;
}

export const memory = getMemory();
```

- Doc reference: https://mastra.ai/docs/memory/semantic-recall#recall-configuration

### Step 4: Add OPENAI_API_KEY to Environment

Add to `.env`:

```env
OPENAI_API_KEY=sk-...
```

Update `turbo.json`:

```json
{
  "globalEnv": ["DATABASE_URL", "ANTHROPIC_API_KEY", "OPENAI_API_KEY"]
}
```

- Doc reference: https://mastra.ai/docs/memory/semantic-recall#embedder-configuration

### Step 5: Update Exports

Update `packages/mastra/src/index.ts`:

```typescript
export { vector } from "./vector";
```

## Documentation Deviations

| Deviation | Justification |
|-----------|---------------|
| Using `PgVector` from `@mastra/pg` | Verified correct - docs show both `LibSQLVector` and `PgVector` as valid options |
| Using `ModelRouterEmbeddingModel` | Verified correct - recommended pattern per docs |

## Demo Page Spec

- **Route**: `/demos/memory`
- **Inputs**: 
  - Text input for new messages
  - Search query input for semantic recall testing
  - Thread ID selector
- **Outputs**:
  - Chat history display
  - Semantic recall search results with similarity scores
  - Working memory display panel
- **Sample data**:
  - Pre-seeded conversation: "My name is Alex and I work at Acme Corp as a software engineer"
  - Test query: "What is my job?" should recall relevant context
  - Test query: "Where do I work?" should recall Acme Corp reference

### Sample Inputs/Test Data

```typescript
// Initial conversation to seed
const seedMessages = [
  { role: "user", content: "Hi, my name is Alex and I'm a software engineer at Acme Corp" },
  { role: "assistant", content: "Nice to meet you Alex! It's great to hear you're a software engineer at Acme Corp." },
  { role: "user", content: "I prefer TypeScript over JavaScript" },
  { role: "assistant", content: "TypeScript is a great choice! The type safety really helps with larger codebases." },
];

// Semantic recall test queries
const testQueries = [
  { query: "What's my name?", expectedMatch: "Alex" },
  { query: "What language do I prefer?", expectedMatch: "TypeScript" },
  { query: "Where do I work?", expectedMatch: "Acme Corp" },
];
```

### Error State Handling

- Display "Vector store not configured" if `DATABASE_URL` missing
- Display "Embedder not configured" if `OPENAI_API_KEY` missing
- Show loading spinner during semantic search operations
- Display "No similar messages found" when topK returns empty

### Loading States

- Skeleton loader for chat history
- Spinner on search button during semantic recall query
- Progress indicator for first-time index creation

## Dependency Map

- **Requires**: None (Phase 1 is foundational)
- **Enables**: Phase 6 (RAG Pipeline), Phase 7 (Evals use embedding infrastructure)
- **Standalone**: Yes - can be demoed independently

## Acceptance Criteria

- [ ] User can send a message and receive a response that persists to storage
- [ ] User can search conversation history using semantic similarity (not keyword match)
- [ ] System returns top 3 most similar messages with similarity scores > 0.5
- [ ] Messages from previous conversations are included in agent context automatically
- [ ] Error displays when OPENAI_API_KEY is missing
- [ ] Error displays when DATABASE_URL is missing or pgvector extension not enabled
- [ ] Working memory persists user information across thread restarts

## Test Plan

### Frontend

- [ ] Memory demo page renders without errors
- [ ] Chat input accepts text and submits on Enter
- [ ] Search input triggers semantic recall query
- [ ] Results display with similarity scores
- [ ] Loading states display during API calls
- [ ] Error messages display for configuration issues
- [ ] Responsive layout on mobile/desktop

### Backend

- [ ] `/api/chat` endpoint accepts messages and returns streamed response
- [ ] `/api/demos/memory/semantic` endpoint accepts query and returns similar messages
- [ ] `/api/demos/memory/working` endpoint returns current working memory state
- [ ] Empty query returns 400 error with message
- [ ] Missing thread ID returns 400 error
- [ ] Vector store query returns results within 2 seconds

### Integration

- [ ] End-to-end: Send message → embedded → stored → retrievable via semantic search
- [ ] Cross-thread recall works when `scope: "resource"` is set
- [ ] Agent response includes context from semantically recalled messages
- [ ] Authentication required for all memory endpoints
- [ ] Memory persists across server restarts

## Configuration Options Explained

| Option | Value | Description |
|--------|-------|-------------|
| `topK` | 3 | Number of semantically similar messages to retrieve |
| `messageRange` | 2 | Include N messages before and after each match for context |
| `scope` | "resource" | Search across all threads for this user (vs "thread" for current thread only) |

## Files Changed

| File | Action |
|------|--------|
| `packages/mastra/src/vector.ts` | Create |
| `packages/mastra/src/memory.ts` | Update |
| `packages/mastra/src/index.ts` | Update |
| `.env` | Add OPENAI_API_KEY |
| `turbo.json` | Add to globalEnv |
| `apps/agent/src/app/demos/memory/page.tsx` | Create (Phase 9) |
