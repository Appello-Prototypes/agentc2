"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface NetworkDetail {
    id: string;
    slug: string;
    name: string;
    description?: string | null;
    version: number;
    isPublished: boolean;
    isActive: boolean;
    runCount: number;
    primitiveCount?: number;
}

interface NetworkMetric {
    date: string;
    runs: number;
    successRate?: number | null;
    avgDurationMs?: number | null;
}

const formatDuration = (durationMs?: number | null) => {
    if (!durationMs || durationMs <= 0) return "--";
    if (durationMs < 1000) return `${Math.round(durationMs)}ms`;
    const seconds = durationMs / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.round(seconds % 60);
    return `${minutes}m ${remainder}s`;
};

export default function NetworkOverviewPage() {
    const params = useParams();
    const networkSlug = params.networkSlug as string;
    const [network, setNetwork] = useState<NetworkDetail | null>(null);
    const [metrics, setMetrics] = useState<NetworkMetric[]>([]);

    useEffect(() => {
        const fetchNetwork = async () => {
            const res = await fetch(`${getApiBase()}/api/networks/${networkSlug}`);
            const data = await res.json();
            setNetwork(data.network || null);
        };
        fetchNetwork();

        const fetchMetrics = async () => {
            const res = await fetch(`${getApiBase()}/api/networks/${networkSlug}/metrics?days=7`);
            const data = await res.json();
            setMetrics(data.metrics || []);
        };
        fetchMetrics();
    }, [networkSlug]);

    if (!network) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Loading network...</CardTitle>
                </CardHeader>
            </Card>
        );
    }

    const totalRuns = metrics.reduce((sum, metric) => sum + metric.runs, 0);
    const weightedSuccess = metrics.reduce((sum, metric) => {
        if (metric.successRate === null || metric.successRate === undefined) return sum;
        return sum + metric.successRate * metric.runs;
    }, 0);
    const weightedRunsForSuccess = metrics.reduce((sum, metric) => {
        if (metric.successRate === null || metric.successRate === undefined) return sum;
        return sum + metric.runs;
    }, 0);
    const averageSuccessRate =
        weightedRunsForSuccess > 0 ? weightedSuccess / weightedRunsForSuccess : null;
    const weightedDuration = metrics.reduce((sum, metric) => {
        if (metric.avgDurationMs === null || metric.avgDurationMs === undefined) return sum;
        return sum + metric.avgDurationMs * metric.runs;
    }, 0);
    const weightedRunsForDuration = metrics.reduce((sum, metric) => {
        if (metric.avgDurationMs === null || metric.avgDurationMs === undefined) return sum;
        return sum + metric.runs;
    }, 0);
    const averageDurationMs =
        weightedRunsForDuration > 0 ? weightedDuration / weightedRunsForDuration : null;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold">{network.name}</h1>
                    <p className="text-muted-foreground text-sm">{network.description}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Badge variant={network.isActive ? "default" : "secondary"}>
                        {network.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant={network.isPublished ? "default" : "secondary"}>
                        {network.isPublished ? "Published" : "Draft"}
                    </Badge>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total runs (7d)</CardDescription>
                        <CardTitle className="text-2xl">{totalRuns}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Success rate</CardDescription>
                        <CardTitle className="text-2xl">
                            {averageSuccessRate === null
                                ? "--"
                                : `${Math.round(averageSuccessRate * 100)}%`}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Avg duration</CardDescription>
                        <CardTitle className="text-2xl">
                            {formatDuration(averageDurationMs)}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Current version</CardDescription>
                        <CardTitle className="text-2xl">v{network.version}</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Operational summary</CardTitle>
                        <CardDescription>Key network configuration and health.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Total runs</span>
                            <span className="font-medium">{network.runCount}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Current version</span>
                            <span className="font-medium">v{network.version}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Primitives</span>
                            <span className="font-medium">{network.primitiveCount ?? "--"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Publish state</span>
                            <span className="font-medium">
                                {network.isPublished ? "Published" : "Draft"}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Status</span>
                            <span className="font-medium">
                                {network.isActive ? "Active" : "Inactive"}
                            </span>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Last 7 days</CardTitle>
                        <CardDescription>Daily network run metrics.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        {metrics.length === 0 ? (
                            <div className="text-muted-foreground">No metrics yet.</div>
                        ) : (
                            metrics.map((metric) => (
                                <div
                                    key={metric.date}
                                    className="flex items-center justify-between"
                                >
                                    <span>{new Date(metric.date).toLocaleDateString()}</span>
                                    <span className="text-muted-foreground">
                                        Runs: {metric.runs} · Success:{" "}
                                        {metric.successRate !== null &&
                                        metric.successRate !== undefined
                                            ? `${Math.round(metric.successRate * 100)}%`
                                            : "--"}
                                    </span>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
