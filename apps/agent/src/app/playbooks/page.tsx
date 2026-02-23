"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { PlusIcon, PackageIcon, StarIcon, DownloadIcon } from "lucide-react";

interface PlaybookSummary {
    id: string;
    slug: string;
    name: string;
    tagline: string | null;
    status: string;
    category: string;
    pricingModel: string;
    priceUsd: number | null;
    installCount: number;
    averageRating: number | null;
    reviewCount: number;
    trustScore: number | null;
    version: number;
    createdAt: string;
    updatedAt: string;
    _count: { components: number; purchases: number };
}

export default function PlaybooksPage() {
    const router = useRouter();
    const [playbooks, setPlaybooks] = useState<PlaybookSummary[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchPlaybooks() {
            try {
                const res = await fetch(`${getApiBase()}/api/playbooks/my/published`);
                const data = await res.json();
                setPlaybooks(data.playbooks ?? []);
            } catch (error) {
                console.error("Failed to fetch playbooks:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchPlaybooks();
    }, []);

    const statusColor: Record<string, string> = {
        DRAFT: "bg-zinc-500/10 text-zinc-400",
        PENDING_REVIEW: "bg-yellow-500/10 text-yellow-400",
        PUBLISHED: "bg-green-500/10 text-green-400",
        SUSPENDED: "bg-red-500/10 text-red-400",
        ARCHIVED: "bg-zinc-500/10 text-zinc-500"
    };

    return (
        <div className="mx-auto max-w-6xl px-6 py-8">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Playbooks</h1>
                    <p className="text-muted-foreground mt-1">
                        Package, publish, and manage your agent playbooks
                    </p>
                </div>
                <Button onClick={() => router.push("/playbooks/new")}>
                    <PlusIcon className="mr-2 h-4 w-4" />
                    New Playbook
                </Button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="text-muted-foreground">Loading playbooks...</div>
                </div>
            ) : playbooks.length === 0 ? (
                <Card className="py-20 text-center">
                    <CardContent>
                        <PackageIcon className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                        <h3 className="mb-2 text-lg font-medium">No playbooks yet</h3>
                        <p className="text-muted-foreground mb-4">
                            Create your first playbook to package and share your agent systems.
                        </p>
                        <Button onClick={() => router.push("/playbooks/new")}>
                            <PlusIcon className="mr-2 h-4 w-4" />
                            Create Playbook
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {playbooks.map((pb) => (
                        <Link key={pb.id} href={`/playbooks/${pb.slug}`}>
                            <Card className="hover:border-primary/50 cursor-pointer transition-colors">
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between">
                                        <CardTitle className="text-base">{pb.name}</CardTitle>
                                        <Badge className={statusColor[pb.status] ?? ""}>
                                            {pb.status.replace("_", " ")}
                                        </Badge>
                                    </div>
                                    {pb.tagline && (
                                        <p className="text-muted-foreground text-sm">
                                            {pb.tagline}
                                        </p>
                                    )}
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center gap-4 text-sm">
                                        <span className="text-muted-foreground flex items-center gap-1">
                                            <PackageIcon className="h-3.5 w-3.5" />
                                            {pb._count.components} components
                                        </span>
                                        <span className="text-muted-foreground flex items-center gap-1">
                                            <DownloadIcon className="h-3.5 w-3.5" />
                                            {pb.installCount} installs
                                        </span>
                                        {pb.averageRating && (
                                            <span className="text-muted-foreground flex items-center gap-1">
                                                <StarIcon className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                                                {pb.averageRating.toFixed(1)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-2 text-xs text-zinc-500">
                                        v{pb.version} ·{" "}
                                        {pb.pricingModel === "FREE" ? "Free" : `$${pb.priceUsd}`}
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
