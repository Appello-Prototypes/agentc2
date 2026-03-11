import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createDocument, type CreateDocumentInput } from "../documents/service";
import { queryRag } from "../rag/pipeline";
import { callInternalApi } from "./internal-api";

const baseOutputSchema = z.object({ success: z.boolean().optional() }).passthrough();

export const ragQueryTool = createTool({
    id: "rag-query",
    description: "Query the RAG index without generating a response.",
    inputSchema: z.object({
        query: z.string(),
        topK: z.number().optional(),
        minScore: z.number().optional(),
        organizationId: z
            .string()
            .optional()
            .describe("Organization ID for tenant-scoped queries (auto-injected)")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ query, topK, minScore, organizationId }) => {
        const results = await queryRag(query, {
            organizationId: organizationId ?? undefined,
            topK: topK ?? undefined,
            minScore: minScore ?? undefined
        });
        return {
            success: true,
            results: results.map((r) => ({
                text: r.text,
                score: r.score,
                metadata: JSON.parse(JSON.stringify(r.metadata))
            })),
            resultCount: results.length
        };
    }
});

export const ragIngestTool = createTool({
    id: "rag-ingest",
    description:
        "Ingest a document into the knowledge base. Creates a Document record and queues content for vector embedding. IMPORTANT: Embedding runs asynchronously — the document record is returned immediately but rag-query may not find it for several seconds. Check the returned embeddedAt field: null means embedding is still in progress. Use onConflict:'update' to overwrite an existing document with the same slug.",
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
        content,
        type,
        sourceId,
        sourceName,
        chunkOptions,
        description,
        category,
        tags,
        workspaceId,
        organizationId,
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
            organizationId,
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
    inputSchema: z.object({
        organizationId: z.string().optional().describe("Auto-injected organization ID")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ organizationId }) => {
        return callInternalApi("/api/rag/documents", { organizationId });
    }
});

export const ragDocumentDeleteTool = createTool({
    id: "rag-document-delete",
    description: "Delete an ingested RAG document.",
    inputSchema: z.object({
        documentId: z.string(),
        organizationId: z.string().optional().describe("Auto-injected organization ID")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ documentId, organizationId }) => {
        return callInternalApi("/api/rag/documents", {
            method: "DELETE",
            body: { documentId },
            organizationId
        });
    }
});
