"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { ArrowLeftIcon, PackageIcon, StarIcon, DownloadIcon, SendIcon } from "lucide-react";

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
    installCount: number;
    averageRating: number | null;
    reviewCount: number;
    trustScore: number | null;
    requiredIntegrations: string[];
    version: number;
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
}

export default function PlaybookManagePage(props: { params: Promise<{ slug: string }> }) {
    const { slug } = use(props.params);
    const router = useRouter();
    const [playbook, setPlaybook] = useState<PlaybookDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

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

    async function handlePublish() {
        if (!playbook) return;
        setActionLoading(true);
        try {
            const res = await fetch(`${getApiBase()}/api/playbooks/${slug}/publish`, {
                method: "POST"
            });
            if (res.ok) {
                const data = await res.json();
                setPlaybook(data.playbook);
            }
        } catch (error) {
            console.error("Publish failed:", error);
        } finally {
            setActionLoading(false);
        }
    }

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

    const statusColor: Record<string, string> = {
        DRAFT: "bg-zinc-500/10 text-zinc-400",
        PENDING_REVIEW: "bg-yellow-500/10 text-yellow-400",
        PUBLISHED: "bg-green-500/10 text-green-400",
        SUSPENDED: "bg-red-500/10 text-red-400",
        ARCHIVED: "bg-zinc-500/10 text-zinc-500"
    };

    return (
        <div className="mx-auto max-w-4xl px-6 py-8">
            <button
                onClick={() => router.push("/playbooks")}
                className="text-muted-foreground hover:text-foreground mb-6 flex items-center gap-2 text-sm"
            >
                <ArrowLeftIcon className="h-4 w-4" />
                Back to Playbooks
            </button>

            <div className="mb-6 flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold">{playbook.name}</h1>
                        <Badge className={statusColor[playbook.status] ?? ""}>
                            {playbook.status.replace("_", " ")}
                        </Badge>
                    </div>
                    {playbook.tagline && (
                        <p className="text-muted-foreground mt-1">{playbook.tagline}</p>
                    )}
                </div>
                <div className="flex gap-2">
                    {playbook.status === "DRAFT" && playbook.components.length > 0 && (
                        <Button onClick={handlePublish} disabled={actionLoading}>
                            <SendIcon className="mr-2 h-4 w-4" />
                            Submit for Review
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Description</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm whitespace-pre-wrap">{playbook.description}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Components ({playbook.components.length})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {playbook.components.length === 0 ? (
                                <p className="text-muted-foreground text-sm">
                                    No components yet. Use the Package action to snapshot your agent
                                    system.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {playbook.components.map((comp) => (
                                        <div
                                            key={comp.id}
                                            className="flex items-center justify-between rounded-md border px-3 py-2"
                                        >
                                            <div className="flex items-center gap-2">
                                                <PackageIcon className="text-muted-foreground h-4 w-4" />
                                                <span className="text-sm font-medium">
                                                    {comp.sourceSlug}
                                                </span>
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
                            )}
                        </CardContent>
                    </Card>

                    {playbook.versions.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Version History</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {playbook.versions.map((v) => (
                                        <div key={v.id} className="border-b pb-3 last:border-0">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium">
                                                    v{v.version}
                                                </span>
                                                <span className="text-muted-foreground text-xs">
                                                    {new Date(v.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                            {v.changelog && (
                                                <p className="text-muted-foreground mt-1 text-sm">
                                                    {v.changelog}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">Stats</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground flex items-center gap-1">
                                    <DownloadIcon className="h-3.5 w-3.5" /> Installs
                                </span>
                                <span className="font-medium">{playbook.installCount}</span>
                            </div>
                            {playbook.averageRating && (
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground flex items-center gap-1">
                                        <StarIcon className="h-3.5 w-3.5" /> Rating
                                    </span>
                                    <span className="font-medium">
                                        {playbook.averageRating.toFixed(1)} ({playbook.reviewCount})
                                    </span>
                                </div>
                            )}
                            {playbook.trustScore && (
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Trust Score</span>
                                    <span className="font-medium">
                                        {Math.round(playbook.trustScore)}
                                    </span>
                                </div>
                            )}
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Version</span>
                                <span className="font-medium">v{playbook.version}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Pricing</span>
                                <span className="font-medium">
                                    {playbook.pricingModel === "FREE"
                                        ? "Free"
                                        : `$${playbook.priceUsd}`}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {playbook.requiredIntegrations.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">Required Integrations</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-1">
                                    {playbook.requiredIntegrations.map((int) => (
                                        <Badge key={int} variant="outline" className="text-xs">
                                            {int}
                                        </Badge>
                                    ))}
                                </div>
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
