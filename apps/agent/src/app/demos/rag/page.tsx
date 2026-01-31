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
    Input,
    Badge,
    Separator,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
    Switch,
    Label,
    Slider,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Alert,
    AlertDescription,
    AlertTitle,
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger
} from "@repo/ui";

// Sample documents for quick experimentation
const SAMPLE_DOCUMENTS = [
    {
        name: "Mastra Framework Overview",
        type: "markdown",
        content: `# Mastra AI Framework

Mastra is a TypeScript framework for building AI applications. It provides a unified interface for working with multiple AI providers and includes powerful features for building production-ready AI systems.

## Core Features

### Model Routing
Mastra supports 40+ AI providers through a unified API. You can switch between OpenAI, Anthropic, Google, and many others without changing your application code.

### Agent System
Agents are autonomous AI entities that can use tools, maintain memory, and execute complex multi-step tasks. They support:
- Tool calling with structured inputs/outputs
- Memory persistence across conversations
- Semantic recall for context retrieval

### Workflow Engine
A graph-based workflow system for orchestrating complex AI operations:
- Sequential and parallel execution
- Conditional branching
- Human-in-the-loop approval steps
- Error handling and retries

### RAG Pipeline
Built-in support for Retrieval-Augmented Generation:
- Document chunking strategies
- Vector embedding and storage
- Semantic similarity search
- Context-aware generation`
    },
    {
        name: "Product Catalog",
        type: "json",
        content: JSON.stringify(
            {
                products: [
                    {
                        id: "laptop-001",
                        name: "ProBook X15",
                        category: "Laptops",
                        price: 1299.99,
                        specs: {
                            cpu: "Intel i7-12700H",
                            ram: "16GB DDR5",
                            storage: "512GB NVMe SSD",
                            display: "15.6 inch 1080p IPS"
                        },
                        description:
                            "Professional laptop for developers and designers with excellent build quality."
                    },
                    {
                        id: "headphones-002",
                        name: "SoundWave Pro",
                        category: "Audio",
                        price: 349.99,
                        specs: {
                            type: "Over-ear",
                            driver: "40mm",
                            connectivity: "Bluetooth 5.2",
                            battery: "30 hours"
                        },
                        description:
                            "Premium noise-cancelling headphones with spatial audio support."
                    }
                ]
            },
            null,
            2
        )
    },
    {
        name: "Company FAQ",
        type: "text",
        content: `Frequently Asked Questions

Q: What are your business hours?
A: We are open Monday through Friday, 9 AM to 6 PM Eastern Time. Our customer support team is available 24/7 via email.

Q: How do I reset my password?
A: Click on "Forgot Password" on the login page. Enter your email address and we'll send you a reset link within 5 minutes.

Q: What payment methods do you accept?
A: We accept all major credit cards (Visa, MasterCard, American Express), PayPal, and bank transfers for orders over $500.

Q: What is your return policy?
A: We offer a 30-day money-back guarantee on all products. Items must be in original condition with packaging. Digital products are non-refundable after download.

Q: Do you offer enterprise pricing?
A: Yes! Contact our sales team at sales@example.com for volume discounts and custom enterprise solutions.`
    }
];

// Example queries for testing
const EXAMPLE_QUERIES = [
    "What is Mastra?",
    "How does the workflow engine work?",
    "What AI providers are supported?",
    "What are the core features?",
    "How does RAG work in Mastra?",
    "Tell me about the agent system"
];

interface IngestResult {
    documentId?: string;
    chunksIngested?: number;
    vectorIds?: string[];
    error?: string;
}

interface RagChunk {
    text: string;
    score: number;
    metadata?: Record<string, unknown>;
}

interface QueryResult {
    response?: string;
    sources?: Array<{ text: string; score: number; documentId?: string }>;
    results?: RagChunk[];
    error?: string;
}

interface DocumentInfo {
    documentId: string;
    sourceName: string;
    chunkCount: number;
    ingestedAt: string;
}

// Helper to format score as percentage
function formatScore(score: number): string {
    return `${(score * 100).toFixed(1)}%`;
}

// Helper to get score color
function getScoreColor(score: number): string {
    if (score >= 0.8) return "text-green-600 dark:text-green-400";
    if (score >= 0.6) return "text-yellow-600 dark:text-yellow-400";
    return "text-orange-600 dark:text-orange-400";
}

export default function RagDemoPage() {
    // Document ingestion state
    const [content, setContent] = useState(SAMPLE_DOCUMENTS[0].content);
    const [docType, setDocType] = useState<string>(SAMPLE_DOCUMENTS[0].type);
    const [sourceName, setSourceName] = useState(SAMPLE_DOCUMENTS[0].name);
    const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
    const [ingestLoading, setIngestLoading] = useState(false);

    // Chunking options
    const [chunkStrategy, setChunkStrategy] = useState<string>("recursive");
    const [chunkSize, setChunkSize] = useState(512);
    const [chunkOverlap, setChunkOverlap] = useState(50);
    const [showAdvancedChunking, setShowAdvancedChunking] = useState(false);

    // Query state
    const [query, setQuery] = useState("What is Mastra?");
    const [generateResponse, setGenerateResponse] = useState(true);
    const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
    const [queryLoading, setQueryLoading] = useState(false);

    // Query options
    const [topK, setTopK] = useState(5);
    const [minScore, setMinScore] = useState(0.5);
    const [showAdvancedQuery, setShowAdvancedQuery] = useState(false);

    // Document management
    const [documents, setDocuments] = useState<DocumentInfo[]>([]);
    const [documentsLoading, setDocumentsLoading] = useState(false);

    // View toggles
    const [showRawJson, setShowRawJson] = useState(false);

    // Track whether documents have been loaded (for lazy loading on tab switch)
    const [documentsLoaded, setDocumentsLoaded] = useState(false);

    const loadDocuments = async () => {
        setDocumentsLoading(true);
        try {
            const res = await fetch("/api/rag/documents");
            const data = await res.json();
            setDocuments(data.documents || []);
            setDocumentsLoaded(true);
        } catch {
            console.error("Failed to load documents");
        }
        setDocumentsLoading(false);
    };

    const handleTabChange = (value: string) => {
        if (value === "manage" && !documentsLoaded) {
            void loadDocuments();
        }
    };

    const handleIngest = async () => {
        setIngestLoading(true);
        setIngestResult(null);
        try {
            const res = await fetch("/api/rag/ingest", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content,
                    type: docType,
                    sourceName,
                    chunkOptions: {
                        strategy: chunkStrategy,
                        maxSize: chunkSize,
                        overlap: chunkOverlap
                    }
                })
            });
            const data = await res.json();
            setIngestResult(data);
            if (!data.error) {
                loadDocuments(); // Refresh document list
            }
        } catch {
            setIngestResult({ error: "Failed to ingest document" });
        }
        setIngestLoading(false);
    };

    const handleQuery = async () => {
        setQueryLoading(true);
        setQueryResult(null);
        try {
            const res = await fetch("/api/rag/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query,
                    generateResponse,
                    topK,
                    minScore
                })
            });
            const data = await res.json();
            setQueryResult(data);
        } catch {
            setQueryResult({ error: "Failed to query" });
        }
        setQueryLoading(false);
    };

    const handleDeleteDocument = async (documentId: string) => {
        try {
            await fetch("/api/rag/documents", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ documentId })
            });
            loadDocuments();
        } catch {
            console.error("Failed to delete document");
        }
    };

    const loadSampleDocument = (index: number) => {
        const doc = SAMPLE_DOCUMENTS[index];
        setContent(doc.content);
        setDocType(doc.type);
        setSourceName(doc.name);
    };

    return (
        <TooltipProvider>
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="mb-2 text-3xl font-bold">RAG Pipeline Demo</h1>
                    <p className="text-muted-foreground max-w-3xl">
                        Explore Retrieval-Augmented Generation (RAG) - a technique that enhances AI
                        responses by retrieving relevant context from your documents. Ingest
                        documents, experiment with chunking strategies, and query with semantic
                        search.
                    </p>
                </div>

                {/* How RAG Works */}
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="how-it-works">
                        <AccordionTrigger className="text-lg font-semibold">
                            How does RAG work?
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className="grid gap-4 md:grid-cols-4">
                                <Card className="border-dashed">
                                    <CardHeader className="pb-2">
                                        <Badge variant="outline" className="mb-2 w-fit">
                                            Step 1
                                        </Badge>
                                        <CardTitle className="text-base">
                                            Document Ingestion
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-muted-foreground text-sm">
                                        Documents are split into smaller chunks based on the
                                        selected strategy (recursive, sentence, etc.)
                                    </CardContent>
                                </Card>
                                <Card className="border-dashed">
                                    <CardHeader className="pb-2">
                                        <Badge variant="outline" className="mb-2 w-fit">
                                            Step 2
                                        </Badge>
                                        <CardTitle className="text-base">Embedding</CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-muted-foreground text-sm">
                                        Each chunk is converted to a vector embedding using AI
                                        (text-embedding-3-small)
                                    </CardContent>
                                </Card>
                                <Card className="border-dashed">
                                    <CardHeader className="pb-2">
                                        <Badge variant="outline" className="mb-2 w-fit">
                                            Step 3
                                        </Badge>
                                        <CardTitle className="text-base">Vector Search</CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-muted-foreground text-sm">
                                        Your query is embedded and compared against stored chunks
                                        using cosine similarity
                                    </CardContent>
                                </Card>
                                <Card className="border-dashed">
                                    <CardHeader className="pb-2">
                                        <Badge variant="outline" className="mb-2 w-fit">
                                            Step 4
                                        </Badge>
                                        <CardTitle className="text-base">Generation</CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-muted-foreground text-sm">
                                        Retrieved chunks are injected as context for the AI to
                                        generate an informed response
                                    </CardContent>
                                </Card>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>

                <Tabs defaultValue="ingest" className="w-full" onValueChange={handleTabChange}>
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="ingest">1. Ingest Documents</TabsTrigger>
                        <TabsTrigger value="query">2. Query & Generate</TabsTrigger>
                        <TabsTrigger value="manage">3. Manage Documents</TabsTrigger>
                    </TabsList>

                    {/* Ingest Tab */}
                    <TabsContent value="ingest" className="mt-6 space-y-6">
                        <div className="grid gap-6 lg:grid-cols-2">
                            {/* Document Input */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Document Content</CardTitle>
                                    <CardDescription>
                                        Paste or select sample content to ingest into the vector
                                        store
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* Sample Documents */}
                                    <div>
                                        <Label className="mb-2 block text-sm">
                                            Quick Start - Load Sample
                                        </Label>
                                        <div className="flex flex-wrap gap-2">
                                            {SAMPLE_DOCUMENTS.map((doc, i) => (
                                                <Button
                                                    key={i}
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => loadSampleDocument(i)}
                                                >
                                                    {doc.name}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    <Separator />

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label className="mb-2 block text-sm">
                                                Document Type
                                            </Label>
                                            <Select value={docType} onValueChange={setDocType}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="text">Plain Text</SelectItem>
                                                    <SelectItem value="markdown">
                                                        Markdown
                                                    </SelectItem>
                                                    <SelectItem value="html">HTML</SelectItem>
                                                    <SelectItem value="json">JSON</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label className="mb-2 block text-sm">
                                                Source Name
                                            </Label>
                                            <Input
                                                value={sourceName}
                                                onChange={(e) => setSourceName(e.target.value)}
                                                placeholder="Document name..."
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <Label className="mb-2 block text-sm">Content</Label>
                                        <Textarea
                                            value={content}
                                            onChange={(e) => setContent(e.target.value)}
                                            rows={12}
                                            className="font-mono text-sm"
                                            placeholder="Paste document content here..."
                                        />
                                        <p className="text-muted-foreground mt-1 text-xs">
                                            {content.length} characters
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Chunking Configuration */}
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle>Chunking Configuration</CardTitle>
                                            <CardDescription>
                                                Control how documents are split into searchable
                                                chunks
                                            </CardDescription>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Switch
                                                id="advanced-chunking"
                                                checked={showAdvancedChunking}
                                                onCheckedChange={setShowAdvancedChunking}
                                            />
                                            <Label htmlFor="advanced-chunking" className="text-sm">
                                                Advanced
                                            </Label>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div>
                                        <Label className="mb-2 block text-sm">
                                            Chunking Strategy
                                        </Label>
                                        <Select
                                            value={chunkStrategy}
                                            onValueChange={setChunkStrategy}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="recursive">
                                                    Recursive (Recommended)
                                                </SelectItem>
                                                <SelectItem value="sentence">
                                                    Sentence-based
                                                </SelectItem>
                                                <SelectItem value="markdown">
                                                    Markdown-aware
                                                </SelectItem>
                                                <SelectItem value="character">
                                                    Character-based
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-muted-foreground mt-1 text-xs">
                                            {chunkStrategy === "recursive" &&
                                                "Smart splitting based on content structure (paragraphs, sentences)"}
                                            {chunkStrategy === "sentence" &&
                                                "Preserves sentence boundaries for natural text"}
                                            {chunkStrategy === "markdown" &&
                                                "Respects markdown structure (headers, lists, code blocks)"}
                                            {chunkStrategy === "character" &&
                                                "Simple character-based splitting with overlap"}
                                        </p>
                                    </div>

                                    {showAdvancedChunking && (
                                        <>
                                            <div>
                                                <div className="mb-2 flex items-center justify-between">
                                                    <Label className="text-sm">
                                                        Chunk Size: {chunkSize} chars
                                                    </Label>
                                                    <Tooltip>
                                                        <TooltipTrigger>
                                                            <Badge
                                                                variant="secondary"
                                                                className="text-xs"
                                                            >
                                                                ?
                                                            </Badge>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="max-w-xs">
                                                            Maximum characters per chunk. Smaller
                                                            chunks = more precise retrieval. Larger
                                                            chunks = more context per result.
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </div>
                                                <Slider
                                                    value={[chunkSize]}
                                                    onValueChange={([v]) => setChunkSize(v)}
                                                    min={128}
                                                    max={2048}
                                                    step={64}
                                                />
                                                <div className="text-muted-foreground mt-1 flex justify-between text-xs">
                                                    <span>128 (precise)</span>
                                                    <span>2048 (broad)</span>
                                                </div>
                                            </div>

                                            <div>
                                                <div className="mb-2 flex items-center justify-between">
                                                    <Label className="text-sm">
                                                        Overlap: {chunkOverlap} chars
                                                    </Label>
                                                    <Tooltip>
                                                        <TooltipTrigger>
                                                            <Badge
                                                                variant="secondary"
                                                                className="text-xs"
                                                            >
                                                                ?
                                                            </Badge>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="max-w-xs">
                                                            Characters shared between adjacent
                                                            chunks. Overlap helps maintain context
                                                            across chunk boundaries.
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </div>
                                                <Slider
                                                    value={[chunkOverlap]}
                                                    onValueChange={([v]) => setChunkOverlap(v)}
                                                    min={0}
                                                    max={200}
                                                    step={10}
                                                />
                                                <div className="text-muted-foreground mt-1 flex justify-between text-xs">
                                                    <span>0 (no overlap)</span>
                                                    <span>200 (high overlap)</span>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    <Separator />

                                    <div>
                                        <Button
                                            onClick={handleIngest}
                                            disabled={ingestLoading || !content.trim()}
                                            className="w-full"
                                            size="lg"
                                        >
                                            {ingestLoading ? (
                                                <>
                                                    <span className="mr-2 animate-spin">⏳</span>
                                                    Chunking & Embedding...
                                                </>
                                            ) : (
                                                "Ingest Document"
                                            )}
                                        </Button>
                                    </div>

                                    {/* Ingest Result */}
                                    {ingestResult && (
                                        <Alert
                                            variant={ingestResult.error ? "destructive" : "default"}
                                        >
                                            <AlertTitle>
                                                {ingestResult.error
                                                    ? "Ingestion Failed"
                                                    : "Successfully Ingested!"}
                                            </AlertTitle>
                                            <AlertDescription>
                                                {ingestResult.error ? (
                                                    ingestResult.error
                                                ) : (
                                                    <div className="mt-2 space-y-1">
                                                        <p>
                                                            <strong>Document ID:</strong>{" "}
                                                            <code className="text-xs">
                                                                {ingestResult.documentId}
                                                            </code>
                                                        </p>
                                                        <p>
                                                            <strong>Chunks Created:</strong>{" "}
                                                            {ingestResult.chunksIngested}
                                                        </p>
                                                        {showRawJson && (
                                                            <pre className="bg-muted mt-2 overflow-auto rounded p-2 text-xs">
                                                                {JSON.stringify(
                                                                    ingestResult,
                                                                    null,
                                                                    2
                                                                )}
                                                            </pre>
                                                        )}
                                                    </div>
                                                )}
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* Query Tab */}
                    <TabsContent value="query" className="mt-6 space-y-6">
                        <div className="grid gap-6 lg:grid-cols-2">
                            {/* Query Input */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Search & Generate</CardTitle>
                                    <CardDescription>
                                        Query your ingested documents using semantic search
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* Example Queries */}
                                    <div>
                                        <Label className="mb-2 block text-sm">
                                            Try Example Queries
                                        </Label>
                                        <div className="flex flex-wrap gap-2">
                                            {EXAMPLE_QUERIES.map((q, i) => (
                                                <Button
                                                    key={i}
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setQuery(q)}
                                                >
                                                    {q}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    <Separator />

                                    <div>
                                        <Label className="mb-2 block text-sm">Your Query</Label>
                                        <Textarea
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                            rows={3}
                                            placeholder="What would you like to know?"
                                        />
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                            <Switch
                                                id="generate-response"
                                                checked={generateResponse}
                                                onCheckedChange={setGenerateResponse}
                                            />
                                            <Label htmlFor="generate-response" className="text-sm">
                                                Generate AI Response
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Switch
                                                id="advanced-query"
                                                checked={showAdvancedQuery}
                                                onCheckedChange={setShowAdvancedQuery}
                                            />
                                            <Label htmlFor="advanced-query" className="text-sm">
                                                Advanced
                                            </Label>
                                        </div>
                                    </div>

                                    {showAdvancedQuery && (
                                        <div className="bg-muted/50 space-y-4 rounded-lg p-4">
                                            <div>
                                                <div className="mb-2 flex items-center justify-between">
                                                    <Label className="text-sm">Top K: {topK}</Label>
                                                    <Tooltip>
                                                        <TooltipTrigger>
                                                            <Badge
                                                                variant="secondary"
                                                                className="text-xs"
                                                            >
                                                                ?
                                                            </Badge>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="max-w-xs">
                                                            Number of most relevant chunks to
                                                            retrieve
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </div>
                                                <Slider
                                                    value={[topK]}
                                                    onValueChange={([v]) => setTopK(v)}
                                                    min={1}
                                                    max={20}
                                                    step={1}
                                                />
                                            </div>

                                            <div>
                                                <div className="mb-2 flex items-center justify-between">
                                                    <Label className="text-sm">
                                                        Min Score: {formatScore(minScore)}
                                                    </Label>
                                                    <Tooltip>
                                                        <TooltipTrigger>
                                                            <Badge
                                                                variant="secondary"
                                                                className="text-xs"
                                                            >
                                                                ?
                                                            </Badge>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="max-w-xs">
                                                            Minimum similarity score threshold.
                                                            Higher = more relevant but fewer
                                                            results.
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </div>
                                                <Slider
                                                    value={[minScore]}
                                                    onValueChange={([v]) => setMinScore(v)}
                                                    min={0}
                                                    max={1}
                                                    step={0.05}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <Button
                                        onClick={handleQuery}
                                        disabled={queryLoading || !query.trim()}
                                        className="w-full"
                                        size="lg"
                                    >
                                        {queryLoading ? (
                                            <>
                                                <span className="mr-2 animate-spin">⏳</span>
                                                {generateResponse
                                                    ? "Searching & Generating..."
                                                    : "Searching..."}
                                            </>
                                        ) : generateResponse ? (
                                            "Search & Generate"
                                        ) : (
                                            "Search Only"
                                        )}
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* Query Results */}
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle>Results</CardTitle>
                                            <CardDescription>
                                                {generateResponse
                                                    ? "AI response with source citations"
                                                    : "Retrieved chunks ranked by similarity"}
                                            </CardDescription>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Switch
                                                id="show-raw"
                                                checked={showRawJson}
                                                onCheckedChange={setShowRawJson}
                                            />
                                            <Label htmlFor="show-raw" className="text-sm">
                                                Raw JSON
                                            </Label>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {queryLoading ? (
                                        <div className="flex items-center justify-center py-12">
                                            <div className="text-muted-foreground text-center">
                                                <div className="mb-2 text-4xl">🔍</div>
                                                <p>Searching vector store...</p>
                                            </div>
                                        </div>
                                    ) : queryResult ? (
                                        <div className="space-y-4">
                                            {queryResult.error ? (
                                                <Alert variant="destructive">
                                                    <AlertTitle>Query Failed</AlertTitle>
                                                    <AlertDescription>
                                                        {queryResult.error}
                                                    </AlertDescription>
                                                </Alert>
                                            ) : (
                                                <>
                                                    {/* Generated Response */}
                                                    {queryResult.response && (
                                                        <div className="bg-primary/5 rounded-lg p-4">
                                                            <div className="mb-2 flex items-center gap-2">
                                                                <Badge>AI Response</Badge>
                                                            </div>
                                                            <p className="text-sm leading-relaxed">
                                                                {queryResult.response}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {/* Sources / Retrieved Chunks */}
                                                    {(queryResult.sources ||
                                                        queryResult.results) && (
                                                        <div>
                                                            <h4 className="mb-3 text-sm font-medium">
                                                                {queryResult.sources
                                                                    ? "Source Citations"
                                                                    : "Retrieved Chunks"}
                                                            </h4>
                                                            <div className="space-y-2">
                                                                {(
                                                                    queryResult.sources ||
                                                                    queryResult.results
                                                                )?.map((chunk, i) => (
                                                                    <div
                                                                        key={i}
                                                                        className="bg-muted/50 rounded-lg p-3"
                                                                    >
                                                                        <div className="mb-1 flex items-center justify-between">
                                                                            <Badge
                                                                                variant="outline"
                                                                                className="text-xs"
                                                                            >
                                                                                Source {i + 1}
                                                                            </Badge>
                                                                            <span
                                                                                className={`text-sm font-medium ${getScoreColor(chunk.score)}`}
                                                                            >
                                                                                {formatScore(
                                                                                    chunk.score
                                                                                )}{" "}
                                                                                match
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-muted-foreground text-sm">
                                                                            {chunk.text}
                                                                        </p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Raw JSON */}
                                                    {showRawJson && (
                                                        <pre className="bg-muted max-h-64 overflow-auto rounded-lg p-4 text-xs">
                                                            {JSON.stringify(queryResult, null, 2)}
                                                        </pre>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center py-12">
                                            <div className="text-muted-foreground text-center">
                                                <div className="mb-2 text-4xl">📄</div>
                                                <p>Enter a query to search your documents</p>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* Manage Tab */}
                    <TabsContent value="manage" className="mt-6">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>Document Index</CardTitle>
                                        <CardDescription>
                                            View and manage documents in the vector store
                                        </CardDescription>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={loadDocuments}
                                        disabled={documentsLoading}
                                    >
                                        {documentsLoading ? "Loading..." : "Refresh"}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {documentsLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="text-muted-foreground text-center">
                                            <div className="mb-2 text-4xl">⏳</div>
                                            <p>Loading documents...</p>
                                        </div>
                                    </div>
                                ) : documents.length === 0 ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="text-muted-foreground text-center">
                                            <div className="mb-2 text-4xl">📭</div>
                                            <p className="mb-4">No documents ingested yet</p>
                                            <Button
                                                variant="outline"
                                                onClick={() => {
                                                    const tab = document.querySelector(
                                                        '[data-state="inactive"][value="ingest"]'
                                                    ) as HTMLElement;
                                                    tab?.click();
                                                }}
                                            >
                                                Go to Ingest Tab
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {documents.map((doc) => (
                                            <div
                                                key={doc.documentId}
                                                className="bg-muted/50 flex items-center justify-between rounded-lg p-4"
                                            >
                                                <div>
                                                    <h4 className="font-medium">
                                                        {doc.sourceName}
                                                    </h4>
                                                    <p className="text-muted-foreground text-sm">
                                                        {doc.chunkCount} chunks • ID:{" "}
                                                        <code className="text-xs">
                                                            {doc.documentId}
                                                        </code>
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() =>
                                                        handleDeleteDocument(doc.documentId)
                                                    }
                                                >
                                                    Delete
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </TooltipProvider>
    );
}
