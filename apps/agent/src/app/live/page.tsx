"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Badge,
    Button,
    Input,
    Skeleton,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Table,
    TableHeader,
    TableBody,
    TableHead,
    TableRow,
    TableCell,
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface AgentProductionStats {
    id: string;
    slug: string;
    name: string;
    isActive: boolean;
    prodRuns: number;
    successRate: number;
    avgLatencyMs: number;
    totalTokens: number;
    totalCostUsd: number;
    sources: { source: string; count: number }[];
    lastRunAt: string | null;
}

interface ProductionSummary {
    totalProdRuns: number;
    completedRuns: number;
    failedRuns: number;
    successRate: number;
    avgLatencyMs: number;
    totalTokens: number;
    totalCostUsd: number;
    runsBySource: { source: string; count: number }[];
    activeAgents: number;
}

interface Run {
    id: string;
    agentId: string;
    agentSlug: string;
    agentName: string;
    runType: string;
    status: string;
    source: string | null;
    sessionId: string | null;
    threadId: string | null;
    inputText: string;
    outputText: string | null;
    durationMs: number | null;
    startedAt: string;
    completedAt: string | null;
    modelProvider: string | null;
    modelName: string | null;
    totalTokens: number | null;
    costUsd: number | null;
}

interface RunCounts {
    total: number;
    queued: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
}

function formatLatency(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

function formatRelativeTime(dateStr: string | null): string {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

function getStatusBadgeVariant(
    status: string
): "default" | "secondary" | "destructive" | "outline" {
    switch (status.toUpperCase()) {
        case "COMPLETED":
            return "default";
        case "FAILED":
            return "destructive";
        case "RUNNING":
        case "QUEUED":
            return "secondary";
        default:
            return "outline";
    }
}

function getSourceBadgeColor(source: string | null): string {
    switch (source?.toLowerCase()) {
        case "slack":
            return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
        case "whatsapp":
            return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
        case "voice":
            return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
        case "telegram":
            return "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300";
        case "elevenlabs":
            return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300";
        case "api":
            return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
        default:
            return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
    }
}

export default function LiveDashboardPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [agents, setAgents] = useState<AgentProductionStats[]>([]);
    const [summary, setSummary] = useState<ProductionSummary | null>(null);
    const [runs, setRuns] = useState<Run[]>([]);
    const [runCounts, setRunCounts] = useState<RunCounts | null>(null);
    const [runsLoading, setRunsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [sourceFilter, setSourceFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [activeTab, setActiveTab] = useState("overview");
    const [autoRefresh, setAutoRefresh] = useState(true);

    // Fetch production stats
    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/live/stats`);
            const data = await res.json();
            if (data.success) {
                setAgents(data.agents);
                setSummary(data.summary);
            }
        } catch (error) {
            console.error("Failed to fetch production stats:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch runs
    const fetchRuns = useCallback(async () => {
        setRunsLoading(true);
        try {
            const params = new URLSearchParams();
            params.set("runType", "PROD"); // Only production runs
            if (statusFilter !== "all") {
                params.set("status", statusFilter);
            }
            if (sourceFilter !== "all") {
                params.set("source", sourceFilter);
            }
            const res = await fetch(`${getApiBase()}/api/live/runs?${params.toString()}`);
            const data = await res.json();
            if (data.success) {
                setRuns(data.runs);
                setRunCounts(data.counts);
            }
        } catch (error) {
            console.error("Failed to fetch runs:", error);
        } finally {
            setRunsLoading(false);
        }
    }, [statusFilter, sourceFilter]);

    // Initial fetch
    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    // Fetch runs when tab changes
    useEffect(() => {
        if (activeTab === "runs") {
            fetchRuns();
        }
    }, [activeTab, fetchRuns]);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(() => {
            fetchStats();
            if (activeTab === "runs") {
                fetchRuns();
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [autoRefresh, activeTab, fetchStats, fetchRuns]);

    const filteredAgents = agents.filter((agent) => {
        if (
            searchQuery &&
            !agent.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !agent.slug.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
            return false;
        }
        return true;
    });

    const handleAgentClick = (agent: AgentProductionStats) => {
        router.push(`/live/${agent.slug}/runs`);
    };

    const handleRunClick = (run: Run) => {
        router.push(`/live/${run.agentSlug}/runs?runId=${run.id}`);
    };

    if (loading) {
        return (
            <div className="container mx-auto space-y-6 py-6">
                <Skeleton className="h-10 w-64" />
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
        <div className="container mx-auto space-y-6 py-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold">Live Production</h1>
                        <Badge
                            variant="outline"
                            className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                        >
                            {autoRefresh ? "Auto-refreshing" : "Paused"}
                        </Badge>
                    </div>
                    <p className="text-muted-foreground">
                        Real-time monitoring of production agent runs
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant={autoRefresh ? "default" : "outline"}
                        size="sm"
                        onClick={() => setAutoRefresh(!autoRefresh)}
                    >
                        {autoRefresh ? "Pause" : "Resume"} Auto-refresh
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => router.push("/workspace")}>
                        Workspace
                    </Button>
                </div>
            </div>

            {/* Production Summary */}
            {summary && (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Production Runs</CardDescription>
                            <CardTitle className="text-2xl">
                                {summary.totalProdRuns.toLocaleString()}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Active Agents</CardDescription>
                            <CardTitle className="text-2xl text-green-600">
                                {summary.activeAgents}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Success Rate</CardDescription>
                            <CardTitle
                                className={`text-2xl ${summary.successRate >= 90 ? "text-green-600" : summary.successRate >= 70 ? "text-yellow-600" : "text-red-600"}`}
                            >
                                {summary.successRate}%
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Avg Latency</CardDescription>
                            <CardTitle className="text-2xl">
                                {formatLatency(summary.avgLatencyMs)}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Total Tokens</CardDescription>
                            <CardTitle className="text-2xl">
                                {summary.totalTokens.toLocaleString()}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Total Cost</CardDescription>
                            <CardTitle className="text-2xl">
                                ${summary.totalCostUsd.toFixed(2)}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Failed</CardDescription>
                            <CardTitle className="text-2xl text-red-600">
                                {summary.failedRuns}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                </div>
            )}

            {/* Source Breakdown */}
            {summary && summary.runsBySource.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Runs by Channel</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-4">
                            {summary.runsBySource.map((s) => (
                                <div key={s.source} className="flex items-center gap-2">
                                    <Badge className={getSourceBadgeColor(s.source)}>
                                        {s.source || "unknown"}
                                    </Badge>
                                    <span className="font-medium">{s.count.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Tabs */}
            <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="overview">Agents Overview</TabsTrigger>
                    <TabsTrigger value="runs">Recent Runs</TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                    {/* Search */}
                    <div className="mb-4">
                        <Input
                            placeholder="Search agents..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="max-w-sm"
                        />
                    </div>

                    {/* Agents Table */}
                    {filteredAgents.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <p className="text-muted-foreground text-lg">
                                    No production data yet
                                </p>
                                <p className="text-muted-foreground mt-2 text-sm">
                                    Production runs from Slack, WhatsApp, Voice, Telegram, and
                                    ElevenLabs will appear here
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Agent</TableHead>
                                        <TableHead className="text-right">Prod Runs</TableHead>
                                        <TableHead className="text-right">Success</TableHead>
                                        <TableHead className="text-right">Latency</TableHead>
                                        <TableHead className="text-right">Tokens</TableHead>
                                        <TableHead className="text-right">Cost</TableHead>
                                        <TableHead>Channels</TableHead>
                                        <TableHead>Last Run</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredAgents.map((agent) => (
                                        <TableRow
                                            key={agent.id}
                                            className="cursor-pointer"
                                            onClick={() => handleAgentClick(agent)}
                                        >
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className={`size-2 rounded-full ${agent.isActive ? "bg-green-500" : "bg-gray-400"}`}
                                                    />
                                                    <span className="font-medium">
                                                        {agent.name}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {agent.prodRuns.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span
                                                    className={
                                                        agent.successRate >= 90
                                                            ? "text-green-600"
                                                            : agent.successRate >= 70
                                                              ? "text-yellow-600"
                                                              : "text-red-600"
                                                    }
                                                >
                                                    {agent.successRate}%
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {formatLatency(agent.avgLatencyMs)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {agent.totalTokens.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                ${agent.totalCostUsd.toFixed(4)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {agent.sources.slice(0, 3).map((s) => (
                                                        <Badge
                                                            key={s.source}
                                                            variant="outline"
                                                            className="text-xs"
                                                        >
                                                            {s.source}
                                                        </Badge>
                                                    ))}
                                                    {agent.sources.length > 3 && (
                                                        <Badge
                                                            variant="outline"
                                                            className="text-xs"
                                                        >
                                                            +{agent.sources.length - 3}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {formatRelativeTime(agent.lastRunAt)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="runs">
                    {/* Run Counts */}
                    {runCounts && (
                        <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-6">
                            <Card className="cursor-pointer" onClick={() => setStatusFilter("all")}>
                                <CardHeader className="pb-2">
                                    <CardDescription>Total</CardDescription>
                                    <CardTitle className="text-xl">
                                        {runCounts.total.toLocaleString()}
                                    </CardTitle>
                                </CardHeader>
                            </Card>
                            <Card
                                className="cursor-pointer"
                                onClick={() => setStatusFilter("completed")}
                            >
                                <CardHeader className="pb-2">
                                    <CardDescription>Completed</CardDescription>
                                    <CardTitle className="text-xl text-green-600">
                                        {runCounts.completed.toLocaleString()}
                                    </CardTitle>
                                </CardHeader>
                            </Card>
                            <Card
                                className="cursor-pointer"
                                onClick={() => setStatusFilter("failed")}
                            >
                                <CardHeader className="pb-2">
                                    <CardDescription>Failed</CardDescription>
                                    <CardTitle className="text-xl text-red-600">
                                        {runCounts.failed.toLocaleString()}
                                    </CardTitle>
                                </CardHeader>
                            </Card>
                            <Card
                                className="cursor-pointer"
                                onClick={() => setStatusFilter("running")}
                            >
                                <CardHeader className="pb-2">
                                    <CardDescription>Running</CardDescription>
                                    <CardTitle className="text-xl text-blue-600">
                                        {runCounts.running.toLocaleString()}
                                    </CardTitle>
                                </CardHeader>
                            </Card>
                            <Card
                                className="cursor-pointer"
                                onClick={() => setStatusFilter("queued")}
                            >
                                <CardHeader className="pb-2">
                                    <CardDescription>Queued</CardDescription>
                                    <CardTitle className="text-xl text-yellow-600">
                                        {runCounts.queued.toLocaleString()}
                                    </CardTitle>
                                </CardHeader>
                            </Card>
                            <Card
                                className="cursor-pointer"
                                onClick={() => setStatusFilter("cancelled")}
                            >
                                <CardHeader className="pb-2">
                                    <CardDescription>Cancelled</CardDescription>
                                    <CardTitle className="text-xl text-gray-600">
                                        {runCounts.cancelled.toLocaleString()}
                                    </CardTitle>
                                </CardHeader>
                            </Card>
                        </div>
                    )}

                    {/* Filters */}
                    <div className="mb-4 flex items-center gap-4">
                        <Select
                            value={statusFilter}
                            onValueChange={(v) => setStatusFilter(v ?? "all")}
                        >
                            <SelectTrigger className="w-40">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="failed">Failed</SelectItem>
                                <SelectItem value="running">Running</SelectItem>
                                <SelectItem value="queued">Queued</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select
                            value={sourceFilter}
                            onValueChange={(v) => setSourceFilter(v ?? "all")}
                        >
                            <SelectTrigger className="w-40">
                                <SelectValue placeholder="Channel" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Channels</SelectItem>
                                <SelectItem value="slack">Slack</SelectItem>
                                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                <SelectItem value="voice">Voice</SelectItem>
                                <SelectItem value="telegram">Telegram</SelectItem>
                                <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                                <SelectItem value="api">API</SelectItem>
                            </SelectContent>
                        </Select>
                        {(statusFilter !== "all" || sourceFilter !== "all") && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setStatusFilter("all");
                                    setSourceFilter("all");
                                }}
                            >
                                Clear Filters
                            </Button>
                        )}
                    </div>

                    {/* Runs Table */}
                    {runsLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <Skeleton key={i} className="h-16" />
                            ))}
                        </div>
                    ) : runs.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <p className="text-muted-foreground text-lg">
                                    No production runs found
                                </p>
                                <p className="text-muted-foreground mt-2 text-sm">
                                    Runs from production channels will appear here
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Agent</TableHead>
                                        <TableHead>Channel</TableHead>
                                        <TableHead>Input</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Duration</TableHead>
                                        <TableHead className="text-right">Tokens</TableHead>
                                        <TableHead className="text-right">Cost</TableHead>
                                        <TableHead>Time</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {runs.map((run) => (
                                        <TableRow
                                            key={run.id}
                                            className="cursor-pointer"
                                            onClick={() => handleRunClick(run)}
                                        >
                                            <TableCell>
                                                <p className="font-medium">{run.agentName}</p>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={getSourceBadgeColor(run.source)}>
                                                    {run.source || "unknown"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <p className="max-w-xs truncate text-sm">
                                                    {run.inputText.slice(0, 100)}
                                                    {run.inputText.length > 100 ? "..." : ""}
                                                </p>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={getStatusBadgeVariant(run.status)}>
                                                    {run.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {run.durationMs
                                                    ? formatLatency(run.durationMs)
                                                    : "-"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {run.totalTokens?.toLocaleString() || "-"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {run.costUsd ? `$${run.costUsd.toFixed(4)}` : "-"}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {formatRelativeTime(run.startedAt)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
