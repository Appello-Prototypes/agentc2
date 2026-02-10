"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import { CanvasBuilderPanel } from "@/components/canvas/CanvasBuilderPanel";
import type { CanvasSchemaForRenderer } from "@repo/ui/components/canvas";
import { Skeleton } from "@repo/ui";

export default function CanvasEditPage() {
    const params = useParams();
    const slug = params.slug as string;

    const [schema, setSchema] = useState<CanvasSchemaForRenderer | null>(null);
    const [data, setData] = useState<Record<string, unknown>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadCanvas() {
            try {
                const canvasRes = await fetch(`${getApiBase()}/api/canvases/${slug}`);
                if (!canvasRes.ok) throw new Error("Canvas not found");
                const canvas = await canvasRes.json();
                setSchema(canvas.schemaJson as CanvasSchemaForRenderer);

                const dataRes = await fetch(`${getApiBase()}/api/canvases/${slug}/data`);
                if (dataRes.ok) {
                    const dataResult = await dataRes.json();
                    setData(dataResult.queries || {});
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load canvas");
            } finally {
                setLoading(false);
            }
        }
        loadCanvas();
    }, [slug]);

    if (error) {
        return (
            <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
                <p className="text-muted-foreground">{error}</p>
            </div>
        );
    }

    if (loading || !schema) {
        return (
            <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
                <div className="w-[400px] border-r p-4">
                    <Skeleton className="mb-4 h-8 w-48" />
                    <Skeleton className="mb-2 h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                </div>
                <div className="flex-1 p-4">
                    <Skeleton className="mb-4 h-8 w-64" />
                    <div className="grid grid-cols-12 gap-4">
                        <Skeleton className="col-span-3 h-24" />
                        <Skeleton className="col-span-3 h-24" />
                        <Skeleton className="col-span-3 h-24" />
                        <Skeleton className="col-span-3 h-24" />
                        <Skeleton className="col-span-12 h-64" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <CanvasBuilderPanel
            mode="edit"
            existingSlug={slug}
            existingSchema={schema}
            existingData={data}
        />
    );
}
