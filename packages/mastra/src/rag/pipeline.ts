import { MDocument } from "@mastra/rag";
import { embedMany, embed } from "ai";
import { ModelRouterEmbeddingModel } from "@mastra/core/llm";
import { vector } from "../vector";

const RAG_INDEX_NAME = "rag_documents";

const embedder = new ModelRouterEmbeddingModel("openai/text-embedding-3-small");

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
        size: maxSize,
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
        ...chunk.metadata,
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

    return {
        documentId,
        chunksIngested: chunks.length,
        vectorIds
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
): Promise<
    Array<{
        text: string;
        score: number;
        metadata: Record<string, any>;
    }>
> {
    const { topK = 5, minScore = 0.5, filter } = options;

    const { embedding } = await embed({
        model: embedder,
        value: query
    });

    const results = await vector.query({
        indexName: RAG_INDEX_NAME,
        vector: embedding,
        topK,
        minScore,
        filter
    });

    return results.map((result) => ({
        text: result.metadata?.text || "",
        score: result.score,
        metadata: result.metadata || {}
    }));
}

/**
 * RAG-enhanced generation
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

    const chunks = await queryRag(query, { topK, minScore });

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
 * Delete a document and all its chunks from RAG
 */
export async function deleteDocument(documentId: string): Promise<void> {
    await vector.deleteVectors({
        indexName: RAG_INDEX_NAME,
        filter: { documentId }
    });
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
    const stats = await vector.describeIndex(RAG_INDEX_NAME);

    return [
        {
            documentId: "index_stats",
            sourceName: RAG_INDEX_NAME,
            chunkCount: stats.count,
            ingestedAt: new Date().toISOString()
        }
    ];
}
