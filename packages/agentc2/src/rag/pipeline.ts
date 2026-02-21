import { MDocument } from "@mastra/rag";
import { embedMany, embed, generateText, type LanguageModel } from "ai";
import { openai } from "@ai-sdk/openai";
import { prisma } from "@repo/database";
import { vector } from "../vector";

const RAG_INDEX_NAME = "rag_documents";

const embedder = openai.embedding("text-embedding-3-small");

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
        maxSize,
        overlap
    });

    return chunks.map((chunk, index) => ({
        text: chunk.text,
        metadata: {
            chunkIndex: index,
            charCount: chunk.text.length,
            ...chunk.metadata
        }
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
            metric: "cosine"
        });
        console.log(`Created RAG index: ${RAG_INDEX_NAME}`);
    }
}

/**
 * Ingest a document into the RAG system.
 * organizationId is included in every chunk's metadata for tenant isolation.
 */
export async function ingestDocument(
    content: string,
    options: {
        organizationId?: string;
        type?: DocumentType;
        sourceId?: string;
        sourceName?: string;
        chunkOptions?: ChunkOptions;
        metadata?: Record<string, any>;
    } = {}
): Promise<{
    documentId: string;
    chunksIngested: number;
    vectorIds: string[];
}> {
    const { type = "text", sourceId, sourceName, chunkOptions, organizationId } = options;
    const documentId = sourceId || `doc_${Date.now()}`;

    const doc = createDocument(content, type);
    const chunks = await chunkDocument(doc, chunkOptions);

    if (chunks.length === 0) {
        throw new Error("No chunks generated from document");
    }

    const { embeddings } = await embedMany({
        model: embedder,
        values: chunks.map((c) => c.text)
    });

    const metadata = chunks.map((chunk, index) => ({
        ...options.metadata,
        ...chunk.metadata,
        ...(organizationId ? { organizationId } : {}),
        documentId,
        sourceName: sourceName || documentId,
        text: chunk.text,
        chunkIndex: index,
        totalChunks: chunks.length,
        ingestedAt: new Date().toISOString()
    }));

    const vectorIds = chunks.map((_, index) => `${documentId}_chunk_${index}`);

    await initializeRagIndex();

    await vector.upsert({
        indexName: RAG_INDEX_NAME,
        vectors: embeddings,
        metadata,
        ids: vectorIds
    });

    // Dual-write: store chunk text in RagChunk table for full-text search
    try {
        await prisma.ragChunk.createMany({
            data: chunks.map((chunk, index) => ({
                id: `${documentId}_chunk_${index}`,
                documentId,
                organizationId: organizationId || "",
                chunkIndex: index,
                text: chunk.text,
                sourceName: sourceName || documentId,
                metadata: chunk.metadata
            })),
            skipDuplicates: true
        });
    } catch (error) {
        console.warn(
            "[ingestDocument] Failed to write RagChunk records (full-text search may be unavailable):",
            error instanceof Error ? error.message : error
        );
    }

    return {
        documentId,
        chunksIngested: chunks.length,
        vectorIds
    };
}

/**
 * Check whether the RAG index exists (without creating it).
 */
export async function ragIndexExists(): Promise<boolean> {
    const indexes = await vector.listIndexes();
    return indexes.includes(RAG_INDEX_NAME);
}

/**
 * Query the RAG system for relevant chunks.
 * When organizationId is provided, it is enforced as a mandatory filter
 * to prevent cross-tenant data leakage.
 */
export async function queryRag(
    query: string,
    options: {
        organizationId?: string;
        topK?: number;
        minScore?: number;
        filter?: Record<string, any>;
        mode?: "vector" | "keyword" | "hybrid";
        vectorWeight?: number;
        rerank?: boolean;
        rerankModel?: LanguageModel;
    } = {}
): Promise<
    Array<{
        text: string;
        score: number;
        metadata: Record<string, any>;
    }>
> {
    const {
        topK = 5,
        minScore = 0.5,
        filter,
        organizationId,
        mode = "vector",
        vectorWeight = 0.5,
        rerank = false,
        rerankModel
    } = options;

    if (!organizationId) {
        console.warn(
            "[queryRag] No organizationId provided -- results are unscoped (cross-tenant risk)"
        );
    }

    // Keyword-only mode
    if (mode === "keyword") {
        const kwResults = await keywordSearch(query, { organizationId, topK });
        return kwResults.slice(0, topK);
    }

    // Vector search (shared by "vector" and "hybrid" modes)
    let vectorResults: Array<{
        id: string;
        text: string;
        score: number;
        metadata: Record<string, any>;
    }> = [];

    if (await ragIndexExists()) {
        const { embedding } = await embed({
            model: embedder,
            value: query
        });

        const effectiveFilter = {
            ...filter,
            ...(organizationId ? { organizationId } : {})
        };

        const rawResults = await vector.query({
            indexName: RAG_INDEX_NAME,
            queryVector: embedding,
            topK: mode === "hybrid" ? topK * 2 : topK,
            minScore,
            filter: Object.keys(effectiveFilter).length > 0 ? effectiveFilter : undefined
        });

        vectorResults = rawResults.map((result) => ({
            id: result.metadata?.documentId
                ? `${result.metadata.documentId}_chunk_${result.metadata.chunkIndex ?? 0}`
                : `vec_${Math.random().toString(36).slice(2)}`,
            text: result.metadata?.text || "",
            score: result.score,
            metadata: result.metadata || {}
        }));
    }

    // Pure vector mode -- return directly
    if (mode === "vector") {
        let results = vectorResults.map((r) => ({
            text: r.text,
            score: r.score,
            metadata: r.metadata
        }));
        if (rerank && rerankModel && results.length > 0) {
            results = await rerankResults(query, results, topK, rerankModel);
        }
        return results.slice(0, topK);
    }

    // Hybrid mode: run keyword search in parallel, then merge with RRF
    const kwResults = await keywordSearch(query, {
        organizationId,
        topK: topK * 2
    });

    let merged = reciprocalRankFusion(vectorResults, kwResults, 60, vectorWeight);

    if (rerank && rerankModel && merged.length > 0) {
        merged = await rerankResults(query, merged, topK, rerankModel);
    }

    return merged.slice(0, topK);
}

/**
 * RAG-enhanced generation
 */
export async function ragGenerate(
    query: string,
    agent: any,
    options: {
        organizationId?: string;
        topK?: number;
        minScore?: number;
        systemContext?: string;
    } = {}
): Promise<{
    response: string;
    sources: Array<{ text: string; score: number; documentId?: string }>;
}> {
    const { topK = 5, minScore = 0.5, systemContext = "", organizationId } = options;

    const chunks = await queryRag(query, { topK, minScore, organizationId });

    const contextParts = chunks.map((chunk, i) => `[Source ${i + 1}]: ${chunk.text}`);
    const context = contextParts.join("\n\n");

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
            documentId: chunk.metadata.documentId
        }))
    };
}

/**
 * RAG-enhanced streaming generation
 */
export async function ragGenerateStream(
    query: string,
    agent: any,
    options: {
        organizationId?: string;
        topK?: number;
        minScore?: number;
        systemContext?: string;
    } = {}
): Promise<{
    textStream: AsyncIterable<string>;
    sources: Array<{ text: string; score: number; documentId?: string }>;
}> {
    const { topK = 5, minScore = 0.5, systemContext = "", organizationId } = options;

    const chunks = await queryRag(query, { topK, minScore, organizationId });

    const contextParts = chunks.map((chunk, i) => `[Source ${i + 1}]: ${chunk.text}`);
    const context = contextParts.join("\n\n");

    const prompt = `${systemContext}

Use the following context to answer the question. If the context doesn't contain relevant information, say so.

CONTEXT:
${context}

QUESTION: ${query}

Provide a comprehensive answer based on the context above.`;

    const responseStream = await agent.stream(prompt);

    return {
        textStream: responseStream.textStream,
        sources: chunks.map((chunk) => ({
            text: chunk.text.substring(0, 200) + (chunk.text.length > 200 ? "..." : ""),
            score: chunk.score,
            documentId: chunk.metadata.documentId
        }))
    };
}

/**
 * Delete a document and all its chunks from RAG
 */
export async function deleteDocument(documentId: string): Promise<void> {
    // Clean up RagChunk records for full-text search
    try {
        await prisma.ragChunk.deleteMany({ where: { documentId } });
    } catch {
        // Non-critical: table may not exist yet
    }

    if (!(await ragIndexExists())) {
        return;
    }
    await vector.deleteVectors({
        indexName: RAG_INDEX_NAME,
        filter: { documentId }
    });
}

// ── Full-Text Keyword Search ─────────────────────────────────────────────────

/**
 * Search RAG chunks using PostgreSQL full-text search (ts_query).
 * Requires the rag_chunk table with a tsvector GIN index.
 */
export async function keywordSearch(
    query: string,
    options: {
        organizationId?: string;
        topK?: number;
        documentId?: string;
    } = {}
): Promise<Array<{ id: string; text: string; score: number; metadata: Record<string, any> }>> {
    const { topK = 10, organizationId, documentId } = options;

    try {
        const results: Array<{
            id: string;
            text: string;
            metadata: any;
            chunkIndex: number;
            documentId: string;
            score: number;
        }> = await prisma.$queryRaw`
            SELECT id, text, metadata, "chunkIndex", "documentId",
                   ts_rank(search_vector, plainto_tsquery('english', ${query})) as score
            FROM rag_chunk
            WHERE search_vector @@ plainto_tsquery('english', ${query})
              AND (${organizationId}::text IS NULL OR "organizationId" = ${organizationId})
              AND (${documentId}::text IS NULL OR "documentId" = ${documentId})
            ORDER BY score DESC
            LIMIT ${topK}
        `;

        return results.map((r) => ({
            id: r.id,
            text: r.text,
            score: Number(r.score),
            metadata: r.metadata || {}
        }));
    } catch (error) {
        console.warn(
            "[keywordSearch] Full-text search failed (table may not exist yet):",
            error instanceof Error ? error.message : error
        );
        return [];
    }
}

// ── Reciprocal Rank Fusion ───────────────────────────────────────────────────

/**
 * Merge vector and keyword search results using Reciprocal Rank Fusion.
 * Produces a unified ranking that benefits from both retrieval signals.
 */
export function reciprocalRankFusion(
    vectorResults: Array<{
        id: string;
        text: string;
        score: number;
        metadata: Record<string, any>;
    }>,
    keywordResults: Array<{
        id: string;
        text: string;
        score: number;
        metadata: Record<string, any>;
    }>,
    k: number = 60,
    vectorWeight: number = 0.5
): Array<{ text: string; score: number; metadata: Record<string, any> }> {
    const keywordWeight = 1 - vectorWeight;
    const scores = new Map<
        string,
        { score: number; text: string; metadata: Record<string, any> }
    >();

    vectorResults.forEach((item, rank) => {
        const rrfScore = vectorWeight * (1 / (k + rank + 1));
        scores.set(item.id, { score: rrfScore, text: item.text, metadata: item.metadata });
    });

    keywordResults.forEach((item, rank) => {
        const rrfScore = keywordWeight * (1 / (k + rank + 1));
        const existing = scores.get(item.id);
        if (existing) {
            existing.score += rrfScore;
        } else {
            scores.set(item.id, { score: rrfScore, text: item.text, metadata: item.metadata });
        }
    });

    return Array.from(scores.values()).sort((a, b) => b.score - a.score);
}

// ── LLM Re-Ranking ──────────────────────────────────────────────────────────

/**
 * Re-rank search candidates using an LLM for higher precision.
 * Falls back to original order if the model call fails.
 */
export async function rerankResults(
    query: string,
    candidates: Array<{ text: string; score: number; metadata: Record<string, any> }>,
    topK: number = 5,
    compressionModel: LanguageModel
): Promise<Array<{ text: string; score: number; metadata: Record<string, any> }>> {
    if (candidates.length <= topK) return candidates;

    const topCandidates = candidates.slice(0, 20);

    try {
        const passageList = topCandidates
            .map((c, i) => `[${i}] ${c.text.slice(0, 300)}`)
            .join("\n\n");

        const { text } = await generateText({
            model: compressionModel,
            prompt: [
                `Rank these passages by relevance to the query: "${query}"`,
                `Return ONLY the indices of the top ${topK} most relevant passages as a comma-separated list (e.g. "3,0,7,1,4").`,
                `\nPassages:\n${passageList}`
            ].join("\n")
        });

        const indices = text
            .replace(/[^0-9,]/g, "")
            .split(",")
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !isNaN(n) && n >= 0 && n < topCandidates.length);

        if (indices.length === 0) return candidates.slice(0, topK);

        const seen = new Set<number>();
        const reranked: Array<{ text: string; score: number; metadata: Record<string, any> }> = [];
        for (const idx of indices) {
            if (!seen.has(idx)) {
                seen.add(idx);
                reranked.push(topCandidates[idx]);
            }
            if (reranked.length >= topK) break;
        }

        // Fill remaining slots with non-reranked candidates in original order
        if (reranked.length < topK) {
            for (let i = 0; i < topCandidates.length && reranked.length < topK; i++) {
                if (!seen.has(i)) {
                    reranked.push(topCandidates[i]);
                }
            }
        }

        return reranked;
    } catch (error) {
        console.warn(
            "[rerankResults] LLM re-ranking failed, returning original order:",
            error instanceof Error ? error.message : error
        );
        return candidates.slice(0, topK);
    }
}

/**
 * List all ingested documents
 */
export async function listDocuments(): Promise<
    Array<{
        documentId: string;
        sourceName: string;
        chunkCount: number;
        ingestedAt: string;
    }>
> {
    if (!(await ragIndexExists())) {
        return []; // No documents ingested yet
    }

    const stats = await vector.describeIndex({ indexName: RAG_INDEX_NAME });

    return [
        {
            documentId: "index_stats",
            sourceName: RAG_INDEX_NAME,
            chunkCount: stats.count,
            ingestedAt: new Date().toISOString()
        }
    ];
}
