"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { CanvasRenderer, type CanvasSchemaForRenderer } from "@repo/ui/components/canvas";
import { getApiBase } from "@/lib/utils";
import { Skeleton, Button } from "@repo/ui";
import { RefreshCwIcon, ArrowLeftIcon, Share2Icon } from "lucide-react";
import Link from "next/link";

export default function CanvasViewerPage() {
    const params = useParams();
    const slug = params.slug as string;

    const [schema, setSchema] = useState<CanvasSchemaForRenderer | null>(null);
    const [data, setData] = useState<Record<string, unknown>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    // Fetch canvas schema
    useEffect(() => {
        async function fetchCanvas() {
            try {
                const res = await fetch(`${getApiBase()}/api/canvases/${slug}`);
                if (!res.ok) throw new Error("Canvas not found");
                const canvas = await res.json();
                setSchema(canvas.schemaJson as CanvasSchemaForRenderer);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load canvas");
            }
        }
        fetchCanvas();
    }, [slug]);

    // Fetch data
    const fetchData = useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/canvases/${slug}/data`);
            if (!res.ok) throw new Error("Failed to load data");
            const result = await res.json();
            setData(result.queries || {});
        } catch (err) {
            console.error("Canvas data error:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [slug]);

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
                    fetchData();
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
        setRefreshing(true);
        fetchData();
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
                <div className="grid grid-cols-12 gap-4">
                    <Skeleton className="col-span-3 h-32" />
                    <Skeleton className="col-span-3 h-32" />
                    <Skeleton className="col-span-3 h-32" />
                    <Skeleton className="col-span-3 h-32" />
                    <Skeleton className="col-span-8 h-64" />
                    <Skeleton className="col-span-4 h-64" />
                    <Skeleton className="col-span-12 h-48" />
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-auto">
            {/* Top bar */}
            <div className="bg-background/80 sticky top-0 z-10 flex items-center justify-between border-b px-4 py-2 backdrop-blur">
                <div className="flex items-center gap-3">
                    <Link href="/canvas" className="text-muted-foreground hover:text-foreground">
                        <ArrowLeftIcon className="size-4" />
                    </Link>
                    <span className="text-sm font-medium">{schema.title}</span>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing}>
                        <RefreshCwIcon
                            className={`mr-1 size-4 ${refreshing ? "animate-spin" : ""}`}
                        />
                        Refresh
                    </Button>
                    <Link href={`/canvas/${slug}/versions`}>
                        <Button variant="ghost" size="sm">
                            Versions
                        </Button>
                    </Link>
                    <Button variant="ghost" size="sm">
                        <Share2Icon className="mr-1 size-4" />
                        Share
                    </Button>
                </div>
            </div>

            {/* Canvas renderer */}
            <CanvasRenderer schema={schema} data={data} onRefresh={handleRefresh} />
        </div>
    );
}
