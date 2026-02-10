"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import { Button, Badge, Skeleton } from "@repo/ui";
import { PlusIcon, SearchIcon, LayoutDashboardIcon, TrashIcon } from "lucide-react";
import Link from "next/link";

interface CanvasSummary {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    thumbnail: string | null;
    isPublished: boolean;
    isActive: boolean;
    version: number;
    tags: string[];
    category: string | null;
    agentId: string | null;
    createdAt: string;
    updatedAt: string;
}

export default function CanvasGalleryPage() {
    const router = useRouter();
    const [canvases, setCanvases] = useState<CanvasSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<string>("");

    useEffect(() => {
        fetchCanvases();
    }, []);

    async function fetchCanvases() {
        try {
            const res = await fetch(`${getApiBase()}/api/canvases?take=100`);
            if (res.ok) {
                const data = await res.json();
                setCanvases(data.canvases || []);
            }
        } catch (err) {
            console.error("Failed to fetch canvases:", err);
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(slug: string) {
        if (!confirm(`Delete canvas "${slug}"?`)) return;
        try {
            await fetch(`${getApiBase()}/api/canvases/${slug}`, { method: "DELETE" });
            setCanvases((prev) => prev.filter((c) => c.slug !== slug));
        } catch (err) {
            console.error("Failed to delete canvas:", err);
        }
    }

    // Get unique categories
    const categories = [...new Set(canvases.map((c) => c.category).filter(Boolean))] as string[];

    // Filter
    const filtered = canvases.filter((c) => {
        const matchesSearch =
            !search ||
            c.title.toLowerCase().includes(search.toLowerCase()) ||
            c.description?.toLowerCase().includes(search.toLowerCase()) ||
            c.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
        const matchesCategory = !categoryFilter || c.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="mx-auto max-w-6xl px-4 py-6">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Canvases</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Interactive dashboards and views built by AI agents
                    </p>
                </div>
                <Link href="/canvas/build">
                    <Button>
                        <PlusIcon className="mr-2 size-4" />
                        Build New Canvas
                    </Button>
                </Link>
            </div>

            {/* Filters */}
            <div className="mb-6 flex items-center gap-3">
                <div className="relative flex-1">
                    <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search canvases..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="border-input bg-background ring-offset-background focus-visible:ring-ring w-full rounded-md border py-2 pr-4 pl-10 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    />
                </div>
                {categories.length > 0 && (
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="border-input bg-background ring-offset-background focus-visible:ring-ring rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                        <option value="">All Categories</option>
                        {categories.map((cat) => (
                            <option key={cat} value={cat}>
                                {cat.charAt(0).toUpperCase() + cat.slice(1)}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {/* Canvas Grid */}
            {loading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Skeleton key={i} className="h-48 rounded-lg" />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="py-16 text-center">
                    <LayoutDashboardIcon className="text-muted-foreground mx-auto mb-4 size-12" />
                    <h3 className="text-lg font-medium">
                        {canvases.length === 0 ? "No canvases yet" : "No matching canvases"}
                    </h3>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {canvases.length === 0
                            ? "Use the Canvas Builder to create your first dashboard"
                            : "Try adjusting your search or filters"}
                    </p>
                    {canvases.length === 0 && (
                        <Link href="/canvas/build">
                            <Button className="mt-4">
                                <PlusIcon className="mr-2 size-4" />
                                Build Your First Canvas
                            </Button>
                        </Link>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((canvas) => (
                        <div
                            key={canvas.id}
                            className="bg-card group cursor-pointer rounded-lg border transition-shadow hover:shadow-md"
                            onClick={() => router.push(`/canvas/${canvas.slug}`)}
                        >
                            {/* Thumbnail placeholder */}
                            <div className="bg-muted/50 flex h-32 items-center justify-center rounded-t-lg">
                                <LayoutDashboardIcon className="text-muted-foreground/40 size-10" />
                            </div>

                            {/* Info */}
                            <div className="p-4">
                                <div className="flex items-start justify-between">
                                    <div className="min-w-0">
                                        <h3 className="truncate text-sm font-semibold">
                                            {canvas.title}
                                        </h3>
                                        {canvas.description && (
                                            <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                                                {canvas.description}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(canvas.slug);
                                        }}
                                        className="text-muted-foreground hover:text-destructive ml-2 opacity-0 transition-opacity group-hover:opacity-100"
                                    >
                                        <TrashIcon className="size-4" />
                                    </button>
                                </div>

                                {/* Tags and metadata */}
                                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                                    {canvas.category && (
                                        <Badge variant="outline" className="text-xs">
                                            {canvas.category}
                                        </Badge>
                                    )}
                                    {canvas.tags.slice(0, 2).map((tag) => (
                                        <Badge
                                            key={tag}
                                            variant="outline"
                                            className="text-muted-foreground text-xs"
                                        >
                                            {tag}
                                        </Badge>
                                    ))}
                                    <span className="text-muted-foreground ml-auto text-xs">
                                        v{canvas.version}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
