import { McpToolDefinition, McpToolRoute } from "./types";

export const documentToolDefinitions: McpToolDefinition[] = [
    {
        name: "document-create",
        description: "Create a document, auto-embed into RAG.",
        inputSchema: {
            type: "object",
            properties: {
                slug: { type: "string", description: "URL-safe identifier for the document" },
                name: { type: "string", description: "Display name" },
                content: { type: "string", description: "Document content" },
                description: { type: "string", description: "Brief description" },
                contentType: {
                    type: "string",
                    enum: ["markdown", "text", "html", "json"],
                    description: "Content format"
                },
                category: { type: "string", description: "Category for organization" },
                tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Tags for categorization"
                },
                workspaceId: {
                    type: "string",
                    description: "Workspace to associate the document with"
                },
                onConflict: {
                    type: "string",
                    enum: ["error", "skip", "update"],
                    description:
                        "Behavior when slug already exists: error (default), skip, or update"
                }
            },
            required: ["slug", "name", "content"]
        },
        invoke_url: "/api/mcp",
        category: "documents"
    },
    {
        name: "document-read",
        description: "Read a document by ID or slug.",
        inputSchema: {
            type: "object",
            properties: {
                documentId: { type: "string", description: "Document ID or slug" }
            },
            required: ["documentId"]
        },
        invoke_url: "/api/mcp",
        category: "documents"
    },
    {
        name: "document-update",
        description: "Update content, auto-re-embed.",
        inputSchema: {
            type: "object",
            properties: {
                documentId: { type: "string", description: "Document ID" },
                name: { type: "string", description: "New name" },
                content: { type: "string", description: "New content (triggers re-embed)" },
                description: { type: "string", description: "New description" },
                category: { type: "string", description: "New category" },
                tags: { type: "array", items: { type: "string" }, description: "New tags" },
                changeSummary: {
                    type: "string",
                    description: "Summary of changes for version history"
                }
            },
            required: ["documentId"]
        },
        invoke_url: "/api/mcp",
        category: "documents"
    },
    {
        name: "document-delete",
        description: "Remove document and its embeddings.",
        inputSchema: {
            type: "object",
            properties: {
                documentId: { type: "string", description: "Document ID" }
            },
            required: ["documentId"]
        },
        invoke_url: "/api/mcp",
        category: "documents"
    },
    {
        name: "document-list",
        description: "List documents with filters.",
        inputSchema: {
            type: "object",
            properties: {
                category: { type: "string", description: "Filter by category" },
                tags: { type: "string", description: "Comma-separated tags to filter by" },
                type: { type: "string", enum: ["USER", "SYSTEM"], description: "Filter by type" },
                skip: { type: "number", description: "Pagination offset" },
                take: { type: "number", description: "Page size" }
            }
        },
        invoke_url: "/api/mcp",
        category: "documents"
    },
    {
        name: "document-search",
        description: "Semantic search across documents (wraps queryRag with doc filter).",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string", description: "Search query" },
                documentId: { type: "string", description: "Scope search to a specific document" },
                topK: { type: "number", description: "Max results" },
                minScore: { type: "number", description: "Minimum similarity score" }
            },
            required: ["query"]
        },
        invoke_url: "/api/mcp",
        category: "documents"
    }
];

export const documentToolRoutes: McpToolRoute[] = [
    { kind: "registry", name: "document-create", applyDefaults: true },
    { kind: "registry", name: "document-read" },
    { kind: "registry", name: "document-update" },
    { kind: "registry", name: "document-delete" },
    { kind: "registry", name: "document-list" },
    { kind: "registry", name: "document-search" }
];
