import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const baseOutputSchema = z.object({ success: z.boolean().optional() }).passthrough();

const getInternalBaseUrl = () =>
    process.env.MASTRA_API_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

const buildHeaders = () => {
    const headers: Record<string, string> = {
        "Content-Type": "application/json"
    };
    const apiKey = process.env.MASTRA_API_KEY || process.env.MCP_API_KEY;
    if (apiKey) {
        headers["X-API-Key"] = apiKey;
    }
    const orgSlug = process.env.MASTRA_ORGANIZATION_SLUG || process.env.MCP_API_ORGANIZATION_SLUG;
    if (orgSlug) {
        headers["X-Organization-Slug"] = orgSlug;
    }
    return headers;
};

const callInternalApi = async (
    path: string,
    options?: {
        method?: string;
        query?: Record<string, unknown>;
        body?: Record<string, unknown>;
    }
) => {
    const url = new URL(path, getInternalBaseUrl());
    if (options?.query) {
        Object.entries(options.query).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, String(value));
            }
        });
    }

    const response = await fetch(url.toString(), {
        method: options?.method ?? "GET",
        headers: buildHeaders(),
        body: options?.body ? JSON.stringify(options.body) : undefined
    });
    const data = await response.json();
    if (!response.ok) {
        const errorMessage =
            (data && typeof data === "object" && "error" in data ? data.error : undefined) ||
            `Request failed (${response.status})`;
        throw new Error(String(errorMessage));
    }
    return data;
};

export const ragQueryTool = createTool({
    id: "rag-query",
    description: "Query the RAG index without generating a response.",
    inputSchema: z.object({
        query: z.string(),
        topK: z.number().optional(),
        minScore: z.number().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ query, topK, minScore }) => {
        return callInternalApi("/api/rag/query", {
            method: "POST",
            body: {
                query,
                topK,
                minScore,
                generateResponse: false
            }
        });
    }
});

export const ragIngestTool = createTool({
    id: "rag-ingest",
    description: "Ingest a document into the RAG index.",
    inputSchema: z.object({
        content: z.string(),
        type: z.string().optional(),
        sourceId: z.string().optional(),
        sourceName: z.string().optional(),
        chunkOptions: z.record(z.unknown()).optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ content, type, sourceId, sourceName, chunkOptions }) => {
        return callInternalApi("/api/rag/ingest", {
            method: "POST",
            body: { content, type, sourceId, sourceName, chunkOptions }
        });
    }
});

export const ragDocumentsListTool = createTool({
    id: "rag-documents-list",
    description: "List ingested RAG documents.",
    inputSchema: z.object({}),
    outputSchema: baseOutputSchema,
    execute: async () => {
        return callInternalApi("/api/rag/documents");
    }
});

export const ragDocumentDeleteTool = createTool({
    id: "rag-document-delete",
    description: "Delete an ingested RAG document.",
    inputSchema: z.object({
        documentId: z.string()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ documentId }) => {
        return callInternalApi("/api/rag/documents", {
            method: "DELETE",
            body: { documentId }
        });
    }
});
