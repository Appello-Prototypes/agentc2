import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createDocument, type CreateDocumentInput } from "../documents/service";

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

export const documentCreateTool = createTool({
    id: "document-create",
    description: "Create a document, auto-embed into RAG.",
    inputSchema: z.object({
        slug: z.string().describe("URL-safe identifier for the document"),
        name: z.string().describe("Display name"),
        content: z.string().describe("Document content"),
        description: z.string().optional().describe("Brief description"),
        contentType: z
            .enum(["markdown", "text", "html", "json"])
            .optional()
            .describe("Content format"),
        category: z.string().optional().describe("Category for organization"),
        tags: z.array(z.string()).optional().describe("Tags for categorization")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ slug, name, content, description, contentType, category, tags }) => {
        // Call service directly -- eliminates the redundant HTTP self-call
        // that was causing MCP tool timeouts during RAG embedding
        const input: CreateDocumentInput = {
            slug,
            name,
            content,
            description,
            contentType: contentType as CreateDocumentInput["contentType"],
            category,
            tags
        };
        const document = await createDocument(input);
        return document;
    }
});

export const documentReadTool = createTool({
    id: "document-read",
    description: "Read a document by ID or slug.",
    inputSchema: z.object({
        documentId: z.string().describe("Document ID or slug")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ documentId }) => {
        return callInternalApi(`/api/documents/${encodeURIComponent(documentId)}`);
    }
});

export const documentUpdateTool = createTool({
    id: "document-update",
    description: "Update content, auto-re-embed.",
    inputSchema: z.object({
        documentId: z.string().describe("Document ID"),
        name: z.string().optional(),
        content: z.string().optional().describe("New content (triggers re-embed)"),
        description: z.string().optional(),
        category: z.string().optional(),
        tags: z.array(z.string()).optional(),
        changeSummary: z.string().optional().describe("Summary of changes for version history")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ documentId, ...body }) => {
        return callInternalApi(`/api/documents/${encodeURIComponent(documentId)}`, {
            method: "PUT",
            body
        });
    }
});

export const documentDeleteTool = createTool({
    id: "document-delete",
    description: "Remove document and its embeddings.",
    inputSchema: z.object({
        documentId: z.string().describe("Document ID")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ documentId }) => {
        return callInternalApi(`/api/documents/${encodeURIComponent(documentId)}`, {
            method: "DELETE"
        });
    }
});

export const documentListTool = createTool({
    id: "document-list",
    description: "List documents with filters.",
    inputSchema: z.object({
        category: z.string().optional(),
        tags: z.string().optional().describe("Comma-separated tags"),
        type: z.enum(["USER", "SYSTEM"]).optional(),
        skip: z.number().optional(),
        take: z.number().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ category, tags, type, skip, take }) => {
        return callInternalApi("/api/documents", {
            query: { category, tags, type, skip, take }
        });
    }
});

export const documentSearchTool = createTool({
    id: "document-search",
    description: "Semantic search across documents (wraps queryRag with doc filter).",
    inputSchema: z.object({
        query: z.string().describe("Search query"),
        documentId: z.string().optional().describe("Scope search to a specific document"),
        topK: z.number().optional().describe("Max results"),
        minScore: z.number().optional().describe("Minimum similarity score")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ query, documentId, topK, minScore }) => {
        if (documentId) {
            return callInternalApi(`/api/documents/${encodeURIComponent(documentId)}/search`, {
                method: "POST",
                body: { query, topK, minScore }
            });
        }
        // Global search across all documents uses the RAG query endpoint
        return callInternalApi("/api/rag/query", {
            method: "POST",
            body: { query, topK, minScore, generateResponse: false }
        });
    }
});
