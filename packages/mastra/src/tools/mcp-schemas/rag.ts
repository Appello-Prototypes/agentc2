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
        description: "Ingest a document into the RAG index.",
        inputSchema: {
            type: "object",
            properties: {
                content: { type: "string", description: "Document content" },
                type: { type: "string", description: "Document type" },
                sourceId: { type: "string", description: "Source identifier" },
                sourceName: { type: "string", description: "Source name" },
                chunkOptions: { type: "object", description: "Chunking options" }
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
    { kind: "registry", name: "rag-ingest" },
    { kind: "registry", name: "rag-documents-list" },
    { kind: "registry", name: "rag-document-delete" }
];
