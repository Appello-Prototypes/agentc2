# Phase 6: Implement RAG Pipeline

**Status**: Pending  
**Dependencies**: Phase 1 (pgvector must be configured)  
**Estimated Complexity**: High

## Objective

Implement a complete RAG (Retrieval-Augmented Generation) pipeline with:
1. Document ingestion and chunking
2. Embedding generation
3. Vector storage in Supabase pgvector
4. Similarity search and retrieval
5. Context-augmented generation

## What is RAG?

RAG enhances LLM outputs by incorporating relevant context from your own data sources. The process:

1. **Ingest**: Load documents (text, markdown, HTML, JSON)
2. **Chunk**: Split into manageable pieces
3. **Embed**: Convert chunks to vectors
4. **Store**: Save vectors in database
5. **Query**: Find similar chunks
6. **Generate**: Use retrieved context for better answers

## Implementation Steps

### Step 1: Install RAG Package

```bash
cd packages/mastra
bun add @mastra/rag
```

### Step 2: Create RAG Pipeline Module

Create `packages/mastra/src/rag/pipeline.ts`:

```typescript
import { MDocument } from "@mastra/rag";
import { embedMany, embed } from "ai";
import { ModelRouterEmbeddingModel } from "@mastra/core/llm";
import { vector } from "../vector";

// Index name for RAG documents
const RAG_INDEX_NAME = "rag_documents";

// Embedding model - same as memory for consistency
const embedder = new ModelRouterEmbeddingModel("openai/text-embedding-3-small");

/**
 * Supported document types and their initialization methods
 */
export type DocumentType = "text" | "markdown" | "html" | "json";

/**
 * Create a document from content
 */
export function createDocument(content: string, type: DocumentType = "text"): MDocument {
  switch (type) {
    case "markdown":
      return MDocument.fromMarkdown(content);
    case "html":
      return MDocument.fromHTML(content);
    case "json":
      return MDocument.fromJSON(content);
    default:
      return MDocument.fromText(content);
  }
}

/**
 * Chunking configuration options
 */
export interface ChunkOptions {
  strategy?: "recursive" | "character" | "sentence" | "markdown";
  maxSize?: number;
  overlap?: number;
}

/**
 * Chunk a document into smaller pieces
 */
export async function chunkDocument(
  doc: MDocument,
  options: ChunkOptions = {}
): Promise<Array<{ text: string; metadata: Record<string, any> }>> {
  const { strategy = "recursive", maxSize = 512, overlap = 50 } = options;

  const chunks = await doc.chunk({
    strategy,
    size: maxSize,
    overlap,
  });

  return chunks.map((chunk, index) => ({
    text: chunk.text,
    metadata: {
      chunkIndex: index,
      charCount: chunk.text.length,
      ...chunk.metadata,
    },
  }));
}

/**
 * Initialize the RAG index (run once)
 */
export async function initializeRagIndex(): Promise<void> {
  const indexes = await vector.listIndexes();
  
  if (!indexes.includes(RAG_INDEX_NAME)) {
    await vector.createIndex({
      indexName: RAG_INDEX_NAME,
      dimension: 1536, // OpenAI text-embedding-3-small dimension
      metric: "cosine",
      indexConfig: {
        type: "hnsw", // Better performance for similarity search
        hnsw: {
          m: 16,
          efConstruction: 64,
        },
      },
    });
    console.log(`Created RAG index: ${RAG_INDEX_NAME}`);
  }
}

/**
 * Ingest a document into the RAG system
 */
export async function ingestDocument(
  content: string,
  options: {
    type?: DocumentType;
    sourceId?: string;
    sourceName?: string;
    chunkOptions?: ChunkOptions;
  } = {}
): Promise<{
  documentId: string;
  chunksIngested: number;
  vectorIds: string[];
}> {
  const { type = "text", sourceId, sourceName, chunkOptions } = options;
  const documentId = sourceId || `doc_${Date.now()}`;

  // Create and chunk the document
  const doc = createDocument(content, type);
  const chunks = await chunkDocument(doc, chunkOptions);

  if (chunks.length === 0) {
    throw new Error("No chunks generated from document");
  }

  // Generate embeddings for all chunks
  const { embeddings } = await embedMany({
    model: embedder,
    values: chunks.map((c) => c.text),
  });

  // Prepare metadata for each chunk
  const metadata = chunks.map((chunk, index) => ({
    ...chunk.metadata,
    documentId,
    sourceName: sourceName || documentId,
    text: chunk.text, // Store text in metadata for retrieval
    chunkIndex: index,
    totalChunks: chunks.length,
    ingestedAt: new Date().toISOString(),
  }));

  // Generate IDs for vectors
  const vectorIds = chunks.map((_, index) => `${documentId}_chunk_${index}`);

  // Ensure index exists
  await initializeRagIndex();

  // Upsert vectors
  await vector.upsert({
    indexName: RAG_INDEX_NAME,
    vectors: embeddings,
    metadata,
    ids: vectorIds,
  });

  return {
    documentId,
    chunksIngested: chunks.length,
    vectorIds,
  };
}

/**
 * Query the RAG system for relevant chunks
 */
export async function queryRag(
  query: string,
  options: {
    topK?: number;
    minScore?: number;
    filter?: Record<string, any>;
  } = {}
): Promise<Array<{
  text: string;
  score: number;
  metadata: Record<string, any>;
}>> {
  const { topK = 5, minScore = 0.5, filter } = options;

  // Generate embedding for query
  const { embedding } = await embed({
    model: embedder,
    value: query,
  });

  // Query vector store
  const results = await vector.query({
    indexName: RAG_INDEX_NAME,
    vector: embedding,
    topK,
    minScore,
    filter,
  });

  return results.map((result) => ({
    text: result.metadata?.text || "",
    score: result.score,
    metadata: result.metadata || {},
  }));
}

/**
 * RAG-enhanced generation - combines retrieval with agent generation
 */
export async function ragGenerate(
  query: string,
  agent: any,
  options: {
    topK?: number;
    minScore?: number;
    systemContext?: string;
  } = {}
): Promise<{
  response: string;
  sources: Array<{ text: string; score: number; documentId?: string }>;
}> {
  const { topK = 5, minScore = 0.5, systemContext = "" } = options;

  // Retrieve relevant chunks
  const chunks = await queryRag(query, { topK, minScore });

  // Build context from retrieved chunks
  const contextParts = chunks.map(
    (chunk, i) => `[Source ${i + 1}]: ${chunk.text}`
  );
  const context = contextParts.join("\n\n");

  // Generate response with context
  const prompt = `${systemContext}

Use the following context to answer the question. If the context doesn't contain relevant information, say so.

CONTEXT:
${context}

QUESTION: ${query}

Provide a comprehensive answer based on the context above.`;

  const response = await agent.generate(prompt);

  return {
    response: response.text || "",
    sources: chunks.map((chunk) => ({
      text: chunk.text.substring(0, 200) + (chunk.text.length > 200 ? "..." : ""),
      score: chunk.score,
      documentId: chunk.metadata.documentId,
    })),
  };
}

/**
 * Delete a document and all its chunks from RAG
 */
export async function deleteDocument(documentId: string): Promise<void> {
  await vector.deleteVectors({
    indexName: RAG_INDEX_NAME,
    filter: { documentId },
  });
}

/**
 * List all ingested documents
 */
export async function listDocuments(): Promise<Array<{
  documentId: string;
  sourceName: string;
  chunkCount: number;
  ingestedAt: string;
}>> {
  // Note: This is a simplified implementation
  // In production, you'd want a separate metadata table
  const stats = await vector.describeIndex(RAG_INDEX_NAME);
  
  return [
    {
      documentId: "index_stats",
      sourceName: RAG_INDEX_NAME,
      chunkCount: stats.count,
      ingestedAt: new Date().toISOString(),
    },
  ];
}
```

### Step 3: Create RAG Exports

Create `packages/mastra/src/rag/index.ts`:

```typescript
export {
  createDocument,
  chunkDocument,
  initializeRagIndex,
  ingestDocument,
  queryRag,
  ragGenerate,
  deleteDocument,
  listDocuments,
  type DocumentType,
  type ChunkOptions,
} from "./pipeline";
```

### Step 4: Update Main Exports

Update `packages/mastra/src/index.ts`:

```typescript
// ... existing exports ...

// RAG
export {
  createDocument,
  chunkDocument,
  initializeRagIndex,
  ingestDocument,
  queryRag,
  ragGenerate,
  deleteDocument,
  listDocuments,
  type DocumentType,
  type ChunkOptions,
} from "./rag";
```

### Step 5: Create RAG API Routes

Create `apps/agent/src/app/api/rag/ingest/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { ingestDocument } from "@repo/mastra";
import { auth } from "@repo/auth";
import { headers } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { content, type, sourceId, sourceName } = await req.json();

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const result = await ingestDocument(content, {
      type: type || "text",
      sourceId,
      sourceName,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("RAG ingest error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ingest failed" },
      { status: 500 }
    );
  }
}
```

Create `apps/agent/src/app/api/rag/query/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { queryRag, ragGenerate } from "@repo/mastra";
import { mastra } from "@repo/mastra";
import { auth } from "@repo/auth";
import { headers } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { query, topK, minScore, generateResponse } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // If generateResponse is true, use RAG-enhanced generation
    if (generateResponse) {
      const agent = mastra.getAgent("assistant");
      const result = await ragGenerate(query, agent, { topK, minScore });
      return NextResponse.json(result);
    }

    // Otherwise, just return relevant chunks
    const results = await queryRag(query, { topK, minScore });
    return NextResponse.json({ results });
  } catch (error) {
    console.error("RAG query error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Query failed" },
      { status: 500 }
    );
  }
}
```

## Chunking Strategies Explained

| Strategy | Best For | Description |
|----------|----------|-------------|
| `recursive` | General text | Smart splitting based on content structure |
| `sentence` | Prose, articles | Preserves sentence boundaries |
| `markdown` | Documentation | Respects markdown structure |
| `character` | Simple splits | Character-based splitting |

## Verification Checklist

- [ ] `@mastra/rag` package installed
- [ ] `pipeline.ts` created with all functions
- [ ] RAG index created in Supabase
- [ ] Document ingestion works
- [ ] Query returns relevant chunks
- [ ] RAG-enhanced generation works
- [ ] API routes created and authenticated

## Testing Examples

### Ingest a Document

```typescript
import { ingestDocument } from "@repo/mastra";

const result = await ingestDocument(
  `# Mastra AI Framework
  
  Mastra is a TypeScript framework for building AI applications.
  It supports agents, tools, workflows, and memory management.
  
  ## Key Features
  - Model routing with 40+ providers
  - Built-in memory and semantic recall
  - Graph-based workflow engine
  `,
  {
    type: "markdown",
    sourceId: "mastra-docs-1",
    sourceName: "Mastra Documentation",
  }
);

console.log(`Ingested ${result.chunksIngested} chunks`);
```

### Query RAG

```typescript
import { queryRag } from "@repo/mastra";

const results = await queryRag("What is Mastra?", { topK: 3 });
results.forEach((r) => {
  console.log(`Score: ${r.score.toFixed(3)} - ${r.text.substring(0, 100)}...`);
});
```

### RAG-Enhanced Generation

```typescript
import { ragGenerate, mastra } from "@repo/mastra";

const agent = mastra.getAgent("assistant");
const result = await ragGenerate(
  "How do I use Mastra for building AI applications?",
  agent,
  { topK: 5 }
);

console.log("Answer:", result.response);
console.log("Sources:", result.sources);
```

## Files Changed

| File | Action |
|------|--------|
| `packages/mastra/package.json` | Add @mastra/rag |
| `packages/mastra/src/rag/pipeline.ts` | Create |
| `packages/mastra/src/rag/index.ts` | Create |
| `packages/mastra/src/index.ts` | Update |
| `apps/agent/src/app/api/rag/ingest/route.ts` | Create |
| `apps/agent/src/app/api/rag/query/route.ts` | Create |
