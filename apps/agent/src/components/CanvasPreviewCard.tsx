"use client";

import { useState, useEffect, useCallback } from "react";
import { getApiBase } from "@/lib/utils";
import { CanvasRenderer, type CanvasSchemaForRenderer } from "@repo/ui/components/canvas";
import { Badge, Button, Skeleton } from "@repo/ui";
import { ExternalLinkIcon, RefreshCwIcon, LayoutDashboardIcon, LoaderIcon } from "lucide-react";
import Link from "next/link";

interface CanvasPreviewCardProps {
    /** The canvas slug (from tool input or result) */
    slug: string | null;
    /** Title from the tool result, if available */
    title?: string;
    /** Whether the tool call has completed (result is available) */
    hasResult: boolean;
}

/**
 * Inline canvas preview card rendered inside the chat when the
 * canvas-create or canvas-update tool fires.
 *
 * Fetches the canvas schema + data and renders a compact preview
 * with a link to the full-page viewer.
 */
export function CanvasPreviewCard({ slug, title, hasResult }: CanvasPreviewCardProps) {
    const [schema, setSchema] = useState<CanvasSchemaForRenderer | null>(null);
    const [data, setData] = useState<Record<string, unknown>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fetched, setFetched] = useState(false);

    const fetchCanvas = useCallback(async () => {
        if (!slug) return;
        setLoading(true);
        setError(null);
        try {
            const schemaRes = await fetch(`${getApiBase()}/api/canvases/${slug}`);
            if (!schemaRes.ok) throw new Error("Canvas not found");
            const canvas = await schemaRes.json();
            setSchema(canvas.schemaJson as CanvasSchemaForRenderer);

            const dataRes = await fetch(`${getApiBase()}/api/canvases/${slug}/data`);
            if (dataRes.ok) {
                const result = await dataRes.json();
                setData(result.queries || {});
            }
            setFetched(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load canvas");
        } finally {
            setLoading(false);
        }
    }, [slug]);

    // Fetch when slug becomes available, or when hasResult flips to true
    useEffect(() => {
        if (slug && hasResult && !fetched) {
            fetchCanvas();
        }
    }, [slug, hasResult, fetched, fetchCanvas]);

    // ── Waiting for tool to complete ──────────────────────────────────────
    if (!hasResult || !slug) {
        return (
            <div className="bg-muted/30 my-3 flex items-center gap-3 rounded-lg border p-4">
                <LoaderIcon className="text-muted-foreground size-4 animate-spin" />
                <span className="text-muted-foreground text-sm">Building canvas...</span>
            </div>
        );
    }

    // ── Loading state ─────────────────────────────────────────────────────
    if (loading && !schema) {
        return (
            <div className="my-3 rounded-lg border">
                <div className="flex items-center justify-between border-b px-4 py-3">
                    <div className="flex items-center gap-2">
                        <LayoutDashboardIcon className="text-primary size-4" />
                        <Skeleton className="h-4 w-40" />
                    </div>
                </div>
                <div className="p-4">
                    <div className="grid grid-cols-12 gap-3">
                        <Skeleton className="col-span-3 h-16" />
                        <Skeleton className="col-span-3 h-16" />
                        <Skeleton className="col-span-3 h-16" />
                        <Skeleton className="col-span-3 h-16" />
                        <Skeleton className="col-span-12 h-32" />
                    </div>
                </div>
            </div>
        );
    }

    // ── Error state ───────────────────────────────────────────────────────
    if (error) {
        return (
            <div className="my-3 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <LayoutDashboardIcon className="text-muted-foreground size-4" />
                        <span className="text-sm font-medium">{title || slug}</span>
                    </div>
                    <Link href={`/canvas/${slug}`} target="_blank">
                        <Button variant="outline" size="sm">
                            <ExternalLinkIcon className="mr-1.5 size-3" />
                            Open Canvas
                        </Button>
                    </Link>
                </div>
                <p className="text-muted-foreground mt-2 text-xs">{error}</p>
            </div>
        );
    }

    // ── Preview state ─────────────────────────────────────────────────────
    const displayTitle = schema?.title || title || slug;

    return (
        <div className="my-3 overflow-hidden rounded-lg border">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-2.5">
                <div className="flex items-center gap-2">
                    <LayoutDashboardIcon className="text-primary size-4" />
                    <span className="text-sm font-medium">{displayTitle}</span>
                    <Badge variant="outline" className="text-muted-foreground text-[10px]">
                        Canvas
                    </Badge>
                </div>
                <div className="flex items-center gap-1.5">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={fetchCanvas}
                        disabled={loading}
                        className="h-7 px-2 text-xs"
                    >
                        <RefreshCwIcon className={`mr-1 size-3 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <Link href={`/canvas/${slug}`} target="_blank">
                        <Button variant="default" size="sm" className="h-7 px-3 text-xs">
                            <ExternalLinkIcon className="mr-1.5 size-3" />
                            View Full Canvas
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Inline preview -- compact, scrollable, with a max height */}
            {schema && (
                <div className="max-h-[500px] overflow-auto">
                    <div className="origin-top-left">
                        <CanvasRenderer schema={schema} data={data} onRefresh={fetchCanvas} />
                    </div>
                </div>
            )}
        </div>
    );
}
