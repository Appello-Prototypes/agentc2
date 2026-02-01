"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
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

// Mock data for charts
const mockTimeSeriesData = {
    runs: [45, 52, 38, 65, 72, 58, 84, 92, 67, 78, 95, 88, 102, 115],
    latency: [2.1, 2.3, 2.0, 2.5, 2.2, 2.4, 2.1, 2.6, 2.3, 2.2, 2.4, 2.5, 2.3, 2.1],
    errors: [2, 1, 3, 2, 1, 4, 2, 3, 1, 2, 3, 2, 1, 2],
    quality: [87, 89, 85, 88, 91, 87, 90, 88, 92, 89, 91, 93, 90, 92]
};

const mockToolUsage = [
    { name: "web-search", count: 245, successRate: 98.2 },
    { name: "calculator", count: 189, successRate: 99.8 },
    { name: "calendar", count: 156, successRate: 95.5 },
    { name: "email", count: 134, successRate: 97.1 },
    { name: "database-query", count: 98, successRate: 94.2 }
];

const mockModelComparison = [
    { model: "claude-sonnet-4", runs: 847, avgLatency: 2.3, quality: 91, cost: 23.45 },
    { model: "gpt-4o", runs: 312, avgLatency: 2.8, quality: 88, cost: 18.92 },
    { model: "claude-haiku", runs: 156, avgLatency: 0.8, quality: 82, cost: 3.21 }
];

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

// Simple line indicator
function TrendIndicator({ value, positive = true }: { value: number; positive?: boolean }) {
    const isUp = value > 0;
    const isGood = positive ? isUp : !isUp;
    return (
        <span className={`text-sm font-medium ${isGood ? "text-green-600" : "text-red-600"}`}>
            {isUp ? "↑" : "↓"} {Math.abs(value)}%
        </span>
    );
}

export default function AnalyticsPage() {
    const params = useParams();
    const agentSlug = params.agentSlug as string;

    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState("7d");
    const [activeTab, setActiveTab] = useState("overview");

    useEffect(() => {
        setTimeout(() => setLoading(false), 500);
    }, [agentSlug]);

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-32" />
                    ))}
                </div>
                <Skeleton className="h-96" />
            </div>
        );
    }

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
                    <Button variant="outline">Export</Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Runs</CardDescription>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-2xl">1,247</CardTitle>
                            <TrendIndicator value={12} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <SimpleBarChart data={mockTimeSeriesData.runs} height={40} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Avg Latency (p50)</CardDescription>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-2xl">2.3s</CardTitle>
                            <TrendIndicator value={-5} positive={false} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <SimpleBarChart
                            data={mockTimeSeriesData.latency}
                            height={40}
                            color="bg-blue-500"
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Error Rate</CardDescription>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-2xl">1.8%</CardTitle>
                            <TrendIndicator value={-12} positive={false} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <SimpleBarChart
                            data={mockTimeSeriesData.errors}
                            height={40}
                            color="bg-red-500"
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Quality Score</CardDescription>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-2xl">91%</CardTitle>
                            <TrendIndicator value={3} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <SimpleBarChart
                            data={mockTimeSeriesData.quality}
                            height={40}
                            color="bg-green-500"
                        />
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
                                <SimpleBarChart data={mockTimeSeriesData.runs} height={200} />
                                <div className="text-muted-foreground mt-2 flex justify-between text-xs">
                                    <span>7 days ago</span>
                                    <span>Today</span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Quality Distribution */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Quality Score Distribution</CardTitle>
                                <CardDescription>Helpfulness ratings breakdown</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {[
                                        { range: "90-100%", count: 523, pct: 42 },
                                        { range: "80-90%", count: 412, pct: 33 },
                                        { range: "70-80%", count: 198, pct: 16 },
                                        { range: "60-70%", count: 87, pct: 7 },
                                        { range: "<60%", count: 27, pct: 2 }
                                    ].map((item) => (
                                        <div key={item.range} className="flex items-center gap-3">
                                            <span className="w-20 text-sm">{item.range}</span>
                                            <div className="bg-muted h-4 flex-1 overflow-hidden rounded-full">
                                                <div
                                                    className="bg-primary h-full rounded-full"
                                                    style={{ width: `${item.pct}%` }}
                                                />
                                            </div>
                                            <span className="text-muted-foreground w-16 text-right text-sm">
                                                {item.count}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Insights */}
                    <Card>
                        <CardHeader>
                            <CardTitle>AI Insights</CardTitle>
                            <CardDescription>
                                Automated analysis and recommendations
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4">
                                    <div className="mb-2 flex items-center gap-2">
                                        <span className="text-green-600">✓</span>
                                        <span className="font-medium text-green-600">
                                            Performance Improving
                                        </span>
                                    </div>
                                    <p className="text-muted-foreground text-sm">
                                        Quality scores have increased 3% over the last week, likely
                                        due to the updated instructions in version 4.
                                    </p>
                                </div>
                                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
                                    <div className="mb-2 flex items-center gap-2">
                                        <span className="text-yellow-600">⚠</span>
                                        <span className="font-medium text-yellow-600">
                                            Latency Spike Detected
                                        </span>
                                    </div>
                                    <p className="text-muted-foreground text-sm">
                                        P95 latency increased 15% on Tuesday, correlating with
                                        increased database-query tool usage.
                                    </p>
                                </div>
                                <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
                                    <div className="mb-2 flex items-center gap-2">
                                        <span className="text-blue-600">💡</span>
                                        <span className="font-medium text-blue-600">
                                            Optimization Opportunity
                                        </span>
                                    </div>
                                    <p className="text-muted-foreground text-sm">
                                        Consider caching web-search results. 23% of queries are
                                        repeated within 1 hour.
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
                            <div className="mb-6 grid grid-cols-4 gap-4">
                                <div className="bg-muted rounded-lg p-4 text-center">
                                    <p className="text-muted-foreground text-sm">p50</p>
                                    <p className="text-2xl font-bold">2.3s</p>
                                </div>
                                <div className="bg-muted rounded-lg p-4 text-center">
                                    <p className="text-muted-foreground text-sm">p75</p>
                                    <p className="text-2xl font-bold">3.1s</p>
                                </div>
                                <div className="bg-muted rounded-lg p-4 text-center">
                                    <p className="text-muted-foreground text-sm">p95</p>
                                    <p className="text-2xl font-bold">5.8s</p>
                                </div>
                                <div className="bg-muted rounded-lg p-4 text-center">
                                    <p className="text-muted-foreground text-sm">p99</p>
                                    <p className="text-2xl font-bold">12.4s</p>
                                </div>
                            </div>
                            <SimpleBarChart
                                data={[15, 28, 42, 68, 85, 72, 45, 23, 12, 8, 5, 3, 2, 1]}
                                height={200}
                                color="bg-blue-500"
                            />
                            <div className="text-muted-foreground mt-2 flex justify-between text-xs">
                                <span>0-1s</span>
                                <span>5s</span>
                                <span>10s</span>
                                <span>15s+</span>
                            </div>
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
                            <div className="space-y-4">
                                {mockToolUsage.map((tool) => (
                                    <div
                                        key={tool.name}
                                        className="flex items-center gap-4 rounded-lg border p-3"
                                    >
                                        <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-lg">
                                            🔧
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium">{tool.name}</p>
                                            <div className="mt-1 flex items-center gap-4">
                                                <span className="text-muted-foreground text-sm">
                                                    {tool.count} calls
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
                                                        width: `${(tool.count / 245) * 100}%`
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
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
                                <div className="space-y-4">
                                    {[
                                        { name: "Helpfulness", score: 91, trend: 3 },
                                        { name: "Relevancy", score: 88, trend: 1 },
                                        { name: "Completeness", score: 85, trend: -2 },
                                        { name: "Tone", score: 94, trend: 0 }
                                    ].map((scorer) => (
                                        <div key={scorer.name} className="flex items-center gap-4">
                                            <span className="w-28 text-sm">{scorer.name}</span>
                                            <div className="bg-muted h-3 flex-1 overflow-hidden rounded-full">
                                                <div
                                                    className="bg-primary h-full"
                                                    style={{ width: `${scorer.score}%` }}
                                                />
                                            </div>
                                            <span className="w-12 text-sm font-medium">
                                                {scorer.score}%
                                            </span>
                                            {scorer.trend !== 0 && (
                                                <TrendIndicator value={scorer.trend} />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>User Feedback</CardTitle>
                                <CardDescription>Direct user ratings</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="mb-6 text-center">
                                    <p className="text-5xl font-bold">👍 89%</p>
                                    <p className="text-muted-foreground mt-2 text-sm">
                                        Positive feedback ratio
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="rounded-lg bg-green-500/10 p-4 text-center">
                                        <p className="text-2xl font-bold text-green-600">412</p>
                                        <p className="text-muted-foreground text-sm">Thumbs up</p>
                                    </div>
                                    <div className="rounded-lg bg-red-500/10 p-4 text-center">
                                        <p className="text-2xl font-bold text-red-600">51</p>
                                        <p className="text-muted-foreground text-sm">Thumbs down</p>
                                    </div>
                                </div>
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
                                                Quality
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                Cost
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {mockModelComparison.map((row) => (
                                            <tr
                                                key={row.model}
                                                className="hover:bg-muted/50 border-b"
                                            >
                                                <td className="px-4 py-3 font-mono text-sm">
                                                    {row.model}
                                                </td>
                                                <td className="px-4 py-3 text-right">{row.runs}</td>
                                                <td className="px-4 py-3 text-right">
                                                    {row.avgLatency}s
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Badge
                                                        variant={
                                                            row.quality >= 90
                                                                ? "default"
                                                                : "secondary"
                                                        }
                                                    >
                                                        {row.quality}%
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    ${row.cost.toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
