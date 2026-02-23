"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getApiBase } from "@/lib/utils";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@repo/ui";
import { SearchIcon, StarIcon, DownloadIcon, ShieldCheckIcon, PackageIcon } from "lucide-react";

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

const CATEGORIES = [
    "All",
    "Customer Support",
    "Sales",
    "Marketing",
    "Operations",
    "Research",
    "Finance",
    "HR",
    "Engineering"
];

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

    function formatPrice(pb: MarketplacePlaybook) {
        if (pb.pricingModel === "FREE") return "Free";
        if (pb.pricingModel === "ONE_TIME") return `$${pb.priceUsd}`;
        if (pb.pricingModel === "SUBSCRIPTION") return `$${pb.monthlyPriceUsd}/mo`;
        return `$${pb.priceUsd}/use`;
    }

    return (
        <div className="mx-auto max-w-7xl px-6 py-8">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold">Playbook Marketplace</h1>
                <p className="text-muted-foreground mt-2 text-lg">
                    Deploy pre-built AI agent systems to your workspace in minutes
                </p>
            </div>

            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                    <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search playbooks..."
                        className="pl-9"
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto">
                    {CATEGORIES.map((cat) => (
                        <Button
                            key={cat}
                            variant={category === cat ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCategory(cat)}
                            className="whitespace-nowrap"
                        >
                            {cat}
                        </Button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="text-muted-foreground">Loading marketplace...</div>
                </div>
            ) : playbooks.length === 0 ? (
                <div className="py-20 text-center">
                    <PackageIcon className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                    <h3 className="mb-2 text-lg font-medium">No playbooks found</h3>
                    <p className="text-muted-foreground">
                        {search
                            ? "Try a different search term"
                            : "Check back soon for new playbooks"}
                    </p>
                </div>
            ) : (
                <>
                    <p className="text-muted-foreground mb-4 text-sm">
                        {total} playbook{total !== 1 ? "s" : ""} available
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {playbooks.map((pb) => (
                            <Link key={pb.id} href={`/marketplace/${pb.slug}`}>
                                <Card className="hover:border-primary/50 h-full cursor-pointer transition-colors">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <CardTitle className="text-base leading-tight">
                                                    {pb.name}
                                                </CardTitle>
                                                <p className="text-muted-foreground mt-1 text-xs">
                                                    by {pb.publisherOrg.name}
                                                </p>
                                            </div>
                                            <Badge
                                                variant="outline"
                                                className="ml-2 shrink-0 text-xs"
                                            >
                                                {formatPrice(pb)}
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        {pb.tagline && (
                                            <p className="text-muted-foreground mb-3 line-clamp-2 text-sm">
                                                {pb.tagline}
                                            </p>
                                        )}
                                        <div className="flex flex-wrap items-center gap-3 text-xs">
                                            <span className="text-muted-foreground flex items-center gap-1">
                                                <DownloadIcon className="h-3 w-3" />
                                                {pb.installCount}
                                            </span>
                                            {pb.averageRating && (
                                                <span className="text-muted-foreground flex items-center gap-1">
                                                    <StarIcon className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                                    {pb.averageRating.toFixed(1)}
                                                </span>
                                            )}
                                            {pb.trustScore && pb.trustScore > 70 && (
                                                <span className="flex items-center gap-1 text-green-400">
                                                    <ShieldCheckIcon className="h-3 w-3" />
                                                    {Math.round(pb.trustScore)}
                                                </span>
                                            )}
                                            <Badge variant="outline" className="text-[10px]">
                                                {pb.category}
                                            </Badge>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
