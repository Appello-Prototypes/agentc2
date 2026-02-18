"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { CanvasRenderer, type CanvasSchemaForRenderer } from "@repo/ui/components/canvas";
import { getApiBase } from "@/lib/utils";
import { Skeleton, Button, Badge } from "@repo/ui";
import {
    RefreshCwIcon,
    ArrowLeftIcon,
    Share2Icon,
    PencilIcon,
    TrashIcon,
    CodeIcon,
    XIcon
} from "lucide-react";
import Link from "next/link";

type DebugTab = "schema" | "data" | "info";

interface CanvasMeta {
    id: string;
    slug: string;
    version: number;
    isPublished: boolean;
    isActive: boolean;
    isPublic: boolean;
    tags: string[];
    category: string | null;
    agentId: string | null;
    createdAt: string;
    updatedAt: string;
}

export default function CanvasViewerPage() {
    const params = useParams();
    const router = useRouter();
    const slug = params.slug as string;

    const [schema, setSchema] = useState<CanvasSchemaForRenderer | null>(null);
    const [canvasMeta, setCanvasMeta] = useState<CanvasMeta | null>(null);
    const [data, setData] = useState<Record<string, unknown>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [debugOpen, setDebugOpen] = useState(false);
    const [debugTab, setDebugTab] = useState<DebugTab>("schema");
    const [deleting, setDeleting] = useState(false);
    const [deleteArmed, setDeleteArmed] = useState(false);

    // Fetch canvas schema
    useEffect(() => {
        async function fetchCanvas() {
            try {
                const res = await fetch(`${getApiBase()}/api/canvases/${slug}`);
                if (!res.ok) throw new Error("Canvas not found");
                const canvas = await res.json();
                setSchema(canvas.schemaJson as CanvasSchemaForRenderer);
                setCanvasMeta({
                    id: canvas.id,
                    slug: canvas.slug,
                    version: canvas.version,
                    isPublished: canvas.isPublished,
                    isActive: canvas.isActive,
                    isPublic: canvas.isPublic,
                    tags: canvas.tags,
                    category: canvas.category,
                    agentId: canvas.agentId,
                    createdAt: canvas.createdAt,
                    updatedAt: canvas.updatedAt
                });
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load canvas");
            }
        }
        fetchCanvas();
    }, [slug]);

    // Fetch data with SWR-style caching: show stale data during refresh
    const fetchData = useCallback(
        async (isBackground = false) => {
            try {
                if (!isBackground) setRefreshing(true);
                const res = await fetch(`${getApiBase()}/api/canvases/${slug}/data`);
                if (!res.ok) throw new Error("Failed to load data");
                const result = await res.json();
                setData(result.queries || {});
            } catch (err) {
                console.error("Canvas data error:", err);
                // On background refresh failure, keep existing data (SWR pattern)
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [slug]
    );

    useEffect(() => {
        if (schema) {
            fetchData();
        }
    }, [schema, fetchData]);

    // Auto-refresh for queries with refreshInterval
    useEffect(() => {
        if (!schema) return;

        const queries = schema.dataQueries || [];
        const intervals: NodeJS.Timeout[] = [];

        for (const query of queries as { refreshInterval?: number }[]) {
            if (query.refreshInterval && query.refreshInterval > 0) {
                const interval = setInterval(() => {
                    fetchData(true); // Background refresh - keep showing stale data
                }, query.refreshInterval);
                intervals.push(interval);
            }
        }

        return () => {
            for (const interval of intervals) {
                clearInterval(interval);
            }
        };
    }, [schema, fetchData]);

    const handleRefresh = () => {
        fetchData(false); // Foreground refresh - shows refreshing indicator
    };

    const handleDeleteClick = async () => {
        if (!deleteArmed) {
            setDeleteArmed(true);
            // Auto-disarm after 3 seconds if user doesn't confirm
            setTimeout(() => setDeleteArmed(false), 3000);
            return;
        }
        setDeleting(true);
        try {
            await fetch(`${getApiBase()}/api/canvases/${slug}`, { method: "DELETE" });
            router.push("/canvas");
        } catch (err) {
            console.error("Failed to delete canvas:", err);
            setDeleting(false);
            setDeleteArmed(false);
        }
    };

    if (error) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-4">
                <p className="text-muted-foreground">{error}</p>
                <Link href="/canvas">
                    <Button variant="outline">
                        <ArrowLeftIcon className="mr-2 size-4" />
                        Back to Gallery
                    </Button>
                </Link>
            </div>
        );
    }

    if (loading || !schema) {
        return (
            <div className="mx-auto max-w-[1400px] p-4">
                <Skeleton className="mb-4 h-8 w-64" />
                <Skeleton className="mb-4 h-4 w-96" />
                <div className="grid grid-cols-2 gap-4 md:grid-cols-12">
                    <Skeleton className="h-32 md:col-span-3" />
                    <Skeleton className="h-32 md:col-span-3" />
                    <Skeleton className="h-32 md:col-span-3" />
                    <Skeleton className="h-32 md:col-span-3" />
                    <Skeleton className="col-span-2 h-64 md:col-span-8" />
                    <Skeleton className="col-span-2 h-64 md:col-span-4" />
                    <Skeleton className="col-span-2 h-48 md:col-span-12" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full overflow-hidden">
            {/* Main content area */}
            <div className="flex min-w-0 flex-1 flex-col overflow-auto">
                {/* Top bar */}
                <div className="bg-background/80 sticky top-0 z-10 flex items-center justify-between border-b px-4 py-2 backdrop-blur">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/canvas"
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <ArrowLeftIcon className="size-4" />
                        </Link>
                        <span className="text-sm font-medium">{schema.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleRefresh}
                            disabled={refreshing}
                        >
                            <RefreshCwIcon
                                className={`mr-1 size-4 ${refreshing ? "animate-spin" : ""}`}
                            />
                            Refresh
                        </Button>
                        <Link href={`/canvas/${slug}/edit`}>
                            <Button variant="ghost" size="sm">
                                <PencilIcon className="mr-1 size-4" />
                                Edit
                            </Button>
                        </Link>
                        <Link href={`/canvas/${slug}/versions`}>
                            <Button variant="ghost" size="sm">
                                Versions
                            </Button>
                        </Link>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDebugOpen(!debugOpen)}
                            className={debugOpen ? "bg-muted" : ""}
                        >
                            <CodeIcon className="mr-1 size-4" />
                            Debug
                        </Button>
                        <Button variant="ghost" size="sm">
                            <Share2Icon className="mr-1 size-4" />
                            Share
                        </Button>
                        <Button
                            variant={deleteArmed ? "destructive" : "ghost"}
                            size="sm"
                            onClick={handleDeleteClick}
                            disabled={deleting}
                            className={deleteArmed ? "" : "text-destructive hover:text-destructive"}
                        >
                            <TrashIcon className="mr-1 size-4" />
                            {deleting ? "Deleting..." : deleteArmed ? "Confirm Delete?" : "Delete"}
                        </Button>
                    </div>
                </div>

                {/* Canvas renderer */}
                <CanvasRenderer schema={schema} data={data} onRefresh={handleRefresh} />
            </div>

            {/* Debug Panel */}
            {debugOpen && (
                <div className="flex w-full flex-col overflow-hidden border-l md:w-[480px] md:min-w-[480px]">
                    {/* Debug header */}
                    <div className="flex shrink-0 items-center justify-between border-b px-4 py-2">
                        <span className="text-sm font-medium">Debug Inspector</span>
                        <button
                            onClick={() => setDebugOpen(false)}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <XIcon className="size-4" />
                        </button>
                    </div>

                    {/* Tab bar */}
                    <div className="flex shrink-0 border-b">
                        {(["schema", "data", "info"] as DebugTab[]).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setDebugTab(tab)}
                                className={`flex-1 px-3 py-2 text-xs font-medium capitalize transition-colors ${
                                    debugTab === tab
                                        ? "border-primary text-foreground border-b-2"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Tab content */}
                    <div className="flex-1 overflow-auto p-4">
                        {debugTab === "schema" && (
                            <pre className="bg-muted rounded-md p-3 text-xs leading-relaxed break-all whitespace-pre-wrap">
                                {JSON.stringify(schema, null, 2)}
                            </pre>
                        )}

                        {debugTab === "data" && (
                            <div className="space-y-4">
                                {Object.keys(data).length === 0 ? (
                                    <p className="text-muted-foreground text-sm">
                                        No data queries returned results.
                                    </p>
                                ) : (
                                    Object.entries(data).map(([queryId, queryData]) => (
                                        <div key={queryId}>
                                            <div className="mb-1 flex items-center gap-2">
                                                <span className="text-xs font-semibold">
                                                    {queryId}
                                                </span>
                                                <Badge variant="outline" className="text-xs">
                                                    {Array.isArray(queryData)
                                                        ? `${queryData.length} rows`
                                                        : typeof queryData}
                                                </Badge>
                                            </div>
                                            <pre className="bg-muted rounded-md p-3 text-xs leading-relaxed break-all whitespace-pre-wrap">
                                                {JSON.stringify(queryData, null, 2)}
                                            </pre>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {debugTab === "info" && canvasMeta && (
                            <div className="space-y-3">
                                {[
                                    { label: "ID", value: canvasMeta.id },
                                    { label: "Slug", value: canvasMeta.slug },
                                    {
                                        label: "Version",
                                        value: `v${canvasMeta.version}`
                                    },
                                    {
                                        label: "Published",
                                        value: canvasMeta.isPublished ? "Yes" : "No"
                                    },
                                    {
                                        label: "Active",
                                        value: canvasMeta.isActive ? "Yes" : "No"
                                    },
                                    {
                                        label: "Public",
                                        value: canvasMeta.isPublic ? "Yes" : "No"
                                    },
                                    {
                                        label: "Category",
                                        value: canvasMeta.category || "None"
                                    },
                                    {
                                        label: "Tags",
                                        value:
                                            canvasMeta.tags.length > 0
                                                ? canvasMeta.tags.join(", ")
                                                : "None"
                                    },
                                    {
                                        label: "Agent ID",
                                        value: canvasMeta.agentId || "None"
                                    },
                                    {
                                        label: "Created",
                                        value: new Date(canvasMeta.createdAt).toLocaleString()
                                    },
                                    {
                                        label: "Updated",
                                        value: new Date(canvasMeta.updatedAt).toLocaleString()
                                    }
                                ].map((item) => (
                                    <div key={item.label} className="flex items-start gap-3">
                                        <span className="text-muted-foreground w-24 shrink-0 text-xs font-medium">
                                            {item.label}
                                        </span>
                                        <span className="text-xs break-all">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
