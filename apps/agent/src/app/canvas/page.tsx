"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import { Button, Badge, Skeleton } from "@repo/ui";
import {
    PlusIcon,
    SearchIcon,
    LayoutDashboardIcon,
    TrashIcon,
    PencilIcon,
    LayoutTemplateIcon,
    Loader2Icon
} from "lucide-react";
import Link from "next/link";

interface TemplateSummary {
    slug: string;
    title: string;
    description: string;
    category: string;
    tags: string[];
    preview: {
        layout: { type: string; columns: number };
        components: Array<{ type: string; span: number; title?: string }>;
    };
}

interface PreviewComponent {
    type: string;
    span: number;
    row?: string;
    title?: string;
}

interface CanvasPreview {
    layout: { type: string; columns: number };
    components: PreviewComponent[];
}

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
    preview?: CanvasPreview;
}

// ─── Mini-preview block type → visual style mapping ────────────────────────
const BLOCK_STYLES: Record<string, { bg: string; icon: string }> = {
    // Charts
    "bar-chart": { bg: "bg-blue-500/20", icon: "▐▌▐" },
    "line-chart": { bg: "bg-blue-500/20", icon: "╱╲╱" },
    "pie-chart": { bg: "bg-blue-500/20", icon: "◕" },
    "area-chart": { bg: "bg-blue-500/20", icon: "▁▃▅" },
    sparkline: { bg: "bg-blue-500/20", icon: "⌇" },
    funnel: { bg: "bg-blue-500/20", icon: "▽" },
    // Tables & Data
    "data-table": { bg: "bg-emerald-500/20", icon: "▦" },
    "detail-view": { bg: "bg-emerald-500/20", icon: "≡" },
    "property-list": { bg: "bg-emerald-500/20", icon: "≣" },
    list: { bg: "bg-emerald-500/20", icon: "☰" },
    kanban: { bg: "bg-emerald-500/20", icon: "⫼" },
    timeline: { bg: "bg-emerald-500/20", icon: "⏤" },
    // KPIs & Metrics
    "kpi-card": { bg: "bg-violet-500/20", icon: "#" },
    "stat-card": { bg: "bg-violet-500/20", icon: "↑" },
    "metric-row": { bg: "bg-violet-500/20", icon: "⋯" },
    "progress-bar": { bg: "bg-violet-500/20", icon: "▰▰▱" },
    // Interactive
    "filter-bar": { bg: "bg-amber-500/20", icon: "▼" },
    search: { bg: "bg-amber-500/20", icon: "⌕" },
    form: { bg: "bg-amber-500/20", icon: "☐" },
    "action-button": { bg: "bg-amber-500/20", icon: "▶" },
    // Layout
    text: { bg: "bg-zinc-500/15", icon: "T" },
    tabs: { bg: "bg-zinc-500/15", icon: "⊞" },
    accordion: { bg: "bg-zinc-500/15", icon: "▾" },
    divider: { bg: "bg-zinc-500/15", icon: "—" },
    image: { bg: "bg-zinc-500/15", icon: "◻" }
};

function CanvasMiniPreview({ preview }: { preview: CanvasPreview }) {
    const { layout, components } = preview;
    const cols = layout.columns || 12;

    if (!components || components.length === 0) {
        return (
            <div className="flex h-full items-center justify-center">
                <LayoutDashboardIcon className="text-muted-foreground/40 size-10" />
            </div>
        );
    }

    // Group components into rows
    const rows: PreviewComponent[][] = [];
    let currentRow: PreviewComponent[] = [];
    let currentSpan = 0;

    for (const comp of components) {
        const span = Math.min(comp.span || 12, cols);
        if (currentSpan + span > cols && currentRow.length > 0) {
            rows.push(currentRow);
            currentRow = [];
            currentSpan = 0;
        }
        currentRow.push(comp);
        currentSpan += span;
    }
    if (currentRow.length > 0) rows.push(currentRow);

    // Limit to first ~5 rows so it fits in the thumbnail
    const visibleRows = rows.slice(0, 5);
    const hasMore = rows.length > 5;

    return (
        <div className="flex h-full flex-col gap-[3px] p-2.5">
            {visibleRows.map((row, ri) => (
                <div key={ri} className="flex min-h-0 flex-1 gap-[3px]">
                    {row.map((comp, ci) => {
                        const style = BLOCK_STYLES[comp.type] || {
                            bg: "bg-zinc-500/15",
                            icon: "?"
                        };
                        const widthPct = ((comp.span || 12) / cols) * 100;
                        return (
                            <div
                                key={ci}
                                className={`${style.bg} flex items-center justify-center rounded-[3px] text-[8px] leading-none opacity-80`}
                                style={{ width: `${widthPct}%` }}
                            >
                                <span className="text-muted-foreground/70 select-none">
                                    {style.icon}
                                </span>
                            </div>
                        );
                    })}
                </div>
            ))}
            {hasMore && (
                <div className="text-muted-foreground/40 mt-auto text-center text-[7px]">
                    +{rows.length - 5} more
                </div>
            )}
        </div>
    );
}

export default function CanvasGalleryPage() {
    const router = useRouter();
    const [canvases, setCanvases] = useState<CanvasSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<string>("");
    const [deleteArmedSlug, setDeleteArmedSlug] = useState<string | null>(null);
    const [templates, setTemplates] = useState<TemplateSummary[]>([]);
    const [creatingTemplate, setCreatingTemplate] = useState<string | null>(null);

    useEffect(() => {
        fetchCanvases();
        fetchTemplates();
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

    async function fetchTemplates() {
        try {
            const res = await fetch(`${getApiBase()}/api/canvas/templates`);
            if (res.ok) {
                const data = await res.json();
                setTemplates(data.templates || []);
            }
        } catch (err) {
            console.error("Failed to fetch templates:", err);
        }
    }

    async function handleCreateFromTemplate(templateSlug: string) {
        setCreatingTemplate(templateSlug);
        try {
            const res = await fetch(`${getApiBase()}/api/canvas/templates`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ templateSlug })
            });
            if (res.ok) {
                const canvas = await res.json();
                router.push(`/canvas/${canvas.slug}`);
            } else {
                const err = await res.json();
                console.error("Template creation failed:", err.error);
            }
        } catch (err) {
            console.error("Failed to create from template:", err);
        } finally {
            setCreatingTemplate(null);
        }
    }

    async function handleDeleteClick(slug: string) {
        if (deleteArmedSlug !== slug) {
            setDeleteArmedSlug(slug);
            // Auto-disarm after 3 seconds if user doesn't confirm
            setTimeout(() => setDeleteArmedSlug((prev) => (prev === slug ? null : prev)), 3000);
            return;
        }
        try {
            await fetch(`${getApiBase()}/api/canvases/${slug}`, { method: "DELETE" });
            setCanvases((prev) => prev.filter((c) => c.slug !== slug));
            setDeleteArmedSlug(null);
        } catch (err) {
            console.error("Failed to delete canvas:", err);
            setDeleteArmedSlug(null);
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

            {/* Templates Section */}
            {templates.length > 0 && (
                <div className="mb-8">
                    <div className="mb-3 flex items-center gap-2">
                        <LayoutTemplateIcon className="text-muted-foreground size-4" />
                        <h2 className="text-sm font-medium">Start from Template</h2>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {templates.map((tpl) => (
                            <button
                                key={tpl.slug}
                                onClick={() => handleCreateFromTemplate(tpl.slug)}
                                disabled={creatingTemplate !== null}
                                className="bg-card group cursor-pointer rounded-lg border border-dashed p-4 text-left transition-all hover:border-solid hover:shadow-md disabled:opacity-60"
                            >
                                {/* Mini preview */}
                                <div className="bg-muted/50 mb-3 h-20 overflow-hidden rounded-md">
                                    <CanvasMiniPreview
                                        preview={{
                                            layout: tpl.preview.layout,
                                            components: tpl.preview.components.map((c) => ({
                                                ...c,
                                                row: undefined
                                            }))
                                        }}
                                    />
                                </div>
                                <div className="flex items-start gap-2">
                                    <div className="min-w-0 flex-1">
                                        <h3 className="truncate text-sm font-semibold">
                                            {tpl.title}
                                        </h3>
                                        <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                                            {tpl.description}
                                        </p>
                                    </div>
                                    {creatingTemplate === tpl.slug && (
                                        <Loader2Icon className="text-muted-foreground size-4 shrink-0 animate-spin" />
                                    )}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {tpl.tags.slice(0, 3).map((tag) => (
                                        <Badge
                                            key={tag}
                                            variant="outline"
                                            className="text-muted-foreground text-xs"
                                        >
                                            {tag}
                                        </Badge>
                                    ))}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

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
                            {/* Canvas preview */}
                            <div className="bg-muted/50 h-32 overflow-hidden rounded-t-lg">
                                {canvas.preview && canvas.preview.components.length > 0 ? (
                                    <CanvasMiniPreview preview={canvas.preview} />
                                ) : (
                                    <div className="flex h-full items-center justify-center">
                                        <LayoutDashboardIcon className="text-muted-foreground/40 size-10" />
                                    </div>
                                )}
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
                                    <div className="ml-2 flex items-center gap-1">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                router.push(`/canvas/${canvas.slug}/edit`);
                                            }}
                                            className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
                                        >
                                            <PencilIcon className="size-3.5" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteClick(canvas.slug);
                                            }}
                                            className={`rounded p-1 transition-colors ${
                                                deleteArmedSlug === canvas.slug
                                                    ? "bg-destructive text-destructive-foreground"
                                                    : "text-muted-foreground hover:text-destructive"
                                            }`}
                                            title={
                                                deleteArmedSlug === canvas.slug
                                                    ? "Click again to confirm delete"
                                                    : "Delete"
                                            }
                                        >
                                            <TrashIcon className="size-3.5" />
                                        </button>
                                    </div>
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
