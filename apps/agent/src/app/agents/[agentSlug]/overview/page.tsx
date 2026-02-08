"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Badge,
    Button,
    Skeleton
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface AgentStats {
    totalRuns: number;
    successRate: number;
    avgDurationMs: number;
    avgQualityScore: number;
    totalCostUsd: number;
    completedRuns: number;
    failedRuns: number;
    totalTokens: number;
}

interface RecentRun {
    id: string;
    inputPreview: string;
    status: string;
    durationMs: number | null;
    startedAt: string;
    tokens: number | null;
    cost: number | null;
    runType: string;
}

interface Alert {
    id: string;
    severity: string;
    message: string;
    source: string;
    createdAt: string;
}

interface LearningData {
    status: "active" | "paused" | "inactive";
    policy: {
        enabled: boolean;
        autoPromotionEnabled: boolean;
        scheduledEnabled: boolean;
        thresholdEnabled: boolean;
        paused: boolean;
        pausedUntil: string | null;
    } | null;
    activeExperiments: number;
    latestSession: {
        id: string;
        status: string;
        createdAt: string;
        triggerType?: string;
    } | null;
    stats: {
        autoPromotions: number;
        manualPromotions: number;
        shadowRunCount: number;
        scheduledTriggers: number;
        thresholdTriggers: number;
    };
}

interface OverviewData {
    stats: AgentStats;
    recentRuns: RecentRun[];
    alerts: Alert[];
    health: "healthy" | "warning" | "critical";
    agent: {
        id: string;
        slug: string;
        name: string;
        isActive: boolean;
        version: number;
    };
    learning?: LearningData;
}

function HealthIndicator({ health }: { health: "healthy" | "warning" | "critical" }) {
    const colors = {
        healthy: "bg-green-500",
        warning: "bg-yellow-500",
        critical: "bg-red-500"
    };
    const labels = {
        healthy: "Healthy",
        warning: "Warning",
        critical: "Critical"
    };

    return (
        <div className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${colors[health]} animate-pulse`} />
            <span className="text-sm font-medium">{labels[health]}</span>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const variants: Record<string, "default" | "destructive" | "secondary"> = {
        COMPLETED: "default",
        FAILED: "destructive",
        RUNNING: "secondary",
        QUEUED: "secondary",
        CANCELLED: "secondary"
    };
    return <Badge variant={variants[status] || "secondary"}>{status.toLowerCase()}</Badge>;
}

export default function OverviewPage() {
    const params = useParams();
    const router = useRouter();
    const agentSlug = params.agentSlug as string;
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<OverviewData | null>(null);

    const fetchOverview = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch(`${getApiBase()}/api/agents/${agentSlug}/overview`);
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || "Failed to fetch overview");
            }

            setData({
                stats: result.stats,
                recentRuns: result.recentRuns,
                alerts: result.alerts,
                health: result.health,
                agent: result.agent,
                learning: result.learning
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load overview");
        } finally {
            setLoading(false);
        }
    }, [agentSlug]);

    useEffect(() => {
        fetchOverview();
    }, [fetchOverview]);

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Skeleton key={i} className="h-24" />
                    ))}
                </div>
                <Skeleton className="h-96" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <p className="text-destructive mb-4">{error}</p>
                <Button onClick={fetchOverview}>Retry</Button>
            </div>
        );
    }

    const stats = data?.stats;
    const recentRuns = data?.recentRuns || [];
    const alerts = data?.alerts || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Overview</h1>
                    <p className="text-muted-foreground">
                        Health and activity dashboard for this agent
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <HealthIndicator health={data?.health || "healthy"} />
                    <Button onClick={() => router.push(`/agents/${agentSlug}/test`)}>
                        Run Test
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Runs</CardDescription>
                        <CardTitle className="text-2xl">
                            {stats?.totalRuns?.toLocaleString() || 0}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-xs">
                            {stats?.completedRuns || 0} completed
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Success Rate</CardDescription>
                        <CardTitle className="text-2xl text-green-600">
                            {stats?.successRate?.toFixed(1) || 0}%
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-xs">Last 7 days</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Avg Latency</CardDescription>
                        <CardTitle className="text-2xl">
                            {((stats?.avgDurationMs || 0) / 1000).toFixed(1)}s
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-xs">p50 response time</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Quality Score</CardDescription>
                        <CardTitle className="text-2xl">
                            {stats?.avgQualityScore?.toFixed(0) || 0}%
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-xs">Composite score</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Tokens</CardDescription>
                        <CardTitle className="text-2xl">
                            {stats?.totalTokens?.toLocaleString() || 0}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-xs">This period</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Cost</CardDescription>
                        <CardTitle className="text-2xl">
                            ${stats?.totalCostUsd?.toFixed(4) || "0.00"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-xs">This period</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Recent Activity */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Recent Activity</CardTitle>
                                <CardDescription>Latest runs from this agent</CardDescription>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(`/agents/${agentSlug}/runs`)}
                            >
                                View All
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {recentRuns.length === 0 ? (
                            <p className="text-muted-foreground py-8 text-center">
                                No runs yet. Run a test to get started.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {recentRuns.map((run) => (
                                    <div
                                        key={run.id}
                                        className="hover:bg-muted/50 flex cursor-pointer items-start gap-4 rounded-lg border p-3 transition-colors"
                                        onClick={() =>
                                            router.push(`/agents/${agentSlug}/runs?run=${run.id}`)
                                        }
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate font-medium">
                                                {run.inputPreview}
                                            </p>
                                            <div className="mt-2 flex items-center gap-2">
                                                <StatusBadge status={run.status} />
                                                <span className="text-muted-foreground text-xs">
                                                    {run.durationMs
                                                        ? `${(run.durationMs / 1000).toFixed(1)}s`
                                                        : "-"}
                                                </span>
                                                {run.tokens && (
                                                    <span className="text-muted-foreground text-xs">
                                                        • {run.tokens} tokens
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-muted-foreground shrink-0 text-xs">
                                            {new Date(run.startedAt).toLocaleTimeString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Alerts, Learning & Quick Actions */}
                <div className="space-y-6">
                    {/* Continuous Learning Status */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base">Continuous Learning</CardTitle>
                                    <CardDescription>Autonomous improvement</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div
                                        className={`h-2 w-2 rounded-full ${
                                            data?.learning?.status === "active"
                                                ? "bg-green-500"
                                                : data?.learning?.status === "paused"
                                                  ? "bg-yellow-500"
                                                  : "bg-gray-400"
                                        }`}
                                    />
                                    <span className="text-muted-foreground text-xs capitalize">
                                        {data?.learning?.status || "inactive"}
                                    </span>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {/* Active Experiments */}
                            {data?.learning?.activeExperiments ? (
                                <div className="bg-muted/50 flex items-center justify-between rounded-lg p-2">
                                    <span className="text-sm">Active Experiments</span>
                                    <Badge variant="secondary">
                                        {data.learning.activeExperiments}
                                    </Badge>
                                </div>
                            ) : null}

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="bg-muted/30 rounded p-2">
                                    <p className="text-muted-foreground text-xs">Auto Promoted</p>
                                    <p className="font-medium">
                                        {data?.learning?.stats?.autoPromotions || 0}
                                    </p>
                                </div>
                                <div className="bg-muted/30 rounded p-2">
                                    <p className="text-muted-foreground text-xs">Manual Approved</p>
                                    <p className="font-medium">
                                        {data?.learning?.stats?.manualPromotions || 0}
                                    </p>
                                </div>
                            </div>

                            {/* Latest Session */}
                            {data?.learning?.latestSession && (
                                <div className="border-t pt-2">
                                    <p className="text-muted-foreground text-xs">Latest Session</p>
                                    <div className="flex items-center justify-between">
                                        <Badge variant="outline" className="text-xs">
                                            {data.learning.latestSession.status.toLowerCase()}
                                        </Badge>
                                        <span className="text-muted-foreground text-xs">
                                            {data.learning.latestSession.triggerType || "manual"}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* View Learning Button */}
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => router.push(`/agents/${agentSlug}/learning`)}
                            >
                                View Learning
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Alerts */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Alerts</CardTitle>
                            <CardDescription>Issues requiring attention</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {alerts.length === 0 ? (
                                <p className="text-muted-foreground py-4 text-center text-sm">
                                    No active alerts
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {alerts.map((alert) => (
                                        <div
                                            key={alert.id}
                                            className={`rounded-lg border p-3 ${
                                                alert.severity === "CRITICAL"
                                                    ? "border-red-500/20 bg-red-500/10"
                                                    : alert.severity === "WARNING"
                                                      ? "border-yellow-500/20 bg-yellow-500/10"
                                                      : "border-blue-500/20 bg-blue-500/10"
                                            }`}
                                        >
                                            <p className="text-sm font-medium">{alert.message}</p>
                                            <p className="text-muted-foreground mt-1 text-xs">
                                                {new Date(alert.createdAt).toLocaleString()}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Quick Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => router.push(`/agents/${agentSlug}/test`)}
                            >
                                Run Test
                            </Button>
                            <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => router.push(`/agents/${agentSlug}/traces`)}
                            >
                                View Latest Trace
                            </Button>
                            <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => router.push(`/agents/${agentSlug}/configure`)}
                            >
                                Edit Configuration
                            </Button>
                            <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => router.push(`/agents/${agentSlug}/versions`)}
                            >
                                Compare Versions
                            </Button>
                            <Button variant="outline" className="w-full justify-start text-red-600">
                                Disable Agent
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
