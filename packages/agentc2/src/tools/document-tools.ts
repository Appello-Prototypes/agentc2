import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
    createDocument,
    getDocument,
    updateDocument,
    deleteDocument,
    listDocuments,
    searchDocuments,
    type CreateDocumentInput,
    type UpdateDocumentInput
} from "../documents/service";

const baseOutputSchema = z.object({ success: z.boolean().optional() }).passthrough();

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
        tags: z.array(z.string()).optional().describe("Tags for categorization"),
        workspaceId: z.string().optional().describe("Workspace to associate the document with"),
        organizationId: z
            .string()
            .optional()
            .describe("Organization ID for tenant scoping (auto-injected)"),
        onConflict: z
            .enum(["error", "skip", "update"])
            .optional()
            .describe("Behavior when slug already exists (default: error)")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({
        slug,
        name,
        content,
        description,
        contentType,
        category,
        tags,
        workspaceId,
        organizationId,
        onConflict
    }) => {
        const input: CreateDocumentInput = {
            slug,
            name,
            content,
            description,
            contentType: contentType as CreateDocumentInput["contentType"],
            category,
            tags,
            workspaceId,
            organizationId,
            onConflict
        };
        const document = await createDocument(input);
        return document;
    }
});

export const documentReadTool = createTool({
    id: "document-read",
    description: "Read a document by ID or slug.",
    inputSchema: z.object({
        documentId: z.string().describe("Document ID or slug"),
        organizationId: z
            .string()
            .optional()
            .describe("Organization ID for tenant-scoped access (auto-injected)")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ documentId, organizationId }) => {
        const document = await getDocument(documentId, organizationId ?? undefined);
        return document;
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
        changeSummary: z.string().optional().describe("Summary of changes for version history"),
        organizationId: z
            .string()
            .optional()
            .describe("Organization ID for tenant-scoped access (auto-injected)")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ documentId, organizationId, ...body }) => {
        if (organizationId) {
            const doc = await getDocument(documentId, organizationId);
            if (!doc) return { success: false, error: "Document not found" };
        }

        const input: UpdateDocumentInput = {};
        if (body.name !== undefined) input.name = body.name;
        if (body.content !== undefined) input.content = body.content;
        if (body.description !== undefined) input.description = body.description;
        if (body.category !== undefined) input.category = body.category;
        if (body.tags !== undefined) input.tags = body.tags;
        if (body.changeSummary !== undefined) input.changeSummary = body.changeSummary;

        const document = await updateDocument(documentId, input);
        return document;
    }
});

export const documentDeleteTool = createTool({
    id: "document-delete",
    description: "Remove document and its embeddings.",
    inputSchema: z.object({
        documentId: z.string().describe("Document ID"),
        organizationId: z
            .string()
            .optional()
            .describe("Organization ID for tenant-scoped access (auto-injected)")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ documentId, organizationId }) => {
        if (organizationId) {
            const doc = await getDocument(documentId, organizationId);
            if (!doc) return { success: false, error: "Document not found" };
        }
        await deleteDocument(documentId);
        return { success: true };
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
        take: z.number().optional(),
        organizationId: z
            .string()
            .optional()
            .describe("Organization ID for tenant-scoped listing (auto-injected)")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ category, tags, type, skip, take, organizationId }) => {
        const tagArray = tags ? tags.split(",").map((t) => t.trim()) : undefined;
        const documents = await listDocuments({
            organizationId: organizationId ?? undefined,
            category: category ?? undefined,
            tags: tagArray,
            type: type ?? undefined,
            skip: skip ?? undefined,
            take: take ?? undefined
        });
        return documents;
    }
});

export const documentSearchTool = createTool({
    id: "document-search",
    description: "Semantic search across documents (wraps queryRag with doc filter).",
    inputSchema: z.object({
        query: z.string().describe("Search query"),
        documentId: z.string().optional().describe("Scope search to a specific document"),
        topK: z.number().optional().describe("Max results"),
        minScore: z.number().optional().describe("Minimum similarity score"),
        organizationId: z
            .string()
            .optional()
            .describe("Organization ID for tenant-scoped search (auto-injected)")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ query, documentId, topK, minScore, organizationId }) => {
        const results = await searchDocuments({
            query,
            documentId: documentId ?? undefined,
            organizationId: organizationId ?? undefined,
            topK: topK ?? undefined,
            minScore: minScore ?? undefined
        });
        return { success: true, results, resultCount: results.length };
    }
});
