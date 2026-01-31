"use client";

import { useState } from "react";
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Textarea,
    Input
} from "@repo/ui";

interface IngestResult {
    documentId?: string;
    chunks?: number;
    error?: string;
}

interface RagChunk {
    content: string;
    score?: number;
}

interface QueryResult {
    response?: string;
    chunks?: RagChunk[];
    error?: string;
}

export default function RagDemoPage() {
    const [content, setContent] = useState(`# Mastra AI Framework

Mastra is a TypeScript framework for building AI applications.
It supports agents, tools, workflows, and memory management.

## Key Features
- Model routing with 40+ providers
- Built-in memory and semantic recall
- Graph-based workflow engine
- RAG (Retrieval-Augmented Generation) pipeline`);
    const [docType, setDocType] = useState("markdown");
    const [sourceName, setSourceName] = useState("Mastra Documentation");
    const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
    const [ingestLoading, setIngestLoading] = useState(false);

    const [query, setQuery] = useState("What is Mastra?");
    const [generateResponse, setGenerateResponse] = useState(true);
    const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
    const [queryLoading, setQueryLoading] = useState(false);

    const handleIngest = async () => {
        setIngestLoading(true);
        try {
            const res = await fetch("/api/rag/ingest", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content, type: docType, sourceName })
            });
            const data = await res.json();
            setIngestResult(data);
        } catch {
            setIngestResult({ error: "Failed to ingest document" });
        }
        setIngestLoading(false);
    };

    const handleQuery = async () => {
        setQueryLoading(true);
        try {
            const res = await fetch("/api/rag/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query, generateResponse })
            });
            const data = await res.json();
            setQueryResult(data);
        } catch {
            setQueryResult({ error: "Failed to query" });
        }
        setQueryLoading(false);
    };

    return (
        <div>
            <h1 className="mb-2 text-3xl font-bold">RAG Demo</h1>
            <p className="text-muted-foreground mb-8">
                Ingest documents, search vectors, and generate context-aware responses.
            </p>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Document Ingestion</CardTitle>
                        <CardDescription>
                            Chunk, embed, and store documents for retrieval.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="mb-2 block text-sm font-medium">Content</label>
                            <Textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                rows={8}
                                placeholder="Paste document content here..."
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium">
                                    Document Type
                                </label>
                                <select
                                    value={docType}
                                    onChange={(e) => setDocType(e.target.value)}
                                    className="bg-background w-full rounded-md border p-2"
                                >
                                    <option value="text">Text</option>
                                    <option value="markdown">Markdown</option>
                                    <option value="html">HTML</option>
                                    <option value="json">JSON</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium">
                                    Source Name
                                </label>
                                <Input
                                    value={sourceName}
                                    onChange={(e) => setSourceName(e.target.value)}
                                    placeholder="Document name..."
                                />
                            </div>
                        </div>
                        <Button onClick={handleIngest} disabled={ingestLoading}>
                            {ingestLoading ? "Ingesting..." : "Ingest Document"}
                        </Button>
                        {ingestResult && (
                            <pre className="bg-muted overflow-auto rounded-md p-4 text-sm">
                                {JSON.stringify(ingestResult, null, 2)}
                            </pre>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Query & Generation</CardTitle>
                        <CardDescription>
                            Search documents and generate responses with context.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="mb-2 block text-sm font-medium">Query</label>
                            <Textarea
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                rows={2}
                                placeholder="What would you like to know?"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="generateResponse"
                                checked={generateResponse}
                                onChange={(e) => setGenerateResponse(e.target.checked)}
                            />
                            <label htmlFor="generateResponse" className="text-sm">
                                Generate response (vs search only)
                            </label>
                        </div>
                        <Button onClick={handleQuery} disabled={queryLoading}>
                            {queryLoading
                                ? "Searching..."
                                : generateResponse
                                  ? "Search & Generate"
                                  : "Search Only"}
                        </Button>
                        {queryResult && (
                            <div className="space-y-4">
                                {queryResult.response && (
                                    <div className="bg-primary/5 rounded-md p-4">
                                        <h4 className="mb-2 font-medium">Response:</h4>
                                        <p className="text-sm">{queryResult.response}</p>
                                    </div>
                                )}
                                <pre className="bg-muted max-h-64 overflow-auto rounded-md p-4 text-sm">
                                    {JSON.stringify(queryResult, null, 2)}
                                </pre>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
