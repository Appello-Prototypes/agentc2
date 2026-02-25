"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { getApiBase } from "@/lib/utils";
import { Badge, Button, Input, Skeleton } from "@repo/ui";
import {
    SearchIcon,
    StarIcon,
    DownloadIcon,
    ShieldCheckIcon,
    PackageIcon,
    SparklesIcon,
    BotIcon,
    HeadphonesIcon,
    TrendingUpIcon,
    MegaphoneIcon,
    SettingsIcon,
    FlaskConicalIcon,
    DollarSignIcon,
    UsersIcon,
    CodeIcon,
    LayoutGridIcon,
    ArrowRightIcon,
    ZapIcon
} from "lucide-react";

interface MarketplacePlaybook {
    id: string;
    slug: string;
    name: string;
    tagline: string | null;
    description: string;
    category: string;
    tags: string[];
    coverImageUrl: string | null;
    iconUrl: string | null;
    pricingModel: string;
    priceUsd: number | null;
    monthlyPriceUsd: number | null;
    installCount: number;
    averageRating: number | null;
    reviewCount: number;
    trustScore: number | null;
    requiredIntegrations: string[];
    version: number;
    publisherOrg: { id: string; name: string; slug: string; logoUrl: string | null };
    _count: { components: number };
}

const CATEGORY_META: Record<string, { icon: typeof LayoutGridIcon; color: string }> = {
    All: { icon: LayoutGridIcon, color: "text-blue-400" },
    "Customer Support": { icon: HeadphonesIcon, color: "text-emerald-400" },
    Sales: { icon: TrendingUpIcon, color: "text-orange-400" },
    Marketing: { icon: MegaphoneIcon, color: "text-pink-400" },
    Operations: { icon: SettingsIcon, color: "text-cyan-400" },
    Research: { icon: FlaskConicalIcon, color: "text-violet-400" },
    Finance: { icon: DollarSignIcon, color: "text-yellow-400" },
    HR: { icon: UsersIcon, color: "text-rose-400" },
    Engineering: { icon: CodeIcon, color: "text-sky-400" }
};

const CATEGORIES = Object.keys(CATEGORY_META);

function getCategoryGradient(category: string): string {
    const gradients: Record<string, string> = {
        "Customer Support": "from-emerald-500/20 to-teal-500/5",
        Sales: "from-orange-500/20 to-amber-500/5",
        Marketing: "from-pink-500/20 to-rose-500/5",
        Operations: "from-cyan-500/20 to-blue-500/5",
        Research: "from-violet-500/20 to-purple-500/5",
        Finance: "from-yellow-500/20 to-amber-500/5",
        HR: "from-rose-500/20 to-pink-500/5",
        Engineering: "from-sky-500/20 to-indigo-500/5",
        "getting-started": "from-blue-500/20 to-indigo-500/5"
    };
    return gradients[category] ?? "from-blue-500/20 to-indigo-500/5";
}

function getCategoryIconColor(category: string): string {
    return CATEGORY_META[category]?.color ?? "text-blue-400";
}

export default function MarketplacePage() {
    const [playbooks, setPlaybooks] = useState<MarketplacePlaybook[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("All");

    useEffect(() => {
        async function fetchPlaybooks() {
            setLoading(true);
            try {
                const params = new URLSearchParams();
                if (search) params.set("search", search);
                if (category !== "All") params.set("category", category);
                params.set("limit", "24");

                const res = await fetch(`${getApiBase()}/api/playbooks?${params.toString()}`);
                const data = await res.json();
                setPlaybooks(data.playbooks ?? []);
                setTotal(data.total ?? 0);
            } catch (error) {
                console.error("Failed to fetch marketplace:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchPlaybooks();
    }, [search, category]);

    const featured = useMemo(
        () => playbooks.find((pb) => pb.installCount > 0 || pb.trustScore),
        [playbooks]
    );

    function formatPrice(pb: MarketplacePlaybook) {
        if (pb.pricingModel === "FREE") return "Free";
        if (pb.pricingModel === "ONE_TIME") return `$${pb.priceUsd}`;
        if (pb.pricingModel === "SUBSCRIPTION") return `$${pb.monthlyPriceUsd}/mo`;
        return `$${pb.priceUsd}/use`;
    }

    return (
        <div className="min-h-screen">
            {/* ── Hero ──────────────────────────────────────────────── */}
            <div className="relative overflow-hidden border-b border-zinc-800/60">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.15),transparent)]" />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_80%,rgba(139,92,246,0.08),transparent)]" />
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage:
                            "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
                        backgroundSize: "60px 60px"
                    }}
                />

                <div className="relative mx-auto max-w-7xl px-6 pt-14 pb-12">
                    <div className="flex flex-col items-center text-center">
                        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5 text-sm text-blue-400">
                            <SparklesIcon className="h-3.5 w-3.5" />
                            AI Agent Marketplace
                        </div>
                        <h1 className="bg-linear-to-b from-white to-zinc-400 bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl">
                            Playbook Marketplace
                        </h1>
                        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-400">
                            Deploy production-ready AI agent systems to your workspace in minutes.
                            Browse pre-built playbooks, try them in a sandbox, and deploy with one
                            click.
                        </p>

                        {/* Search */}
                        <div className="mt-8 w-full max-w-xl">
                            <div className="relative">
                                <SearchIcon className="absolute top-1/2 left-4 h-4.5 w-4.5 -translate-y-1/2 text-zinc-500" />
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search playbooks by name, category, or tag..."
                                    className="h-12 rounded-xl border-zinc-700/50 bg-zinc-900/80 pl-11 text-base shadow-lg shadow-black/20 backdrop-blur-sm placeholder:text-zinc-500 focus:border-blue-500/50 focus:ring-blue-500/20"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Main Content ──────────────────────────────────────── */}
            <div className="mx-auto max-w-7xl px-6 py-8">
                {/* Category Filters */}
                <div className="mb-8 flex flex-wrap gap-2">
                    {CATEGORIES.map((cat) => {
                        const meta = CATEGORY_META[cat]!;
                        const Icon = meta.icon;
                        const isActive = category === cat;
                        return (
                            <button
                                key={cat}
                                onClick={() => setCategory(cat)}
                                className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-all ${
                                    isActive
                                        ? "border-blue-500/40 bg-blue-500/15 text-blue-400"
                                        : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300"
                                }`}
                            >
                                <Icon
                                    className={`h-3.5 w-3.5 ${isActive ? "text-blue-400" : "text-zinc-500"}`}
                                />
                                {cat}
                            </button>
                        );
                    })}
                </div>

                {/* Featured Playbook */}
                {!loading && featured && !search && category === "All" && (
                    <Link href={`/marketplace/${featured.slug}`} className="group mb-8 block">
                        <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-linear-to-br from-zinc-900 via-zinc-900 to-zinc-800 transition-all group-hover:border-zinc-700">
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-purple-500/5" />
                            <div className="relative flex flex-col gap-6 p-8 lg:flex-row lg:items-center lg:justify-between">
                                <div className="flex-1 space-y-3">
                                    <div className="flex items-center gap-3">
                                        <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/10">
                                            <ZapIcon className="mr-1 h-3 w-3" />
                                            Featured
                                        </Badge>
                                        <Badge
                                            variant="outline"
                                            className="border-zinc-700 capitalize"
                                        >
                                            {featured.category.replace(/-/g, " ")}
                                        </Badge>
                                    </div>
                                    <h2 className="text-2xl font-bold tracking-tight">
                                        {featured.name}
                                    </h2>
                                    <p className="max-w-lg text-zinc-400">
                                        {featured.tagline ?? featured.description}
                                    </p>
                                    <div className="flex items-center gap-4 pt-1 text-sm text-zinc-500">
                                        <span className="flex items-center gap-1.5">
                                            <DownloadIcon className="h-3.5 w-3.5" />
                                            {featured.installCount} installs
                                        </span>
                                        <span>by {featured.publisherOrg.name}</span>
                                        {featured.trustScore != null && featured.trustScore > 0 && (
                                            <span className="flex items-center gap-1 text-emerald-400">
                                                <ShieldCheckIcon className="h-3.5 w-3.5" />
                                                Verified
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-2xl font-bold text-white">
                                        {formatPrice(featured)}
                                    </span>
                                    <Button
                                        size="lg"
                                        className="gap-2 transition-transform group-hover:translate-x-0.5"
                                    >
                                        View Playbook
                                        <ArrowRightIcon className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Link>
                )}

                {/* Results Count */}
                {!loading && (
                    <div className="mb-5 flex items-center justify-between">
                        <p className="text-sm text-zinc-500">
                            {total} playbook{total !== 1 ? "s" : ""} available
                            {category !== "All" && (
                                <span className="text-zinc-600"> in {category}</span>
                            )}
                        </p>
                    </div>
                )}

                {/* Loading Skeletons */}
                {loading && (
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div
                                key={i}
                                className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
                            >
                                <div className="mb-4 flex items-center gap-3">
                                    <Skeleton className="h-10 w-10 rounded-lg" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-3/4" />
                                        <Skeleton className="h-3 w-1/2" />
                                    </div>
                                </div>
                                <Skeleton className="mb-3 h-3 w-full" />
                                <Skeleton className="mb-4 h-3 w-2/3" />
                                <div className="flex gap-2">
                                    <Skeleton className="h-5 w-12 rounded-full" />
                                    <Skeleton className="h-5 w-16 rounded-full" />
                                    <Skeleton className="h-5 w-14 rounded-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {!loading && playbooks.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24">
                        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900">
                            <PackageIcon className="h-10 w-10 text-zinc-600" />
                        </div>
                        <h3 className="mb-2 text-xl font-semibold">No playbooks found</h3>
                        <p className="mb-6 max-w-sm text-center text-zinc-500">
                            {search
                                ? `No results for "${search}". Try a different search term or browse all categories.`
                                : "New playbooks are being added regularly. Check back soon or browse all categories."}
                        </p>
                        {(search || category !== "All") && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setSearch("");
                                    setCategory("All");
                                }}
                            >
                                Clear filters
                            </Button>
                        )}
                    </div>
                )}

                {/* Playbook Grid */}
                {!loading && playbooks.length > 0 && (
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {playbooks.map((pb) => (
                            <Link key={pb.id} href={`/marketplace/${pb.slug}`} className="group">
                                <div className="relative h-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60 transition-all duration-200 group-hover:border-zinc-700 group-hover:bg-zinc-900/80 group-hover:shadow-lg group-hover:shadow-black/20">
                                    {/* Gradient accent bar */}
                                    <div
                                        className={`absolute inset-x-0 top-0 h-px bg-linear-to-r ${getCategoryGradient(pb.category)} opacity-0 transition-opacity group-hover:opacity-100`}
                                    />

                                    <div className="p-5">
                                        {/* Header row */}
                                        <div className="mb-3 flex items-start gap-3">
                                            <div
                                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-linear-to-br ${getCategoryGradient(pb.category)}`}
                                            >
                                                <BotIcon
                                                    className={`h-5 w-5 ${getCategoryIconColor(pb.category)}`}
                                                />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h3 className="truncate leading-tight font-semibold text-zinc-100 group-hover:text-white">
                                                    {pb.name}
                                                </h3>
                                                <p className="mt-0.5 text-xs text-zinc-500">
                                                    by {pb.publisherOrg.name}
                                                </p>
                                            </div>
                                            <Badge
                                                variant="outline"
                                                className={`shrink-0 text-xs ${
                                                    pb.pricingModel === "FREE"
                                                        ? "border-emerald-500/30 text-emerald-400"
                                                        : "border-zinc-700 text-zinc-300"
                                                }`}
                                            >
                                                {formatPrice(pb)}
                                            </Badge>
                                        </div>

                                        {/* Description */}
                                        <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-zinc-400">
                                            {pb.tagline ?? pb.description}
                                        </p>

                                        {/* Tags row */}
                                        {pb.tags.length > 0 && (
                                            <div className="mb-4 flex flex-wrap gap-1.5">
                                                {pb.tags.slice(0, 3).map((tag) => (
                                                    <span
                                                        key={tag}
                                                        className="rounded-md bg-zinc-800/80 px-2 py-0.5 text-[11px] text-zinc-500"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                                {pb.tags.length > 3 && (
                                                    <span className="rounded-md bg-zinc-800/80 px-2 py-0.5 text-[11px] text-zinc-500">
                                                        +{pb.tags.length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Footer stats */}
                                        <div className="flex items-center gap-3 border-t border-zinc-800/60 pt-3 text-xs">
                                            <span className="flex items-center gap-1 text-zinc-500">
                                                <DownloadIcon className="h-3 w-3" />
                                                {pb.installCount}
                                            </span>
                                            {pb.averageRating != null && (
                                                <span className="flex items-center gap-1 text-zinc-500">
                                                    <StarIcon className="h-3 w-3 fill-amber-400 text-amber-400" />
                                                    {pb.averageRating.toFixed(1)}
                                                </span>
                                            )}
                                            {pb.trustScore != null && pb.trustScore > 70 && (
                                                <span className="flex items-center gap-1 text-emerald-500">
                                                    <ShieldCheckIcon className="h-3 w-3" />
                                                    Verified
                                                </span>
                                            )}
                                            <span className="ml-auto text-zinc-600">
                                                v{pb.version}
                                            </span>
                                            {pb._count.components > 0 && (
                                                <span className="flex items-center gap-1 text-zinc-600">
                                                    <PackageIcon className="h-3 w-3" />
                                                    {pb._count.components}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
