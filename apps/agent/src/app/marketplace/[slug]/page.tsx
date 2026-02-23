"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import {
    ArrowLeftIcon,
    StarIcon,
    DownloadIcon,
    ShieldCheckIcon,
    PackageIcon,
    LayersIcon,
    RocketIcon
} from "lucide-react";

interface PlaybookDetail {
    id: string;
    slug: string;
    name: string;
    tagline: string | null;
    description: string;
    longDescription: string | null;
    category: string;
    tags: string[];
    status: string;
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
    components: Array<{
        id: string;
        componentType: string;
        sourceSlug: string;
        isEntryPoint: boolean;
    }>;
    versions: Array<{
        id: string;
        version: number;
        changelog: string | null;
        createdAt: string;
    }>;
    reviews: Array<{
        id: string;
        rating: number;
        title: string | null;
        body: string | null;
        createdAt: string;
        reviewerOrg: { name: string; slug: string };
    }>;
}

export default function MarketplaceDetailPage(props: { params: Promise<{ slug: string }> }) {
    const { slug } = use(props.params);
    const router = useRouter();
    const [playbook, setPlaybook] = useState<PlaybookDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchPlaybook() {
            try {
                const res = await fetch(`${getApiBase()}/api/playbooks/${slug}`);
                const data = await res.json();
                setPlaybook(data.playbook);
            } catch (error) {
                console.error("Failed to fetch playbook:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchPlaybook();
    }, [slug]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-muted-foreground">Loading...</div>
            </div>
        );
    }

    if (!playbook) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-muted-foreground">Playbook not found</div>
            </div>
        );
    }

    function formatPrice() {
        if (!playbook) return "Free";
        if (playbook.pricingModel === "FREE") return "Free";
        if (playbook.pricingModel === "ONE_TIME") return `$${playbook.priceUsd}`;
        if (playbook.pricingModel === "SUBSCRIPTION") return `$${playbook.monthlyPriceUsd}/mo`;
        return `$${playbook.priceUsd}/use`;
    }

    const componentsByType = playbook.components.reduce(
        (acc, comp) => {
            acc[comp.componentType] = (acc[comp.componentType] ?? 0) + 1;
            return acc;
        },
        {} as Record<string, number>
    );

    return (
        <div className="mx-auto max-w-5xl px-6 py-8">
            <button
                onClick={() => router.push("/marketplace")}
                className="text-muted-foreground hover:text-foreground mb-6 flex items-center gap-2 text-sm"
            >
                <ArrowLeftIcon className="h-4 w-4" />
                Back to Marketplace
            </button>

            <div className="grid gap-8 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <div>
                        <div className="mb-2 flex items-center gap-2 text-sm text-zinc-500">
                            <span>by {playbook.publisherOrg.name}</span>
                            <span>·</span>
                            <span>{playbook.category}</span>
                        </div>
                        <h1 className="text-3xl font-bold">{playbook.name}</h1>
                        {playbook.tagline && (
                            <p className="text-muted-foreground mt-2 text-lg">{playbook.tagline}</p>
                        )}

                        <div className="mt-4 flex items-center gap-4">
                            <span className="text-muted-foreground flex items-center gap-1 text-sm">
                                <DownloadIcon className="h-4 w-4" />
                                {playbook.installCount} installs
                            </span>
                            {playbook.averageRating && (
                                <span className="flex items-center gap-1 text-sm">
                                    <StarIcon className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                    {playbook.averageRating.toFixed(1)} ({playbook.reviewCount}{" "}
                                    reviews)
                                </span>
                            )}
                            {playbook.trustScore && (
                                <span className="flex items-center gap-1 text-sm text-green-400">
                                    <ShieldCheckIcon className="h-4 w-4" />
                                    Trust Score: {Math.round(playbook.trustScore)}
                                </span>
                            )}
                        </div>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Description</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="prose prose-sm prose-invert max-w-none whitespace-pre-wrap">
                                {playbook.longDescription ?? playbook.description}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <LayersIcon className="h-5 w-5" />
                                Components ({playbook.components.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="mb-4 flex flex-wrap gap-3">
                                {Object.entries(componentsByType).map(([type, count]) => (
                                    <div
                                        key={type}
                                        className="flex items-center gap-2 rounded-md border px-3 py-1.5"
                                    >
                                        <PackageIcon className="text-muted-foreground h-3.5 w-3.5" />
                                        <span className="text-sm">
                                            {count} {type.toLowerCase()}
                                            {count !== 1 ? "s" : ""}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div className="space-y-2">
                                {playbook.components.map((comp) => (
                                    <div
                                        key={comp.id}
                                        className="flex items-center justify-between rounded border px-3 py-2"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm">{comp.sourceSlug}</span>
                                            <Badge variant="outline" className="text-xs">
                                                {comp.componentType}
                                            </Badge>
                                        </div>
                                        {comp.isEntryPoint && (
                                            <Badge className="bg-blue-500/10 text-xs text-blue-400">
                                                Entry Point
                                            </Badge>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {playbook.reviews.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Reviews</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {playbook.reviews.map((review) => (
                                    <div key={review.id} className="border-b pb-4 last:border-0">
                                        <div className="flex items-center gap-2">
                                            <div className="flex">
                                                {Array.from({ length: 5 }).map((_, i) => (
                                                    <StarIcon
                                                        key={i}
                                                        className={`h-3.5 w-3.5 ${
                                                            i < review.rating
                                                                ? "fill-yellow-400 text-yellow-400"
                                                                : "text-zinc-600"
                                                        }`}
                                                    />
                                                ))}
                                            </div>
                                            <span className="text-muted-foreground text-xs">
                                                {review.reviewerOrg.name}
                                            </span>
                                            <span className="text-muted-foreground text-xs">
                                                {new Date(review.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        {review.title && (
                                            <p className="mt-1 text-sm font-medium">
                                                {review.title}
                                            </p>
                                        )}
                                        {review.body && (
                                            <p className="text-muted-foreground mt-1 text-sm">
                                                {review.body}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </div>

                <div className="space-y-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="mb-4 text-center">
                                <p className="text-2xl font-bold">{formatPrice()}</p>
                                {playbook.pricingModel !== "FREE" && (
                                    <p className="text-muted-foreground mt-1 text-xs">
                                        {playbook.pricingModel === "SUBSCRIPTION"
                                            ? "per month"
                                            : playbook.pricingModel === "PER_USE"
                                              ? "per use"
                                              : "one-time"}
                                    </p>
                                )}
                            </div>
                            <Link href={`/marketplace/${slug}/deploy`}>
                                <Button className="w-full" size="lg">
                                    <RocketIcon className="mr-2 h-4 w-4" />
                                    {playbook.pricingModel === "FREE"
                                        ? "Deploy Free"
                                        : "Purchase & Deploy"}
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>

                    {playbook.requiredIntegrations.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">Required Integrations</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-1">
                                    {playbook.requiredIntegrations.map((int) => (
                                        <div
                                            key={int}
                                            className="flex items-center gap-2 text-sm capitalize"
                                        >
                                            <PackageIcon className="text-muted-foreground h-3.5 w-3.5" />
                                            {int}
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {playbook.versions.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">Version History</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {playbook.versions.map((v) => (
                                    <div key={v.id} className="text-sm">
                                        <span className="font-medium">v{v.version}</span>
                                        <span className="text-muted-foreground ml-2 text-xs">
                                            {new Date(v.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {playbook.tags.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">Tags</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-1">
                                    {playbook.tags.map((tag) => (
                                        <Badge key={tag} variant="outline" className="text-xs">
                                            {tag}
                                        </Badge>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
