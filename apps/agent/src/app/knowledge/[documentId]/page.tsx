"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
    Input,
    Separator,
    Skeleton,
    Slider,
    Switch,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@repo/ui";
import {
    ArrowLeftIcon,
    ChevronDownIcon,
    RefreshCwIcon,
    SearchIcon,
    Trash2Icon
} from "lucide-react";

// ==========================================
// Types
// ==========================================

interface DocumentDetail {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    content: string;
    contentType: string;
    vectorIds: string[];
    chunkCount: number;
    embeddedAt: string | null;
    category: string | null;
    tags: string[];
    metadata: Record<string, unknown>;
    workspaceId: string | null;
    version: number;
    type: string;
    createdAt: string;
    updatedAt: string;
    createdBy: string | null;
}

interface ChunkData {
    id: string;
    score: number;
    text: string;
    chunkIndex: number;
    charCount: number;
    totalChunks: number;
    ingestedAt: string;
    documentId: string;
    sourceName: string;
    metadata: Record<string, unknown>;
    vectorDimensions: number;
    vectorPreview: number[];
}

interface SearchResult {
    text: string;
    score: number;
    metadata: Record<string, unknown>;
}

interface VersionData {
    id: string;
    documentId: string;
    version: number;
    content: string;
    changeSummary: string | null;
    createdAt: string;
    createdBy: string | null;
}

// ==========================================
// Helpers
// ==========================================

function formatRelativeTime(dateStr: string | null): string {
    if (!dateStr) return "never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

// ==========================================
// Main Component
// ==========================================

export default function DocumentDetailPage() {
    const params = useParams();
    const router = useRouter();
    const documentId = params.documentId as string;

    const [doc, setDoc] = useState<DocumentDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("content");

    // Chunks tab state
    const [chunks, setChunks] = useState<ChunkData[]>([]);
    const [chunksLoading, setChunksLoading] = useState(false);
    const [chunksLoaded, setChunksLoaded] = useState(false);

    // Search tab state
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [searchExecuted, setSearchExecuted] = useState(false);
    const [minScore, setMinScore] = useState(0.3);

    // Versions tab state
    const [versions, setVersions] = useState<VersionData[]>([]);
    const [versionsLoading, setVersionsLoading] = useState(false);
    const [versionsLoaded, setVersionsLoaded] = useState(false);

    // Content tab state
    const [showRaw, setShowRaw] = useState(false);

    // Fetch document detail
    useEffect(() => {
        async function fetchDoc() {
            try {
                const res = await fetch(`${getApiBase()}/api/documents/${documentId}`);
                const data = await res.json();
                if (data && data.id) {
                    setDoc(data);
                }
            } catch (error) {
                console.error("Failed to fetch document:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchDoc();
    }, [documentId]);

    // Lazy-load chunks when tab is first selected
    const [chunksError, setChunksError] = useState<string | null>(null);
    const loadChunks = useCallback(async () => {
        if (chunksLoaded || chunksLoading) return;
        setChunksLoading(true);
        setChunksError(null);
        try {
            const res = await fetch(`${getApiBase()}/api/documents/${documentId}/chunks`);
            const data = await res.json();
            if (!res.ok) {
                console.error("Chunks API error:", res.status, data);
                setChunksError(data.error || `Failed to load chunks (${res.status})`);
            } else if (data.chunks) {
                setChunks(data.chunks);
            }
        } catch (error) {
            console.error("Failed to fetch chunks:", error);
            setChunksError(error instanceof Error ? error.message : "Failed to fetch chunks");
        } finally {
            setChunksLoading(false);
            setChunksLoaded(true);
        }
    }, [documentId, chunksLoaded, chunksLoading]);

    // Lazy-load versions
    const loadVersions = useCallback(async () => {
        if (versionsLoaded || versionsLoading) return;
        setVersionsLoading(true);
        try {
            const res = await fetch(`${getApiBase()}/api/documents/${documentId}/versions`);
            const data = await res.json();
            if (data.versions) {
                setVersions(data.versions);
            }
        } catch (error) {
            console.error("Failed to fetch versions:", error);
        } finally {
            setVersionsLoading(false);
            setVersionsLoaded(true);
        }
    }, [documentId, versionsLoaded, versionsLoading]);

    // Handle tab change -- trigger lazy loading
    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        if (tab === "chunks") loadChunks();
        if (tab === "versions") loadVersions();
    };

    // Handle search
    const handleSearch = useCallback(async () => {
        if (!searchQuery.trim()) return;
        setSearchLoading(true);
        setSearchError(null);
        setSearchExecuted(true);
        try {
            const res = await fetch(`${getApiBase()}/api/documents/${documentId}/search`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: searchQuery,
                    topK: 10,
                    minScore
                })
            });
            const data = await res.json();
            if (!res.ok) {
                setSearchError(data.error || `Search failed (${res.status})`);
                setSearchResults([]);
                return;
            }
            if (data.results) {
                setSearchResults(data.results);
            } else {
                setSearchResults([]);
            }
        } catch (error) {
            console.error("Search failed:", error);
            setSearchError(
                error instanceof Error ? error.message : "Network error -- search request failed."
            );
            setSearchResults([]);
        } finally {
            setSearchLoading(false);
        }
    }, [documentId, searchQuery, minScore]);

    // Handle re-embed via dedicated endpoint (no version snapshot created)
    const [reembedding, setReembedding] = useState(false);
    const handleReembed = useCallback(async () => {
        if (!doc || reembedding) return;
        setReembedding(true);
        try {
            const res = await fetch(`${getApiBase()}/api/documents/${documentId}/reembed`, {
                method: "POST"
            });
            if (!res.ok) {
                const data = await res.json();
                alert(`Re-embed failed: ${data.error || "Unknown error"}`);
                return;
            }
            // Refresh the page to show updated embedding stats
            window.location.reload();
        } catch (error) {
            console.error("Re-embed failed:", error);
            alert("Re-embed failed. Check console for details.");
        } finally {
            setReembedding(false);
        }
    }, [doc, documentId, reembedding]);

    // Handle delete
    const handleDelete = useCallback(async () => {
        if (!confirm("Delete this document and all its embeddings? This cannot be undone.")) return;
        try {
            await fetch(`${getApiBase()}/api/documents/${documentId}`, { method: "DELETE" });
            router.push("/knowledge");
        } catch (error) {
            console.error("Delete failed:", error);
        }
    }, [documentId, router]);

    if (loading) {
        return (
            <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="mt-6 h-64 w-full" />
            </div>
        );
    }

    if (!doc) {
        return (
            <div className="flex h-96 items-center justify-center">
                <div className="text-center">
                    <h2 className="mb-2 text-xl font-semibold">Document Not Found</h2>
                    <Button variant="outline" onClick={() => router.push("/knowledge")}>
                        Back to Knowledge Base
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
            {/* Back navigation */}
            <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/knowledge")}
                className="text-muted-foreground -ml-2"
            >
                <ArrowLeftIcon className="mr-1 size-4" />
                Knowledge Base
            </Button>

            {/* Header */}
            <div className="space-y-3">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">{doc.name}</h1>
                        <p className="text-muted-foreground font-mono text-sm">{doc.slug}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleReembed}
                            disabled={reembedding}
                        >
                            <RefreshCwIcon
                                className={`mr-1 size-3.5 ${reembedding ? "animate-spin" : ""}`}
                            />
                            {reembedding ? "Re-embedding..." : "Re-embed"}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={handleDelete}>
                            <Trash2Icon className="mr-1 size-3.5" />
                            Delete
                        </Button>
                    </div>
                </div>

                {/* Badges row */}
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{doc.contentType}</Badge>
                    {doc.category && <Badge variant="outline">{doc.category}</Badge>}
                    <Badge variant="outline">v{doc.version}</Badge>
                    <Badge
                        variant={doc.type === "SYSTEM" ? "outline" : "default"}
                        className="text-xs"
                    >
                        {doc.type}
                    </Badge>
                    {doc.tags.map((tag) => (
                        <Badge
                            key={tag}
                            variant="outline"
                            className="text-muted-foreground text-xs"
                        >
                            {tag}
                        </Badge>
                    ))}
                </div>

                {/* Stats row */}
                <div className="text-muted-foreground flex items-center gap-4 text-sm">
                    <span>
                        <strong>{doc.chunkCount}</strong> chunk{doc.chunkCount !== 1 ? "s" : ""}
                    </span>
                    <span className="text-muted-foreground/30">|</span>
                    <span>
                        <strong>{doc.vectorIds.length}</strong> vector
                        {doc.vectorIds.length !== 1 ? "s" : ""}
                    </span>
                    <span className="text-muted-foreground/30">|</span>
                    <span>Embedded {formatRelativeTime(doc.embeddedAt)}</span>
                    <span className="text-muted-foreground/30">|</span>
                    <span>{doc.content.length.toLocaleString()} chars</span>
                    <span className="text-muted-foreground/30">|</span>
                    <span>~{estimateTokens(doc.content).toLocaleString()} tokens</span>
                </div>
            </div>

            <Separator />

            {/* Tabs */}
            <Tabs defaultValue="content" value={activeTab} onValueChange={handleTabChange}>
                <TabsList>
                    <TabsTrigger value="content">Content</TabsTrigger>
                    <TabsTrigger value="chunks">Chunks ({doc.chunkCount})</TabsTrigger>
                    <TabsTrigger value="search">Search</TabsTrigger>
                    <TabsTrigger value="versions">Versions ({doc.version})</TabsTrigger>
                </TabsList>

                {/* ==================== Content Tab ==================== */}
                <TabsContent value="content" className="mt-4">
                    <div className="mb-3 flex items-center gap-2">
                        <Switch id="raw-toggle" checked={showRaw} onCheckedChange={setShowRaw} />
                        <label
                            htmlFor="raw-toggle"
                            className="text-muted-foreground cursor-pointer text-sm"
                        >
                            {showRaw ? "Raw" : "Rendered"}
                        </label>
                    </div>

                    {showRaw || doc.contentType !== "markdown" ? (
                        <pre className="bg-muted max-h-[600px] overflow-auto rounded-lg p-4 text-sm whitespace-pre-wrap">
                            {doc.content}
                        </pre>
                    ) : (
                        <div
                            className="prose prose-invert max-h-[600px] max-w-none overflow-auto rounded-lg border p-6"
                            dangerouslySetInnerHTML={{
                                __html: simpleMarkdownToHtml(doc.content)
                            }}
                        />
                    )}
                </TabsContent>

                {/* ==================== Chunks Tab ==================== */}
                <TabsContent value="chunks" className="mt-4">
                    {chunksLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-32 w-full rounded-lg" />
                            ))}
                        </div>
                    ) : chunksError ? (
                        <Card>
                            <CardContent className="py-8 text-center">
                                <p className="text-destructive font-medium">
                                    Error loading chunks: {chunksError}
                                </p>
                            </CardContent>
                        </Card>
                    ) : chunks.length === 0 ? (
                        <Card>
                            <CardContent className="py-8 text-center">
                                <p className="text-muted-foreground">
                                    No chunks found in the vector store.
                                    {!chunksLoaded && " Click the Chunks tab to load."}
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-muted-foreground text-sm">
                                {chunks.length} chunk{chunks.length !== 1 ? "s" : ""} stored in the
                                vector database. Each chunk is independently searchable.
                            </p>
                            {chunks.map((chunk) => (
                                <ChunkCard key={chunk.id} chunk={chunk} />
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* ==================== Search Tab ==================== */}
                <TabsContent value="search" className="mt-4 space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Semantic Search Tester</CardTitle>
                            <CardDescription>
                                Type a query to see which chunks match and their similarity scores.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="What would you like to find?"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleSearch();
                                    }}
                                    className="flex-1"
                                />
                                <Button
                                    onClick={handleSearch}
                                    disabled={searchLoading || !searchQuery.trim()}
                                >
                                    <SearchIcon className="mr-1 size-4" />
                                    Search
                                </Button>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-muted-foreground text-xs">Min Score:</span>
                                <Slider
                                    value={[minScore]}
                                    onValueChange={(v) => {
                                        const arr = Array.isArray(v) ? v : [v];
                                        setMinScore(arr[0] ?? 0.3);
                                    }}
                                    min={0}
                                    max={1}
                                    step={0.05}
                                    className="w-48"
                                />
                                <span className="font-mono text-xs">{minScore.toFixed(2)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {searchLoading && (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-24 w-full rounded-lg" />
                            ))}
                        </div>
                    )}

                    {!searchLoading && searchError && (
                        <Card className="border-destructive/50">
                            <CardContent className="py-6 text-center">
                                <p className="text-destructive text-sm font-medium">
                                    Search failed
                                </p>
                                <p className="text-muted-foreground mt-1 text-xs">{searchError}</p>
                            </CardContent>
                        </Card>
                    )}

                    {!searchLoading && !searchError && searchResults.length > 0 && (
                        <div className="space-y-3">
                            <p className="text-muted-foreground text-sm">
                                {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
                            </p>
                            {searchResults.map((result, i) => (
                                <SearchResultCard key={i} result={result} rank={i + 1} />
                            ))}
                        </div>
                    )}

                    {!searchLoading &&
                        !searchError &&
                        searchResults.length === 0 &&
                        searchExecuted && (
                            <Card>
                                <CardContent className="py-8 text-center">
                                    <p className="text-muted-foreground">
                                        No results found. Try a different query or lower the minimum
                                        score (currently {minScore.toFixed(2)}).
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                </TabsContent>

                {/* ==================== Versions Tab ==================== */}
                <TabsContent value="versions" className="mt-4">
                    {versionsLoading ? (
                        <div className="space-y-3">
                            {[1, 2].map((i) => (
                                <Skeleton key={i} className="h-24 w-full rounded-lg" />
                            ))}
                        </div>
                    ) : versions.length === 0 ? (
                        <Card>
                            <CardContent className="py-8 text-center">
                                <p className="text-muted-foreground">
                                    {doc.version === 1
                                        ? "This is the first version. No previous versions exist."
                                        : "No version history available."}
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-muted-foreground text-sm">
                                Current version: <strong>v{doc.version}</strong>. Showing{" "}
                                {versions.length} previous version{versions.length !== 1 ? "s" : ""}
                                .
                            </p>
                            {versions.map((v) => (
                                <VersionCard key={v.id} version={v} />
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

// ==========================================
// Sub-Components
// ==========================================

function ChunkCard({ chunk }: { chunk: ChunkData }) {
    const [expanded, setExpanded] = useState(false);
    const isVectorized = chunk.vectorDimensions > 0;

    return (
        <Card>
            <Collapsible open={expanded} onOpenChange={setExpanded}>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Badge variant="secondary" className="font-mono text-xs">
                                #{chunk.chunkIndex}
                            </Badge>
                            <span className="text-muted-foreground font-mono text-xs">
                                {chunk.id}
                            </span>
                            {isVectorized && (
                                <Badge variant="outline" className="text-xs">
                                    {chunk.vectorDimensions}d
                                </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs">
                                {chunk.charCount} chars
                            </span>
                            <CollapsibleTrigger className="hover:bg-accent rounded p-1">
                                <ChevronDownIcon
                                    className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                                />
                            </CollapsibleTrigger>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-sm leading-relaxed">
                        {expanded
                            ? chunk.text
                            : chunk.text.slice(0, 200) + (chunk.text.length > 200 ? "..." : "")}
                    </p>
                    <CollapsibleContent>
                        {isVectorized && (
                            <>
                                <Separator className="my-3" />
                                <div className="space-y-1">
                                    <p className="text-muted-foreground text-xs font-medium">
                                        Embedding Vector ({chunk.vectorDimensions} dimensions)
                                    </p>
                                    <pre className="bg-muted overflow-auto rounded p-3 font-mono text-xs">
                                        [{chunk.vectorPreview.map((v) => v.toFixed(6)).join(", ")}
                                        {chunk.vectorDimensions > 10
                                            ? `, ... ${chunk.vectorDimensions - 10} more`
                                            : ""}
                                        ]
                                    </pre>
                                </div>
                            </>
                        )}
                        <Separator className="my-3" />
                        <div className="space-y-1">
                            <p className="text-muted-foreground text-xs font-medium">
                                Vector Metadata
                            </p>
                            <pre className="bg-muted overflow-auto rounded p-3 text-xs">
                                {JSON.stringify(chunk.metadata, null, 2)}
                            </pre>
                        </div>
                    </CollapsibleContent>
                </CardContent>
            </Collapsible>
        </Card>
    );
}

function SearchResultCard({ result, rank }: { result: SearchResult; rank: number }) {
    const scorePercent = (result.score * 100).toFixed(1);
    const [expanded, setExpanded] = useState(false);

    return (
        <Card>
            <Collapsible open={expanded} onOpenChange={setExpanded}>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Badge variant="secondary">#{rank}</Badge>
                            <div className="flex items-center gap-2">
                                <div className="bg-muted h-2 w-24 overflow-hidden rounded-full">
                                    <div
                                        className="bg-primary h-full rounded-full transition-all"
                                        style={{
                                            width: `${Math.min(parseFloat(scorePercent), 100)}%`
                                        }}
                                    />
                                </div>
                                <span className="font-mono text-sm font-medium">
                                    {scorePercent}%
                                </span>
                            </div>
                        </div>
                        <CollapsibleTrigger className="hover:bg-accent rounded p-1">
                            <ChevronDownIcon
                                className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                            />
                        </CollapsibleTrigger>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-sm leading-relaxed">
                        {expanded
                            ? result.text
                            : result.text.slice(0, 300) + (result.text.length > 300 ? "..." : "")}
                    </p>
                    <CollapsibleContent>
                        <Separator className="my-3" />
                        <pre className="bg-muted overflow-auto rounded p-3 text-xs">
                            {JSON.stringify(result.metadata, null, 2)}
                        </pre>
                    </CollapsibleContent>
                </CardContent>
            </Collapsible>
        </Card>
    );
}

function VersionCard({ version }: { version: VersionData }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <Card>
            <Collapsible open={expanded} onOpenChange={setExpanded}>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Badge variant="outline">v{version.version}</Badge>
                            <span className="text-muted-foreground text-sm">
                                {version.changeSummary || "No change summary"}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs">
                                {formatRelativeTime(version.createdAt)}
                            </span>
                            <CollapsibleTrigger className="hover:bg-accent rounded p-1">
                                <ChevronDownIcon
                                    className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                                />
                            </CollapsibleTrigger>
                        </div>
                    </div>
                </CardHeader>
                <CollapsibleContent>
                    <CardContent>
                        <pre className="bg-muted max-h-96 overflow-auto rounded-lg p-4 text-sm whitespace-pre-wrap">
                            {version.content}
                        </pre>
                    </CardContent>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
}

// ==========================================
// Simple Markdown-to-HTML (no dependency)
// ==========================================

function simpleMarkdownToHtml(md: string): string {
    return md
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/^### (.+)$/gm, "<h3>$1</h3>")
        .replace(/^## (.+)$/gm, "<h2>$1</h2>")
        .replace(/^# (.+)$/gm, "<h1>$1</h1>")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/`(.+?)`/g, "<code>$1</code>")
        .replace(/^- (.+)$/gm, "<li>$1</li>")
        .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
        .replace(/\n\n/g, "</p><p>")
        .replace(/^/, "<p>")
        .replace(/$/, "</p>");
}
