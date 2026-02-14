"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Badge,
    Button,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Skeleton,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

// Types for API response
interface AnalyticsData {
    success: boolean;
    summary: {
        totalRuns: number;
        completedRuns: number;
        failedRuns: number;
        successRate: number;
        avgLatencyMs: number;
        totalTokens: number;
        totalCostUsd: number;
    };
    latency: {
        avg: number;
        p50: number;
        p95: number;
        p99: number;
        histogram: number[];
    };
    trends: {
        runs: Array<{
            date: string;
            total: number;
            completed: number;
            failed: number;
            successRate: number;
        }>;
    };
    toolUsage: Array<{
        tool: string;
        calls: number;
        successRate: number;
        avgDurationMs: number;
    }>;
    quality: {
        scorers: Array<{
            scorer: string;
            avgScore: number;
            sampleCount: number;
        }>;
        feedback: {
            positive: number;
            negative: number;
            total: number;
            positiveRate: number;
        };
    };
    models: Array<{
        model: string;
        runs: number;
        tokens: number;
        costUsd: number;
        avgLatencyMs: number;
    }>;
    dateRange: {
        from: string;
        to: string;
    };
}

// Helper to get date range from time range selector
function getDateRange(timeRange: string): { from: Date; to: Date } {
    const to = new Date();
    const from = new Date();

    switch (timeRange) {
        case "24h":
            from.setHours(from.getHours() - 24);
            break;
        case "7d":
            from.setDate(from.getDate() - 7);
            break;
        case "30d":
            from.setDate(from.getDate() - 30);
            break;
        case "90d":
            from.setDate(from.getDate() - 90);
            break;
        default:
            from.setDate(from.getDate() - 7);
    }

    return { from, to };
}

// Simple bar chart component for prototype
function SimpleBarChart({
    data,
    height = 200,
    color = "bg-primary"
}: {
    data: number[];
    height?: number;
    color?: string;
}) {
    const max = Math.max(...data);
    return (
        <div className="flex items-end gap-1" style={{ height }}>
            {data.map((value, i) => (
                <div
                    key={i}
                    className={`flex-1 ${color} rounded-t opacity-80 transition-opacity hover:opacity-100`}
                    style={{ height: `${(value / max) * 100}%` }}
                    title={`${value}`}
                />
            ))}
        </div>
    );
}

export default function AnalyticsPage() {
    const params = useParams();
    const agentSlug = params.agentSlug as string;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [timeRange, setTimeRange] = useState("7d");
    const [activeTab, setActiveTab] = useState("overview");
    const [routingDistribution, setRoutingDistribution] = useState<
        Array<{ tier: string; count: number; avgLatencyMs: number; avgCostUsd: number }>
    >([]);

    const fetchAnalytics = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const { from, to } = getDateRange(timeRange);
            const params = new URLSearchParams({
                from: from.toISOString(),
                to: to.toISOString()
            });

            const response = await fetch(
                `${getApiBase()}/api/agents/${agentSlug}/analytics?${params}`
            );
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || "Failed to fetch analytics");
            }

            setData(result);

            // Fetch routing distribution from recent runs
            try {
                const runsRes = await fetch(
                    `${getApiBase()}/api/agents/${agentSlug}/runs?limit=100&source=all`
                );
                const runsResult = await runsRes.json();
                if (runsResult.success && runsResult.runs) {
                    // Fetch traces for runs that have them, aggregate routing tiers
                    const tierMap: Record<
                        string,
                        { count: number; totalLatency: number; totalCost: number }
                    > = {};
                    const tracePromises = runsResult.runs
                        .filter(
                            (r: { status: string }) =>
                                r.status.toUpperCase() === "COMPLETED" ||
                                r.status.toUpperCase() === "FAILED"
                        )
                        .slice(0, 50)
                        .map(async (run: { id: string; durationMs?: number; costUsd?: number }) => {
                            try {
                                const traceRes = await fetch(
                                    `${getApiBase()}/api/agents/${agentSlug}/runs/${run.id}/trace`
                                );
                                const traceResult = await traceRes.json();
                                if (traceResult.success && traceResult.trace?.modelJson) {
                                    const tier =
                                        traceResult.trace.modelJson.routingTier || "UNROUTED";
                                    if (!tierMap[tier]) {
                                        tierMap[tier] = { count: 0, totalLatency: 0, totalCost: 0 };
                                    }
                                    tierMap[tier].count++;
                                    tierMap[tier].totalLatency += run.durationMs || 0;
                                    tierMap[tier].totalCost += run.costUsd || 0;
                                }
                            } catch {
                                // Ignore individual trace fetch failures
                            }
                        });
                    await Promise.all(tracePromises);

                    const distribution = Object.entries(tierMap)
                        .map(([tier, stats]) => ({
                            tier,
                            count: stats.count,
                            avgLatencyMs: stats.count > 0 ? stats.totalLatency / stats.count : 0,
                            avgCostUsd: stats.count > 0 ? stats.totalCost / stats.count : 0
                        }))
                        .sort((a, b) => b.count - a.count);

                    setRoutingDistribution(distribution);
                }
            } catch {
                // Non-critical: routing distribution is supplementary
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch analytics");
        } finally {
            setLoading(false);
        }
    }, [agentSlug, timeRange]);

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-32" />
                    ))}
                </div>
                <Skeleton className="h-96" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Analytics</h1>
                    <p className="text-muted-foreground">Performance metrics and insights</p>
                </div>
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <p className="text-destructive mb-4">{error}</p>
                        <Button onClick={fetchAnalytics}>Retry</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!data) {
        return null;
    }

    // Extract data for easier access
    const { summary, latency, trends, toolUsage, quality, models } = data;

    // Export analytics data as CSV
    const handleExport = () => {
        const rows: string[] = [];

        // Summary section
        rows.push("ANALYTICS SUMMARY");
        rows.push(`Period,${data.dateRange.from} to ${data.dateRange.to}`);
        rows.push(`Total Runs,${summary.totalRuns}`);
        rows.push(`Completed Runs,${summary.completedRuns}`);
        rows.push(`Failed Runs,${summary.failedRuns}`);
        rows.push(`Success Rate,${summary.successRate}%`);
        rows.push(`Average Latency,${summary.avgLatencyMs}ms`);
        rows.push(`Total Tokens,${summary.totalTokens}`);
        rows.push(`Total Cost,$${summary.totalCostUsd.toFixed(2)}`);
        rows.push("");

        // Latency section
        rows.push("LATENCY PERCENTILES");
        rows.push(`Average,${latency.avg}ms`);
        rows.push(`p50,${latency.p50}ms`);
        rows.push(`p95,${latency.p95}ms`);
        rows.push(`p99,${latency.p99}ms`);
        rows.push("");

        // Trends section
        if (trends.runs.length > 0) {
            rows.push("DAILY TRENDS");
            rows.push("Date,Total,Completed,Failed,Success Rate");
            trends.runs.forEach((r) => {
                rows.push(`${r.date},${r.total},${r.completed},${r.failed},${r.successRate}%`);
            });
            rows.push("");
        }

        // Tool usage section
        if (toolUsage.length > 0) {
            rows.push("TOOL USAGE");
            rows.push("Tool,Calls,Success Rate,Avg Duration (ms)");
            toolUsage.forEach((t) => {
                rows.push(`${t.tool},${t.calls},${t.successRate}%,${t.avgDurationMs}`);
            });
            rows.push("");
        }

        // Quality section
        if (quality.scorers.length > 0) {
            rows.push("QUALITY SCORES");
            rows.push("Scorer,Average Score,Sample Count");
            quality.scorers.forEach((s) => {
                rows.push(`${s.scorer},${(s.avgScore * 100).toFixed(1)}%,${s.sampleCount}`);
            });
            rows.push("");
        }

        rows.push("USER FEEDBACK");
        rows.push(`Positive,${quality.feedback.positive}`);
        rows.push(`Negative,${quality.feedback.negative}`);
        rows.push(`Total,${quality.feedback.total}`);
        rows.push(`Positive Rate,${quality.feedback.positiveRate}%`);
        rows.push("");

        // Models section
        if (models.length > 0) {
            rows.push("MODEL COMPARISON");
            rows.push("Model,Runs,Tokens,Cost,Avg Latency (ms)");
            models.forEach((m) => {
                rows.push(
                    `${m.model},${m.runs},${m.tokens},$${m.costUsd.toFixed(2)},${m.avgLatencyMs}`
                );
            });
        }

        // Create and download CSV
        const csvContent = rows.join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${agentSlug}-analytics-${timeRange}-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Prepare chart data from trends
    const runsTrend = trends.runs.map((r) => r.total);
    const errorsTrend = trends.runs.map((r) => r.failed);
    const successRateTrend = trends.runs.map((r) => r.successRate);

    // Calculate max tool calls for scaling
    const maxToolCalls = Math.max(...toolUsage.map((t) => t.calls), 1);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Analytics</h1>
                    <p className="text-muted-foreground">Performance metrics and insights</p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={timeRange} onValueChange={(v) => v && setTimeRange(v)}>
                        <SelectTrigger className="w-32">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="24h">Last 24h</SelectItem>
                            <SelectItem value="7d">Last 7 days</SelectItem>
                            <SelectItem value="30d">Last 30 days</SelectItem>
                            <SelectItem value="90d">Last 90 days</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={handleExport}>
                        Export
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Runs</CardDescription>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-2xl">
                                {summary.totalRuns.toLocaleString()}
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {runsTrend.length > 0 ? (
                            <SimpleBarChart data={runsTrend} height={40} />
                        ) : (
                            <p className="text-muted-foreground text-sm">No data</p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Avg Latency (p50)</CardDescription>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-2xl">
                                {latency.p50 > 0 ? `${(latency.p50 / 1000).toFixed(1)}s` : "—"}
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {latency.histogram.length > 0 ? (
                            <SimpleBarChart
                                data={latency.histogram.slice(0, 14)}
                                height={40}
                                color="bg-blue-500"
                            />
                        ) : (
                            <p className="text-muted-foreground text-sm">No data</p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Error Rate</CardDescription>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-2xl">
                                {summary.totalRuns > 0
                                    ? `${((summary.failedRuns / summary.totalRuns) * 100).toFixed(1)}%`
                                    : "—"}
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {errorsTrend.length > 0 ? (
                            <SimpleBarChart data={errorsTrend} height={40} color="bg-red-500" />
                        ) : (
                            <p className="text-muted-foreground text-sm">No data</p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Success Rate</CardDescription>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-2xl">
                                {summary.successRate > 0
                                    ? `${summary.successRate.toFixed(0)}%`
                                    : "—"}
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {successRateTrend.length > 0 ? (
                            <SimpleBarChart
                                data={successRateTrend}
                                height={40}
                                color="bg-green-500"
                            />
                        ) : (
                            <p className="text-muted-foreground text-sm">No data</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs
                defaultValue="overview"
                value={activeTab}
                onValueChange={(v) => v && setActiveTab(v)}
            >
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="latency">Latency</TabsTrigger>
                    <TabsTrigger value="tools">Tool Usage</TabsTrigger>
                    <TabsTrigger value="quality">Quality</TabsTrigger>
                    <TabsTrigger value="comparison">Comparison</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        {/* Runs Over Time */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Runs Over Time</CardTitle>
                                <CardDescription>Daily run volume</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {runsTrend.length > 0 ? (
                                    <>
                                        <SimpleBarChart data={runsTrend} height={200} />
                                        <div className="text-muted-foreground mt-2 flex justify-between text-xs">
                                            <span>
                                                {trends.runs[0]?.date
                                                    ? new Date(
                                                          trends.runs[0].date
                                                      ).toLocaleDateString()
                                                    : "Start"}
                                            </span>
                                            <span>
                                                {trends.runs[trends.runs.length - 1]?.date
                                                    ? new Date(
                                                          trends.runs[trends.runs.length - 1].date
                                                      ).toLocaleDateString()
                                                    : "Today"}
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-muted-foreground flex h-[200px] items-center justify-center">
                                        No run data for this period
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Scorer Breakdown (moved from Quality tab for overview) */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Quality Scores</CardTitle>
                                <CardDescription>Average scores by evaluator</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {quality.scorers.length > 0 ? (
                                    <div className="space-y-3">
                                        {quality.scorers.map((scorer) => (
                                            <div
                                                key={scorer.scorer}
                                                className="flex items-center gap-3"
                                            >
                                                <span className="w-28 truncate text-sm">
                                                    {scorer.scorer}
                                                </span>
                                                <div className="bg-muted h-4 flex-1 overflow-hidden rounded-full">
                                                    <div
                                                        className="bg-primary h-full rounded-full"
                                                        style={{
                                                            width: `${Math.min(scorer.avgScore * 100, 100)}%`
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-muted-foreground w-16 text-right text-sm">
                                                    {(scorer.avgScore * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-muted-foreground flex h-[150px] items-center justify-center">
                                        No evaluation data
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Summary Stats */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Summary Statistics</CardTitle>
                            <CardDescription>Key metrics for the selected period</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                                <div className="rounded-lg border p-4">
                                    <p className="text-muted-foreground text-sm">Completed Runs</p>
                                    <p className="text-2xl font-bold">
                                        {summary.completedRuns.toLocaleString()}
                                    </p>
                                </div>
                                <div className="rounded-lg border p-4">
                                    <p className="text-muted-foreground text-sm">Failed Runs</p>
                                    <p className="text-2xl font-bold text-red-600">
                                        {summary.failedRuns.toLocaleString()}
                                    </p>
                                </div>
                                <div className="rounded-lg border p-4">
                                    <p className="text-muted-foreground text-sm">Total Tokens</p>
                                    <p className="text-2xl font-bold">
                                        {summary.totalTokens.toLocaleString()}
                                    </p>
                                </div>
                                <div className="rounded-lg border p-4">
                                    <p className="text-muted-foreground text-sm">Total Cost</p>
                                    <p className="text-2xl font-bold">
                                        ${summary.totalCostUsd.toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Latency Tab */}
                <TabsContent value="latency" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Latency Percentiles</CardTitle>
                            <CardDescription>Response time distribution</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                                <div className="bg-muted rounded-lg p-4 text-center">
                                    <p className="text-muted-foreground text-sm">Average</p>
                                    <p className="text-2xl font-bold">
                                        {latency.avg > 0
                                            ? `${(latency.avg / 1000).toFixed(1)}s`
                                            : "—"}
                                    </p>
                                </div>
                                <div className="bg-muted rounded-lg p-4 text-center">
                                    <p className="text-muted-foreground text-sm">p50</p>
                                    <p className="text-2xl font-bold">
                                        {latency.p50 > 0
                                            ? `${(latency.p50 / 1000).toFixed(1)}s`
                                            : "—"}
                                    </p>
                                </div>
                                <div className="bg-muted rounded-lg p-4 text-center">
                                    <p className="text-muted-foreground text-sm">p95</p>
                                    <p className="text-2xl font-bold">
                                        {latency.p95 > 0
                                            ? `${(latency.p95 / 1000).toFixed(1)}s`
                                            : "—"}
                                    </p>
                                </div>
                                <div className="bg-muted rounded-lg p-4 text-center">
                                    <p className="text-muted-foreground text-sm">p99</p>
                                    <p className="text-2xl font-bold">
                                        {latency.p99 > 0
                                            ? `${(latency.p99 / 1000).toFixed(1)}s`
                                            : "—"}
                                    </p>
                                </div>
                            </div>
                            {latency.histogram.length > 0 ? (
                                <>
                                    <SimpleBarChart
                                        data={latency.histogram}
                                        height={200}
                                        color="bg-blue-500"
                                    />
                                    <div className="text-muted-foreground mt-2 flex justify-between text-xs">
                                        <span>Fastest</span>
                                        <span>Response Time Distribution</span>
                                        <span>Slowest</span>
                                    </div>
                                </>
                            ) : (
                                <div className="text-muted-foreground flex h-[200px] items-center justify-center">
                                    No latency data for this period
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tools Tab */}
                <TabsContent value="tools" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Tool Usage Analytics</CardTitle>
                            <CardDescription>How tools are being used</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {toolUsage.length > 0 ? (
                                <div className="space-y-4">
                                    {toolUsage.map((tool) => (
                                        <div
                                            key={tool.tool}
                                            className="flex items-center gap-4 rounded-lg border p-3"
                                        >
                                            <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-lg">
                                                🔧
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-medium">{tool.tool}</p>
                                                <div className="mt-1 flex items-center gap-4">
                                                    <span className="text-muted-foreground text-sm">
                                                        {tool.calls} calls
                                                    </span>
                                                    <span className="text-muted-foreground text-sm">
                                                        avg {(tool.avgDurationMs / 1000).toFixed(1)}
                                                        s
                                                    </span>
                                                    <Badge
                                                        variant={
                                                            tool.successRate >= 95
                                                                ? "default"
                                                                : "secondary"
                                                        }
                                                    >
                                                        {tool.successRate}% success
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div className="w-32">
                                                <div className="bg-muted h-2 overflow-hidden rounded-full">
                                                    <div
                                                        className="bg-primary h-full"
                                                        style={{
                                                            width: `${(tool.calls / maxToolCalls) * 100}%`
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-muted-foreground flex h-[200px] items-center justify-center">
                                    No tool usage data for this period
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Quality Tab */}
                <TabsContent value="quality" className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Scorer Breakdown</CardTitle>
                                <CardDescription>Individual evaluation metrics</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {quality.scorers.length > 0 ? (
                                    <div className="space-y-4">
                                        {quality.scorers.map((scorer) => (
                                            <div
                                                key={scorer.scorer}
                                                className="flex items-center gap-4"
                                            >
                                                <span className="w-28 truncate text-sm">
                                                    {scorer.scorer}
                                                </span>
                                                <div className="bg-muted h-3 flex-1 overflow-hidden rounded-full">
                                                    <div
                                                        className="bg-primary h-full"
                                                        style={{
                                                            width: `${Math.min(scorer.avgScore * 100, 100)}%`
                                                        }}
                                                    />
                                                </div>
                                                <span className="w-12 text-sm font-medium">
                                                    {(scorer.avgScore * 100).toFixed(0)}%
                                                </span>
                                                <span className="text-muted-foreground w-16 text-right text-xs">
                                                    ({scorer.sampleCount})
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-muted-foreground flex h-[150px] items-center justify-center">
                                        No evaluation data for this period
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>User Feedback</CardTitle>
                                <CardDescription>Direct user ratings</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {quality.feedback.total > 0 ? (
                                    <>
                                        <div className="mb-6 text-center">
                                            <p className="text-5xl font-bold">
                                                👍 {quality.feedback.positiveRate}%
                                            </p>
                                            <p className="text-muted-foreground mt-2 text-sm">
                                                Positive feedback ratio
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="rounded-lg bg-green-500/10 p-4 text-center">
                                                <p className="text-2xl font-bold text-green-600">
                                                    {quality.feedback.positive}
                                                </p>
                                                <p className="text-muted-foreground text-sm">
                                                    Thumbs up
                                                </p>
                                            </div>
                                            <div className="rounded-lg bg-red-500/10 p-4 text-center">
                                                <p className="text-2xl font-bold text-red-600">
                                                    {quality.feedback.negative}
                                                </p>
                                                <p className="text-muted-foreground text-sm">
                                                    Thumbs down
                                                </p>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-muted-foreground flex h-[200px] items-center justify-center">
                                        No feedback data for this period
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Comparison Tab */}
                <TabsContent value="comparison" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Model Comparison</CardTitle>
                            <CardDescription>Performance across different models</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {models.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="px-4 py-3 text-left font-medium">
                                                    Model
                                                </th>
                                                <th className="px-4 py-3 text-right font-medium">
                                                    Runs
                                                </th>
                                                <th className="px-4 py-3 text-right font-medium">
                                                    Avg Latency
                                                </th>
                                                <th className="px-4 py-3 text-right font-medium">
                                                    Tokens
                                                </th>
                                                <th className="px-4 py-3 text-right font-medium">
                                                    Cost
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {models.map((row) => (
                                                <tr
                                                    key={row.model}
                                                    className="hover:bg-muted/50 border-b"
                                                >
                                                    <td className="px-4 py-3 font-mono text-sm">
                                                        {row.model}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {row.runs.toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {(row.avgLatencyMs / 1000).toFixed(1)}s
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {row.tokens.toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        ${row.costUsd.toFixed(2)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-muted-foreground flex h-[200px] items-center justify-center">
                                    No model data for this period
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Routing Distribution */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Routing Distribution</CardTitle>
                            <CardDescription>
                                How requests are distributed across model tiers when auto-routing is
                                enabled
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {routingDistribution.length > 0 &&
                            routingDistribution.some((r) => r.tier !== "UNROUTED") ? (
                                <div className="space-y-4">
                                    {routingDistribution.map((row) => {
                                        const total = routingDistribution.reduce(
                                            (s, r) => s + r.count,
                                            0
                                        );
                                        const pct =
                                            total > 0
                                                ? ((row.count / total) * 100).toFixed(1)
                                                : "0";
                                        const tierColors: Record<string, string> = {
                                            FAST: "bg-green-500",
                                            PRIMARY: "bg-blue-500",
                                            ESCALATION: "bg-orange-500",
                                            UNROUTED: "bg-gray-500"
                                        };
                                        const tierLabels: Record<string, string> = {
                                            FAST: "Fast",
                                            PRIMARY: "Primary",
                                            ESCALATION: "Escalation",
                                            UNROUTED: "Unrouted"
                                        };
                                        const color = tierColors[row.tier] || "bg-gray-400";
                                        const label = tierLabels[row.tier] || row.tier;
                                        return (
                                            <div
                                                key={row.tier}
                                                className="flex items-center gap-4 rounded-lg border p-3"
                                            >
                                                <Badge
                                                    variant="outline"
                                                    className={`${color.replace("bg-", "text-").replace("-500", "-400")} border-current`}
                                                >
                                                    {label}
                                                </Badge>
                                                <div className="flex-1">
                                                    <div className="bg-muted h-2 overflow-hidden rounded-full">
                                                        <div
                                                            className={`h-full ${color}`}
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="text-muted-foreground flex items-center gap-3 text-sm">
                                                    <span>
                                                        {row.count} runs ({pct}%)
                                                    </span>
                                                    <span>
                                                        avg {(row.avgLatencyMs / 1000).toFixed(1)}s
                                                    </span>
                                                    <span>${row.avgCostUsd.toFixed(4)}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-muted-foreground flex h-[120px] items-center justify-center text-sm">
                                    No routing data — enable auto-routing on this agent to see
                                    distribution
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
