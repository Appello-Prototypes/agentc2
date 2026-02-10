"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CanvasRenderer, type CanvasSchemaForRenderer } from "@repo/ui/components/canvas";
import { getApiBase } from "@/lib/utils";

/**
 * Embeddable canvas page - renders the canvas without the app shell.
 * Used via iframe: /canvas/{slug}/embed?token={publicToken}
 */
export default function CanvasEmbedPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const slug = params.slug as string;
    const token = searchParams.get("token");

    const [schema, setSchema] = useState<CanvasSchemaForRenderer | null>(null);
    const [data, setData] = useState<Record<string, unknown>>({});
    const [error, setError] = useState<string | null>(null);

    const tokenParam = token ? `?token=${token}` : "";

    // Fetch canvas schema
    useEffect(() => {
        async function fetchCanvas() {
            try {
                const res = await fetch(`${getApiBase()}/api/canvases/${slug}${tokenParam}`);
                if (!res.ok) throw new Error("Canvas not found");
                const canvas = await res.json();
                setSchema(canvas.schemaJson as CanvasSchemaForRenderer);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load canvas");
            }
        }
        fetchCanvas();
    }, [slug, tokenParam]);

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/canvases/${slug}/data${tokenParam}`);
            if (res.ok) {
                const result = await res.json();
                setData(result.queries || {});
            }
        } catch (err) {
            console.error("Canvas data error:", err);
        }
    }, [slug, tokenParam]);

    useEffect(() => {
        if (schema) {
            fetchData();
        }
    }, [schema, fetchData]);

    if (error) {
        return (
            <div className="flex h-screen items-center justify-center bg-white dark:bg-neutral-950">
                <p className="text-sm text-neutral-500">{error}</p>
            </div>
        );
    }

    if (!schema) {
        return (
            <div className="flex h-screen items-center justify-center bg-white dark:bg-neutral-950">
                <div className="text-sm text-neutral-400">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-neutral-950">
            <CanvasRenderer schema={schema} data={data} onRefresh={fetchData} />
        </div>
    );
}
