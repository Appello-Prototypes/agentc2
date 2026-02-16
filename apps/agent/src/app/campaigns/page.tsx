"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@repo/ui";

interface CampaignSummary {
    id: string;
    slug: string;
    name: string;
    status: string;
    intent: string;
    progress: number;
    totalCostUsd: number;
    maxCostUsd: number | null;
    createdAt: string;
    completedAt: string | null;
    missions: { id: string; name: string; status: string; sequence: number }[];
    _count: { missions: number; logs: number };
    aarJson: Record<string, unknown> | null;
}

function statusColor(status: string): string {
    switch (status) {
        case "COMPLETE":
            return "bg-emerald-500/10 text-emerald-600 border-emerald-200";
        case "EXECUTING":
            return "bg-blue-500/10 text-blue-600 border-blue-200";
        case "ANALYZING":
        case "PLANNING":
            return "bg-amber-500/10 text-amber-600 border-amber-200";
        case "READY":
            return "bg-indigo-500/10 text-indigo-600 border-indigo-200";
        case "FAILED":
            return "bg-red-500/10 text-red-600 border-red-200";
        case "PAUSED":
        case "REWORK":
            return "bg-orange-500/10 text-orange-600 border-orange-200";
        case "REVIEWING":
            return "bg-purple-500/10 text-purple-600 border-purple-200";
        case "AWAITING_APPROVAL":
            return "bg-yellow-500/10 text-yellow-600 border-yellow-200";
        default:
            return "bg-muted text-muted-foreground";
    }
}

function formatCost(usd: number): string {
    return `$${usd.toFixed(2)}`;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

export default function CampaignsPage() {
    const router = useRouter();
    const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const fetchCampaigns = useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/campaigns?limit=50`);
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            setCampaigns(data.campaigns);
        } catch (err) {
            console.error("Failed to load campaigns:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCampaigns();
        // Poll for updates every 5 seconds
        const interval = setInterval(fetchCampaigns, 5000);
        return () => clearInterval(interval);
    }, [fetchCampaigns]);

    const activeCampaigns = campaigns.filter(
        (c) =>
            c.status === "EXECUTING" ||
            c.status === "ANALYZING" ||
            c.status === "PLANNING" ||
            c.status === "READY" ||
            c.status === "PAUSED" ||
            c.status === "REVIEWING" ||
            c.status === "REWORK" ||
            c.status === "AWAITING_APPROVAL"
    );
    const completedCampaigns = campaigns.filter(
        (c) => c.status === "COMPLETE" || c.status === "FAILED"
    );

    return (
        <div className="mx-auto max-w-6xl space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Define objectives and let the platform execute autonomously.
                    </p>
                </div>
                <Button onClick={() => router.push("/campaigns/new")}>+ New Campaign</Button>
            </div>

            {loading ? (
                <div className="space-y-4">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
            ) : campaigns.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <p className="text-muted-foreground mb-4 text-sm">
                            No campaigns yet. Create your first campaign to get started.
                        </p>
                        <Button onClick={() => router.push("/campaigns/new")}>
                            Create Campaign
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Active Campaigns */}
                    {activeCampaigns.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base font-medium">
                                    Active ({activeCampaigns.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Campaign</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Progress</TableHead>
                                            <TableHead>Cost</TableHead>
                                            <TableHead>Missions</TableHead>
                                            <TableHead>Created</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {activeCampaigns.map((c) => (
                                            <TableRow
                                                key={c.id}
                                                className="cursor-pointer"
                                                onClick={() => router.push(`/campaigns/${c.id}`)}
                                            >
                                                <TableCell>
                                                    <div>
                                                        <div className="font-medium">{c.name}</div>
                                                        <div className="text-muted-foreground max-w-xs truncate text-xs">
                                                            {c.intent}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="outline"
                                                        className={statusColor(c.status)}
                                                    >
                                                        {c.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <div className="bg-muted h-2 w-20 rounded-full">
                                                            <div
                                                                className="h-2 rounded-full bg-blue-500 transition-all"
                                                                style={{
                                                                    width: `${Math.min(c.progress, 100)}%`
                                                                }}
                                                            />
                                                        </div>
                                                        <span className="text-muted-foreground text-xs">
                                                            {Math.round(c.progress)}%
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-sm">
                                                    {formatCost(c.totalCostUsd)}
                                                    {c.maxCostUsd
                                                        ? ` / ${formatCost(c.maxCostUsd)}`
                                                        : ""}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-sm">
                                                    {
                                                        c.missions.filter(
                                                            (m) => m.status === "COMPLETE"
                                                        ).length
                                                    }
                                                    /{c._count.missions}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-sm">
                                                    {formatDate(c.createdAt)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}

                    {/* Completed Campaigns */}
                    {completedCampaigns.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base font-medium">
                                    Recent ({completedCampaigns.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Campaign</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Progress</TableHead>
                                            <TableHead>Cost</TableHead>
                                            <TableHead>Score</TableHead>
                                            <TableHead>Completed</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {completedCampaigns.map((c) => {
                                            const aar = c.aarJson as Record<string, unknown> | null;
                                            const score =
                                                typeof aar?.avgTaskScore === "number"
                                                    ? aar.avgTaskScore
                                                    : null;

                                            return (
                                                <TableRow
                                                    key={c.id}
                                                    className="cursor-pointer"
                                                    onClick={() =>
                                                        router.push(`/campaigns/${c.id}`)
                                                    }
                                                >
                                                    <TableCell>
                                                        <div>
                                                            <div className="font-medium">
                                                                {c.name}
                                                            </div>
                                                            <div className="text-muted-foreground max-w-xs truncate text-xs">
                                                                {c.intent}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant="outline"
                                                            className={statusColor(c.status)}
                                                        >
                                                            {c.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-sm">
                                                        {Math.round(c.progress)}%
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-sm">
                                                        {formatCost(c.totalCostUsd)}
                                                    </TableCell>
                                                    <TableCell>
                                                        {score !== null ? (
                                                            <span
                                                                className={`text-sm font-medium ${score >= 0.8 ? "text-emerald-600" : score >= 0.5 ? "text-amber-600" : "text-red-600"}`}
                                                            >
                                                                {score.toFixed(2)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground text-sm">
                                                                --
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-sm">
                                                        {c.completedAt
                                                            ? formatDate(c.completedAt)
                                                            : "--"}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
