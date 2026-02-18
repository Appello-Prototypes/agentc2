import { McpToolDefinition, McpToolRoute } from "./types";

export const ragToolDefinitions: McpToolDefinition[] = [
    {
        name: "rag-query",
        description: "Query the RAG index without generating a response.",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string", description: "Query text" },
                topK: { type: "number", description: "Max results to return" },
                minScore: { type: "number", description: "Minimum similarity score" }
            },
            required: ["query"]
        },
        invoke_url: "/api/mcp",
        category: "rag"
    },
    {
        name: "rag-ingest",
        description:
            "Ingest a document into the knowledge base. Creates a Document record and embeds content into the RAG vector store for semantic search.",
        inputSchema: {
            type: "object",
            properties: {
                content: { type: "string", description: "Document content to ingest" },
                type: {
                    type: "string",
                    enum: ["markdown", "text", "html", "json"],
                    description: "Content format (default: markdown)"
                },
                sourceId: {
                    type: "string",
                    description: "Used to generate the document slug"
                },
                sourceName: {
                    type: "string",
                    description: "Used as the document display name"
                },
                chunkOptions: { type: "object", description: "Chunking options" },
                description: { type: "string", description: "Brief description of the document" },
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
            required: ["content"]
        },
        invoke_url: "/api/mcp",
        category: "rag"
    },
    {
        name: "rag-documents-list",
        description: "List ingested RAG documents.",
        inputSchema: {
            type: "object",
            properties: {}
        },
        invoke_url: "/api/mcp",
        category: "rag"
    },
    {
        name: "rag-document-delete",
        description: "Delete an ingested RAG document.",
        inputSchema: {
            type: "object",
            properties: {
                documentId: { type: "string", description: "Document ID" }
            },
            required: ["documentId"]
        },
        invoke_url: "/api/mcp",
        category: "rag"
    }
];

export const ragToolRoutes: McpToolRoute[] = [
    { kind: "registry", name: "rag-query" },
    { kind: "registry", name: "rag-ingest", applyDefaults: true },
    { kind: "registry", name: "rag-documents-list" },
    { kind: "registry", name: "rag-document-delete" }
];
