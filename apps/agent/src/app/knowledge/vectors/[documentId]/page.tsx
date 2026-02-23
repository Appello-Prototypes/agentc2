"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
    Separator,
    Skeleton
} from "@repo/ui";
import {
    ArrowLeftIcon,
    ChevronDownIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ExternalLinkIcon
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface VectorChunk {
    vectorId: string;
    text: string;
    chunkIndex: number | null;
    metadata: Record<string, unknown>;
    vectorPreview: number[];
    vectorDimensions: number;
}

interface VectorDetailData {
    documentId: string;
    sourceName: string;
    firstIngestedAt: string | null;
    lastIngestedAt: string | null;
    managedDocument: { id: string; slug: string; name: string } | null;
    chunks: VectorChunk[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string | null): string {
    if (!dateStr) return "never";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "unknown";
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

// ── Main Component ────────────────────────────────────────────────────────────

export default function VectorDetailPage() {
    const params = useParams();
    const router = useRouter();
    const documentId = decodeURIComponent(params.documentId as string);

    const [data, setData] = useState<VectorDetailData | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const urlParams = new URLSearchParams();
            urlParams.set("page", String(page));
            urlParams.set("pageSize", "50");

            const res = await fetch(
                `${getApiBase()}/api/vectors/${encodeURIComponent(documentId)}?${urlParams.toString()}`
            );
            const json = await res.json();
            if (!res.ok) {
                console.error("Vector detail error:", json);
                return;
            }
            setData(json);
        } catch (error) {
            console.error("Failed to fetch vector detail:", error);
        } finally {
            setLoading(false);
        }
    }, [documentId, page]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (loading && !data) {
        return (
            <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-48" />
                <div className="mt-6 space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 w-full rounded-lg" />
                    ))}
                </div>
            </div>
        );
    }

    if (!data || data.total === 0) {
        return (
            <div className="flex h-96 items-center justify-center">
                <div className="text-center">
                    <h2 className="mb-2 text-xl font-semibold">
                        No vectors found for this document
                    </h2>
                    <p className="text-muted-foreground mb-4 font-mono text-sm">{documentId}</p>
                    <Button variant="outline" onClick={() => router.push("/knowledge")}>
                        Back to Knowledge Base
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto">
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
                            <h1 className="text-2xl font-bold">{data.sourceName}</h1>
                            <p className="text-muted-foreground font-mono text-sm">
                                {data.documentId}
                            </p>
                        </div>
                        {data.managedDocument && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    router.push(`/knowledge/${data.managedDocument!.id}`)
                                }
                            >
                                <ExternalLinkIcon className="mr-1 size-3.5" />
                                View Document
                            </Button>
                        )}
                    </div>

                    {/* Status badges */}
                    <div className="flex flex-wrap items-center gap-2">
                        {data.managedDocument ? (
                            <Badge variant="secondary">Managed</Badge>
                        ) : (
                            <Badge variant="outline" className="border-amber-500/50 text-amber-500">
                                Orphaned — no Document record
                            </Badge>
                        )}
                        <Badge variant="outline">
                            {data.total} chunk{data.total !== 1 ? "s" : ""}
                        </Badge>
                    </div>

                    {/* Stats */}
                    <div className="text-muted-foreground flex items-center gap-4 text-sm">
                        <span>First ingested: {formatRelativeTime(data.firstIngestedAt)}</span>
                        <span className="text-muted-foreground/30">|</span>
                        <span>Last ingested: {formatRelativeTime(data.lastIngestedAt)}</span>
                    </div>
                </div>

                <Separator />

                {/* Chunks list */}
                <div className="space-y-3">
                    <p className="text-muted-foreground text-sm">
                        {data.total} vector chunk{data.total !== 1 ? "s" : ""} stored in the
                        database. Each is independently searchable via semantic similarity.
                    </p>

                    {data.chunks.map((chunk) => (
                        <ChunkCard key={chunk.vectorId} chunk={chunk} />
                    ))}
                </div>

                {/* Pagination */}
                {data.totalPages > 1 && (
                    <div className="flex items-center justify-between">
                        <p className="text-muted-foreground text-sm">
                            Showing {(data.page - 1) * data.pageSize + 1}–
                            {Math.min(data.page * data.pageSize, data.total)} of {data.total}
                        </p>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => p - 1)}
                            >
                                <ChevronLeftIcon className="size-4" />
                            </Button>
                            <span className="text-muted-foreground px-3 text-sm tabular-nums">
                                {page} / {data.totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= data.totalPages}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                <ChevronRightIcon className="size-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Chunk Card ────────────────────────────────────────────────────────────────

function ChunkCard({ chunk }: { chunk: VectorChunk }) {
    const [expanded, setExpanded] = useState(false);
    const text = typeof chunk.text === "string" ? chunk.text : "";
    const charCount = text.length;

    return (
        <Card>
            <Collapsible open={expanded} onOpenChange={setExpanded}>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {chunk.chunkIndex !== null && (
                                <Badge variant="secondary" className="font-mono text-xs">
                                    #{chunk.chunkIndex}
                                </Badge>
                            )}
                            <span className="text-muted-foreground font-mono text-xs">
                                {chunk.vectorId}
                            </span>
                            {chunk.vectorDimensions > 0 && (
                                <Badge variant="outline" className="text-xs">
                                    {chunk.vectorDimensions}d
                                </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs">
                                {charCount.toLocaleString()} chars
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
                        {expanded ? text : text.slice(0, 200) + (text.length > 200 ? "…" : "")}
                    </p>
                    <CollapsibleContent>
                        {chunk.vectorDimensions > 0 && chunk.vectorPreview.length > 0 && (
                            <>
                                <Separator className="my-3" />
                                <div className="space-y-1">
                                    <p className="text-muted-foreground text-xs font-medium">
                                        Embedding Vector ({chunk.vectorDimensions} dimensions)
                                    </p>
                                    <pre className="bg-muted overflow-auto rounded p-3 font-mono text-xs">
                                        [
                                        {chunk.vectorPreview
                                            .map((v) =>
                                                typeof v === "number" ? v.toFixed(6) : String(v)
                                            )
                                            .join(", ")}
                                        {chunk.vectorDimensions > 10
                                            ? `, … ${chunk.vectorDimensions - 10} more`
                                            : ""}
                                        ]
                                    </pre>
                                </div>
                            </>
                        )}
                        <Separator className="my-3" />
                        <div className="space-y-1">
                            <p className="text-muted-foreground text-xs font-medium">Metadata</p>
                            <pre className="bg-muted overflow-auto rounded p-3 text-xs">
                                {JSON.stringify(excludeKey(chunk.metadata, "text"), null, 2)}
                            </pre>
                        </div>
                    </CollapsibleContent>
                </CardContent>
            </Collapsible>
        </Card>
    );
}

function excludeKey(obj: Record<string, unknown>, key: string): Record<string, unknown> {
    const result = { ...obj };
    delete result[key];
    return result;
}
