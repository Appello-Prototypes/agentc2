import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createDocument, type CreateDocumentInput } from "../documents/service";
import { queryRag } from "../rag/pipeline";

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
        const results = await queryRag(query, {
            topK: topK ?? undefined,
            minScore: minScore ?? undefined
        });
        return { success: true, results, resultCount: results.length };
    }
});

export const ragIngestTool = createTool({
    id: "rag-ingest",
    description:
        "Ingest a document into the knowledge base. Creates a Document record and embeds content into the RAG vector store for semantic search.",
    inputSchema: z.object({
        content: z.string().describe("Document content to ingest"),
        type: z
            .enum(["markdown", "text", "html", "json"])
            .optional()
            .describe("Content format (default: markdown)"),
        sourceId: z.string().optional().describe("Used to generate the document slug"),
        sourceName: z.string().optional().describe("Used as the document display name"),
        chunkOptions: z.record(z.unknown()).optional().describe("Chunking options"),
        description: z.string().optional().describe("Brief description of the document"),
        category: z.string().optional().describe("Category for organization"),
        tags: z.array(z.string()).optional().describe("Tags for categorization"),
        workspaceId: z.string().optional().describe("Workspace to associate the document with"),
        onConflict: z
            .enum(["error", "skip", "update"])
            .optional()
            .describe("Behavior when slug already exists (default: error)")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({
        content,
        type,
        sourceId,
        sourceName,
        chunkOptions,
        description,
        category,
        tags,
        workspaceId,
        onConflict
    }) => {
        const slug = sourceId || `doc-${Date.now()}`;
        const name = sourceName || slug;

        const input: CreateDocumentInput = {
            slug,
            name,
            content,
            description,
            contentType: (type as CreateDocumentInput["contentType"]) || "markdown",
            category,
            tags,
            workspaceId,
            chunkOptions: chunkOptions as CreateDocumentInput["chunkOptions"],
            onConflict: onConflict || "error"
        };

        const document = await createDocument(input);
        return document;
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
