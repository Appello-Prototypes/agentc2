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
    Skeleton
} from "@repo/ui";

interface AgentStats {
    totalRuns: number;
    successRate: number;
    avgDurationMs: number;
    avgQualityScore: number;
    totalCost: number;
    runsToday: number;
    runsThisWeek: number;
}

interface RecentRun {
    id: string;
    input: string;
    output: string;
    status: "completed" | "failed" | "timeout";
    durationMs: number;
    createdAt: string;
    scores?: { helpfulness?: number };
}

// Mock data for prototype
const mockStats: AgentStats = {
    totalRuns: 1247,
    successRate: 94.2,
    avgDurationMs: 2340,
    avgQualityScore: 87,
    totalCost: 45.67,
    runsToday: 42,
    runsThisWeek: 312
};

const mockRecentRuns: RecentRun[] = [
    {
        id: "run-1",
        input: "What's the weather like in San Francisco today?",
        output: "The weather in San Francisco today is partly cloudy with temperatures around 65°F...",
        status: "completed",
        durationMs: 1850,
        createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        scores: { helpfulness: 0.92 }
    },
    {
        id: "run-2",
        input: "Help me write an email to my team about the project deadline",
        output: "Subject: Project Deadline Update\n\nDear Team...",
        status: "completed",
        durationMs: 3200,
        createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        scores: { helpfulness: 0.88 }
    },
    {
        id: "run-3",
        input: "Analyze this data and create a summary report",
        output: "Error: Unable to process request due to timeout",
        status: "timeout",
        durationMs: 30000,
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString()
    },
    {
        id: "run-4",
        input: "Schedule a meeting with the marketing team",
        output: "I've scheduled a meeting with the marketing team for tomorrow at 2 PM...",
        status: "completed",
        durationMs: 2100,
        createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        scores: { helpfulness: 0.95 }
    },
    {
        id: "run-5",
        input: "What are the latest sales figures?",
        output: "Based on the latest data, your sales figures show...",
        status: "completed",
        durationMs: 1650,
        createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        scores: { helpfulness: 0.85 }
    }
];

const mockAlerts = [
    {
        id: 1,
        type: "warning",
        message: "Cost approaching 80% of monthly budget",
        time: "2 hours ago"
    },
    { id: 2, type: "info", message: "New version deployed successfully", time: "1 day ago" }
];

function HealthIndicator({ score }: { score: number }) {
    const color = score >= 90 ? "bg-green-500" : score >= 70 ? "bg-yellow-500" : "bg-red-500";
    const label = score >= 90 ? "Healthy" : score >= 70 ? "Warning" : "Critical";

    return (
        <div className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${color} animate-pulse`} />
            <span className="text-sm font-medium">{label}</span>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const variants: Record<string, "default" | "destructive" | "secondary"> = {
        completed: "default",
        failed: "destructive",
        timeout: "secondary"
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
}

export default function OverviewPage() {
    const params = useParams();
    const agentSlug = params.agentSlug as string;
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<AgentStats | null>(null);
    const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);

    useEffect(() => {
        // Simulate loading
        setTimeout(() => {
            setStats(mockStats);
            setRecentRuns(mockRecentRuns);
            setLoading(false);
        }, 500);
    }, [agentSlug]);

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
                    <HealthIndicator score={stats?.successRate || 0} />
                    <Button>Run Test</Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Runs</CardDescription>
                        <CardTitle className="text-2xl">
                            {stats?.totalRuns.toLocaleString()}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-xs">{stats?.runsToday} today</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Success Rate</CardDescription>
                        <CardTitle className="text-2xl text-green-600">
                            {stats?.successRate}%
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
                        <CardTitle className="text-2xl">{stats?.avgQualityScore}%</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-xs">Composite score</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>This Week</CardDescription>
                        <CardTitle className="text-2xl">{stats?.runsThisWeek}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-green-600">↑ 12% vs last week</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Cost</CardDescription>
                        <CardTitle className="text-2xl">${stats?.totalCost.toFixed(2)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-xs">This month</p>
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
                            <Button variant="outline" size="sm">
                                View All
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {recentRuns.map((run) => (
                                <div
                                    key={run.id}
                                    className="hover:bg-muted/50 flex cursor-pointer items-start gap-4 rounded-lg border p-3 transition-colors"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-medium">{run.input}</p>
                                        <p className="text-muted-foreground mt-1 line-clamp-1 text-sm">
                                            {run.output}
                                        </p>
                                        <div className="mt-2 flex items-center gap-2">
                                            <StatusBadge status={run.status} />
                                            <span className="text-muted-foreground text-xs">
                                                {(run.durationMs / 1000).toFixed(1)}s
                                            </span>
                                            {run.scores?.helpfulness && (
                                                <span className="text-muted-foreground text-xs">
                                                    • {(run.scores.helpfulness * 100).toFixed(0)}%
                                                    helpful
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-muted-foreground shrink-0 text-xs">
                                        {new Date(run.createdAt).toLocaleTimeString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Alerts & Quick Actions */}
                <div className="space-y-6">
                    {/* Alerts */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Alerts</CardTitle>
                            <CardDescription>Issues requiring attention</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {mockAlerts.length === 0 ? (
                                <p className="text-muted-foreground py-4 text-center text-sm">
                                    No active alerts
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {mockAlerts.map((alert) => (
                                        <div
                                            key={alert.id}
                                            className={`rounded-lg border p-3 ${
                                                alert.type === "warning"
                                                    ? "border-yellow-500/20 bg-yellow-500/10"
                                                    : "border-blue-500/20 bg-blue-500/10"
                                            }`}
                                        >
                                            <p className="text-sm font-medium">{alert.message}</p>
                                            <p className="text-muted-foreground mt-1 text-xs">
                                                {alert.time}
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
                            <Button variant="outline" className="w-full justify-start">
                                🧪 Run Test
                            </Button>
                            <Button variant="outline" className="w-full justify-start">
                                🔍 View Latest Trace
                            </Button>
                            <Button variant="outline" className="w-full justify-start">
                                ⚙️ Edit Configuration
                            </Button>
                            <Button variant="outline" className="w-full justify-start">
                                📊 Compare Versions
                            </Button>
                            <Button variant="outline" className="w-full justify-start text-red-600">
                                ⏸️ Disable Agent
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
