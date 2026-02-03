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
    TabsContent,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    Separator,
    icons,
    HugeiconsIcon
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

// Detailed run data from the API
interface TraceStep {
    id: string;
    stepNumber: number;
    type: string;
    content: string;
    timestamp: string;
    durationMs: number | null;
}

interface ToolCall {
    id: string;
    toolKey: string;
    mcpServerId: string | null;
    inputJson: unknown;
    outputJson: unknown;
    success: boolean;
    error: string | null;
    durationMs: number | null;
    createdAt: string;
}

interface Trace {
    id: string;
    status: string;
    inputText: string;
    outputText: string | null;
    durationMs: number | null;
    stepsJson: unknown;
    modelJson: unknown;
    tokensJson: unknown;
    scoresJson: unknown;
    steps: TraceStep[];
    toolCalls: ToolCall[];
}

interface Evaluation {
    id: string;
    scorerKey: string;
    score: number;
    label: string | null;
    reasoning: string | null;
    createdAt: string;
}

interface Feedback {
    id: string;
    rating: number | null;
    comment: string | null;
    createdAt: string;
}

interface CostEvent {
    id: string;
    totalCostUsd: number;
    promptTokens: number;
    completionTokens: number;
}

interface RunDetail {
    id: string;
    agentId: string;
    runType: string;
    status: string;
    inputText: string;
    outputText: string | null;
    durationMs: number | null;
    startedAt: string;
    completedAt: string | null;
    modelProvider: string | null;
    modelName: string | null;
    versionId: string | null;
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    costUsd: number | null;
    trace: Trace | null;
    evaluation: Evaluation[] | null;
    feedback: Feedback[] | null;
    costEvent: CostEvent | null;
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

    // Run detail modal state
    const [selectedRun, setSelectedRun] = useState<Run | null>(null);
    const [runDetail, setRunDetail] = useState<RunDetail | null>(null);
    const [runDetailLoading, setRunDetailLoading] = useState(false);
    const [detailTab, setDetailTab] = useState("overview");

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

    // Fetch run details
    const fetchRunDetail = useCallback(async (run: Run) => {
        setRunDetailLoading(true);
        setDetailTab("overview");
        try {
            const res = await fetch(`${getApiBase()}/api/agents/${run.agentSlug}/runs/${run.id}`);
            const data = await res.json();
            if (data.success) {
                setRunDetail(data.run);
            }
        } catch (error) {
            console.error("Failed to fetch run detail:", error);
        } finally {
            setRunDetailLoading(false);
        }
    }, []);

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
        // Navigate to workspace for agent management
        router.push(`/workspace/${agent.slug}/overview`);
    };

    const handleRunClick = (run: Run) => {
        // Open run detail modal
        setSelectedRun(run);
        fetchRunDetail(run);
    };

    const closeRunModal = () => {
        setSelectedRun(null);
        setRunDetail(null);
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

            {/* Run Detail Modal */}
            <Dialog open={!!selectedRun} onOpenChange={(open) => !open && closeRunModal()}>
                <DialogContent className="flex h-[90vh] w-[95vw] !max-w-[1400px] flex-col p-0">
                    {selectedRun && (
                        <>
                            {/* Modal Header */}
                            <DialogHeader className="shrink-0 border-b px-6 py-4">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <DialogTitle className="flex items-center gap-3 text-xl">
                                            <span>{selectedRun.agentName}</span>
                                            <Badge
                                                className={getSourceBadgeColor(selectedRun.source)}
                                            >
                                                {selectedRun.source || "unknown"}
                                            </Badge>
                                            <Badge
                                                variant={getStatusBadgeVariant(selectedRun.status)}
                                            >
                                                {selectedRun.status}
                                            </Badge>
                                        </DialogTitle>
                                        <p className="text-muted-foreground text-sm">
                                            {new Date(selectedRun.startedAt).toLocaleString()} •{" "}
                                            {selectedRun.durationMs
                                                ? formatLatency(selectedRun.durationMs)
                                                : "Running..."}
                                        </p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            router.push(
                                                `/workspace/${selectedRun.agentSlug}/runs?runId=${selectedRun.id}`
                                            )
                                        }
                                    >
                                        Open in Workspace
                                    </Button>
                                </div>

                                {/* Quick Stats */}
                                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
                                    <div className="bg-muted/50 rounded-lg p-3">
                                        <p className="text-muted-foreground text-xs">Duration</p>
                                        <p className="text-xl font-bold">
                                            {selectedRun.durationMs
                                                ? formatLatency(selectedRun.durationMs)
                                                : "-"}
                                        </p>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-3">
                                        <p className="text-muted-foreground text-xs">Tokens</p>
                                        <p className="text-xl font-bold">
                                            {selectedRun.totalTokens?.toLocaleString() || "-"}
                                        </p>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-3">
                                        <p className="text-muted-foreground text-xs">Cost</p>
                                        <p className="text-xl font-bold">
                                            {selectedRun.costUsd
                                                ? `$${selectedRun.costUsd.toFixed(2)}`
                                                : "-"}
                                        </p>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-3">
                                        <p className="text-muted-foreground text-xs">Provider</p>
                                        <p className="text-lg font-bold capitalize">
                                            {selectedRun.modelProvider || "-"}
                                        </p>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-3">
                                        <p className="text-muted-foreground text-xs">Model</p>
                                        <p
                                            className="text-sm font-bold"
                                            title={selectedRun.modelName || ""}
                                        >
                                            {selectedRun.modelName
                                                ?.replace(/-\d{8}$/, "")
                                                .replace("claude-", "")
                                                .replace("gpt-", "") || "-"}
                                        </p>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-3">
                                        <p className="text-muted-foreground text-xs">Tool Calls</p>
                                        <p className="text-xl font-bold">
                                            {runDetail?.trace?.toolCalls?.length ?? "0"}
                                        </p>
                                    </div>
                                </div>
                            </DialogHeader>

                            {/* Modal Body */}
                            <div className="flex min-h-0 flex-1 flex-col">
                                <Tabs
                                    defaultValue="overview"
                                    value={detailTab}
                                    onValueChange={setDetailTab}
                                    className="flex flex-1 flex-col"
                                >
                                    <TabsList className="mx-6 mt-4 w-fit shrink-0">
                                        <TabsTrigger value="overview" className="gap-2">
                                            <HugeiconsIcon icon={icons.file!} className="size-4" />
                                            Overview
                                        </TabsTrigger>
                                        <TabsTrigger value="trace" className="gap-2">
                                            <HugeiconsIcon
                                                icon={icons.activity!}
                                                className="size-4"
                                            />
                                            Trace
                                        </TabsTrigger>
                                        <TabsTrigger value="tools" className="gap-2">
                                            <HugeiconsIcon
                                                icon={icons.settings!}
                                                className="size-4"
                                            />
                                            Tools ({runDetail?.trace?.toolCalls?.length ?? 0})
                                        </TabsTrigger>
                                        <TabsTrigger value="evals" className="gap-2">
                                            <HugeiconsIcon
                                                icon={icons["chart-evaluation"]!}
                                                className="size-4"
                                            />
                                            Evaluations
                                        </TabsTrigger>
                                    </TabsList>

                                    <div className="flex-1 overflow-y-auto px-6 py-4">
                                        {runDetailLoading ? (
                                            <div className="space-y-4">
                                                <Skeleton className="h-32 w-full" />
                                                <Skeleton className="h-48 w-full" />
                                            </div>
                                        ) : (
                                            <>
                                                {/* Overview Tab */}
                                                <TabsContent
                                                    value="overview"
                                                    className="mt-0 space-y-6"
                                                >
                                                    {/* Input/Output side by side on larger screens */}
                                                    <div className="grid gap-6 lg:grid-cols-2">
                                                        {/* Input */}
                                                        <div className="flex flex-col">
                                                            <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
                                                                <span className="flex size-7 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                                                                    <HugeiconsIcon
                                                                        icon={icons["arrow-right"]!}
                                                                        className="size-4 text-blue-600 dark:text-blue-400"
                                                                    />
                                                                </span>
                                                                User Input
                                                            </h3>
                                                            <div
                                                                className="bg-muted/20 flex-1 overflow-auto rounded-lg border p-4"
                                                                style={{
                                                                    minHeight: "300px",
                                                                    maxHeight: "400px"
                                                                }}
                                                            >
                                                                <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap">
                                                                    {selectedRun.inputText}
                                                                </pre>
                                                            </div>
                                                        </div>

                                                        {/* Output */}
                                                        <div className="flex flex-col">
                                                            <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
                                                                <span className="flex size-7 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                                                                    <HugeiconsIcon
                                                                        icon={icons["arrow-left"]!}
                                                                        className="size-4 text-green-600 dark:text-green-400"
                                                                    />
                                                                </span>
                                                                Agent Response
                                                            </h3>
                                                            <div
                                                                className="bg-muted/20 flex-1 overflow-auto rounded-lg border p-4"
                                                                style={{
                                                                    minHeight: "300px",
                                                                    maxHeight: "400px"
                                                                }}
                                                            >
                                                                <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap">
                                                                    {selectedRun.outputText ||
                                                                        runDetail?.outputText ||
                                                                        "No output"}
                                                                </pre>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Session & Thread Info */}
                                                    {(selectedRun.sessionId ||
                                                        selectedRun.threadId) && (
                                                        <div className="grid grid-cols-2 gap-4">
                                                            {selectedRun.sessionId && (
                                                                <div>
                                                                    <h3 className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                                                                        Session ID
                                                                    </h3>
                                                                    <code className="bg-muted rounded px-2 py-1 text-xs">
                                                                        {selectedRun.sessionId}
                                                                    </code>
                                                                </div>
                                                            )}
                                                            {selectedRun.threadId && (
                                                                <div>
                                                                    <h3 className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                                                                        Thread ID
                                                                    </h3>
                                                                    <code className="bg-muted rounded px-2 py-1 text-xs">
                                                                        {selectedRun.threadId}
                                                                    </code>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Token Breakdown */}
                                                    {runDetail &&
                                                        (runDetail.promptTokens ||
                                                            runDetail.completionTokens) && (
                                                            <div>
                                                                <h3 className="text-muted-foreground mb-2 text-xs font-medium uppercase">
                                                                    Token Breakdown
                                                                </h3>
                                                                <div className="flex gap-6">
                                                                    <div>
                                                                        <span className="text-muted-foreground text-sm">
                                                                            Prompt:
                                                                        </span>{" "}
                                                                        <span className="font-medium">
                                                                            {runDetail.promptTokens?.toLocaleString() ||
                                                                                0}
                                                                        </span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-muted-foreground text-sm">
                                                                            Completion:
                                                                        </span>{" "}
                                                                        <span className="font-medium">
                                                                            {runDetail.completionTokens?.toLocaleString() ||
                                                                                0}
                                                                        </span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-muted-foreground text-sm">
                                                                            Total:
                                                                        </span>{" "}
                                                                        <span className="font-medium">
                                                                            {runDetail.totalTokens?.toLocaleString() ||
                                                                                0}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                </TabsContent>

                                                {/* Trace Tab */}
                                                <TabsContent
                                                    value="trace"
                                                    className="mt-0 space-y-4"
                                                >
                                                    {/* Show steps from steps array or stepsJson */}
                                                    {(() => {
                                                        const steps = runDetail?.trace?.steps ?? [];
                                                        const stepsJson = runDetail?.trace
                                                            ?.stepsJson as unknown[] | null;
                                                        const hasSteps = steps.length > 0;
                                                        const hasStepsJson =
                                                            Array.isArray(stepsJson) &&
                                                            stepsJson.length > 0;

                                                        if (hasSteps) {
                                                            return (
                                                                <div className="space-y-3">
                                                                    {steps.map((step, idx) => (
                                                                        <div
                                                                            key={step.id}
                                                                            className="bg-muted/30 relative rounded-lg border p-4"
                                                                        >
                                                                            <div className="mb-2 flex items-center justify-between">
                                                                                <div className="flex items-center gap-3">
                                                                                    <span className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-full text-sm font-medium">
                                                                                        {idx + 1}
                                                                                    </span>
                                                                                    <Badge variant="outline">
                                                                                        {step.type}
                                                                                    </Badge>
                                                                                </div>
                                                                                <span className="text-muted-foreground text-sm">
                                                                                    {step.durationMs
                                                                                        ? formatLatency(
                                                                                              step.durationMs
                                                                                          )
                                                                                        : "-"}
                                                                                </span>
                                                                            </div>
                                                                            <pre className="bg-background max-h-48 overflow-auto rounded border p-3 text-sm whitespace-pre-wrap">
                                                                                {typeof step.content ===
                                                                                "string"
                                                                                    ? step.content
                                                                                    : JSON.stringify(
                                                                                          step.content,
                                                                                          null,
                                                                                          2
                                                                                      )}
                                                                            </pre>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            );
                                                        }

                                                        if (hasStepsJson) {
                                                            return (
                                                                <div className="space-y-3">
                                                                    {stepsJson.map(
                                                                        (
                                                                            step: unknown,
                                                                            idx: number
                                                                        ) => {
                                                                            const s =
                                                                                step as Record<
                                                                                    string,
                                                                                    unknown
                                                                                >;
                                                                            return (
                                                                                <div
                                                                                    key={idx}
                                                                                    className="bg-muted/30 relative rounded-lg border p-4"
                                                                                >
                                                                                    <div className="mb-2 flex items-center justify-between">
                                                                                        <div className="flex items-center gap-3">
                                                                                            <span className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-full text-sm font-medium">
                                                                                                {idx +
                                                                                                    1}
                                                                                            </span>
                                                                                            <Badge variant="outline">
                                                                                                {String(
                                                                                                    s.type ||
                                                                                                        s.role ||
                                                                                                        "step"
                                                                                                )}
                                                                                            </Badge>
                                                                                        </div>
                                                                                        {s.durationMs !=
                                                                                            null && (
                                                                                            <span className="text-muted-foreground text-sm">
                                                                                                {formatLatency(
                                                                                                    Number(
                                                                                                        s.durationMs
                                                                                                    )
                                                                                                )}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    <pre className="bg-background max-h-48 overflow-auto rounded border p-3 text-sm whitespace-pre-wrap">
                                                                                        {JSON.stringify(
                                                                                            s,
                                                                                            null,
                                                                                            2
                                                                                        )}
                                                                                    </pre>
                                                                                </div>
                                                                            );
                                                                        }
                                                                    )}
                                                                </div>
                                                            );
                                                        }

                                                        // Fallback: show raw trace data if available
                                                        if (runDetail?.trace) {
                                                            return (
                                                                <div className="space-y-4">
                                                                    <div className="bg-muted/30 rounded-lg border p-4">
                                                                        <h4 className="mb-2 font-medium">
                                                                            Trace Data
                                                                        </h4>
                                                                        <pre className="bg-background max-h-96 overflow-auto rounded border p-3 text-sm whitespace-pre-wrap">
                                                                            {JSON.stringify(
                                                                                {
                                                                                    status: runDetail
                                                                                        .trace
                                                                                        .status,
                                                                                    durationMs:
                                                                                        runDetail
                                                                                            .trace
                                                                                            .durationMs,
                                                                                    modelJson:
                                                                                        runDetail
                                                                                            .trace
                                                                                            .modelJson,
                                                                                    tokensJson:
                                                                                        runDetail
                                                                                            .trace
                                                                                            .tokensJson,
                                                                                    scoresJson:
                                                                                        runDetail
                                                                                            .trace
                                                                                            .scoresJson,
                                                                                    stepsJson:
                                                                                        runDetail
                                                                                            .trace
                                                                                            .stepsJson
                                                                                },
                                                                                null,
                                                                                2
                                                                            )}
                                                                        </pre>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }

                                                        return (
                                                            <div className="py-12 text-center">
                                                                <HugeiconsIcon
                                                                    icon={icons.activity!}
                                                                    className="text-muted-foreground mx-auto mb-3 size-12"
                                                                />
                                                                <p className="text-muted-foreground">
                                                                    No trace data recorded
                                                                </p>
                                                            </div>
                                                        );
                                                    })()}
                                                </TabsContent>

                                                {/* Tools Tab */}
                                                <TabsContent
                                                    value="tools"
                                                    className="mt-0 space-y-4"
                                                >
                                                    {runDetail?.trace?.toolCalls &&
                                                    runDetail.trace.toolCalls.length > 0 ? (
                                                        <div className="space-y-4">
                                                            <div className="text-muted-foreground mb-2 text-sm">
                                                                {runDetail.trace.toolCalls.length}{" "}
                                                                tool call
                                                                {runDetail.trace.toolCalls
                                                                    .length !== 1
                                                                    ? "s"
                                                                    : ""}{" "}
                                                                •{" "}
                                                                {
                                                                    runDetail.trace.toolCalls.filter(
                                                                        (c) => c.success
                                                                    ).length
                                                                }{" "}
                                                                succeeded •{" "}
                                                                {
                                                                    runDetail.trace.toolCalls.filter(
                                                                        (c) => !c.success
                                                                    ).length
                                                                }{" "}
                                                                failed
                                                            </div>
                                                            {runDetail.trace.toolCalls.map(
                                                                (call) => (
                                                                    <div
                                                                        key={call.id}
                                                                        className={`rounded-lg border p-5 ${
                                                                            call.success
                                                                                ? "border-green-200 bg-green-50/50 dark:border-green-900/30 dark:bg-green-900/10"
                                                                                : "border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-900/10"
                                                                        }`}
                                                                    >
                                                                        <div className="mb-4 flex items-center justify-between">
                                                                            <div className="flex items-center gap-3">
                                                                                <span
                                                                                    className={`size-3 rounded-full ${
                                                                                        call.success
                                                                                            ? "bg-green-500"
                                                                                            : "bg-red-500"
                                                                                    }`}
                                                                                />
                                                                                <code className="text-base font-semibold">
                                                                                    {call.toolKey}
                                                                                </code>
                                                                                {call.mcpServerId && (
                                                                                    <Badge variant="outline">
                                                                                        MCP:{" "}
                                                                                        {
                                                                                            call.mcpServerId
                                                                                        }
                                                                                    </Badge>
                                                                                )}
                                                                                <Badge
                                                                                    variant={
                                                                                        call.success
                                                                                            ? "default"
                                                                                            : "destructive"
                                                                                    }
                                                                                >
                                                                                    {call.success
                                                                                        ? "Success"
                                                                                        : "Failed"}
                                                                                </Badge>
                                                                            </div>
                                                                            <span className="text-muted-foreground text-sm">
                                                                                {call.durationMs
                                                                                    ? formatLatency(
                                                                                          call.durationMs
                                                                                      )
                                                                                    : "-"}
                                                                            </span>
                                                                        </div>

                                                                        <div className="grid gap-4 md:grid-cols-2">
                                                                            {/* Input */}
                                                                            <div>
                                                                                <p className="text-muted-foreground mb-2 text-sm font-medium">
                                                                                    Input
                                                                                </p>
                                                                                <pre className="bg-background max-h-48 overflow-auto rounded-lg border p-3 text-sm">
                                                                                    {JSON.stringify(
                                                                                        call.inputJson,
                                                                                        null,
                                                                                        2
                                                                                    )}
                                                                                </pre>
                                                                            </div>

                                                                            {/* Output/Error */}
                                                                            <div>
                                                                                {call.error ? (
                                                                                    <>
                                                                                        <p className="mb-2 text-sm font-medium text-red-600">
                                                                                            Error
                                                                                        </p>
                                                                                        <pre className="max-h-48 overflow-auto rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400">
                                                                                            {
                                                                                                call.error
                                                                                            }
                                                                                        </pre>
                                                                                    </>
                                                                                ) : (
                                                                                    <>
                                                                                        <p className="text-muted-foreground mb-2 text-sm font-medium">
                                                                                            Output
                                                                                        </p>
                                                                                        <pre className="bg-background max-h-48 overflow-auto rounded-lg border p-3 text-sm">
                                                                                            {JSON.stringify(
                                                                                                call.outputJson,
                                                                                                null,
                                                                                                2
                                                                                            )}
                                                                                        </pre>
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="py-12 text-center">
                                                            <HugeiconsIcon
                                                                icon={icons.settings!}
                                                                className="text-muted-foreground mx-auto mb-3 size-12"
                                                            />
                                                            <p className="text-muted-foreground text-lg">
                                                                No tool calls in this run
                                                            </p>
                                                            <p className="text-muted-foreground mt-1 text-sm">
                                                                This run completed without calling
                                                                any external tools
                                                            </p>
                                                        </div>
                                                    )}
                                                </TabsContent>

                                                {/* Evaluations Tab */}
                                                <TabsContent
                                                    value="evals"
                                                    className="mt-0 space-y-6"
                                                >
                                                    {(() => {
                                                        const evaluations =
                                                            runDetail?.evaluation ?? [];
                                                        const scoresJson = runDetail?.trace
                                                            ?.scoresJson as Record<
                                                            string,
                                                            unknown
                                                        > | null;
                                                        const hasEvaluations =
                                                            evaluations.length > 0;
                                                        const hasScoresJson =
                                                            scoresJson &&
                                                            Object.keys(scoresJson).length > 0;

                                                        if (hasEvaluations) {
                                                            return (
                                                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                                                    {evaluations.map((evalItem) => (
                                                                        <div
                                                                            key={evalItem.id}
                                                                            className={`rounded-lg border p-5 ${
                                                                                evalItem.score >=
                                                                                0.8
                                                                                    ? "border-green-200 bg-green-50/30 dark:border-green-900/30 dark:bg-green-900/10"
                                                                                    : evalItem.score >=
                                                                                        0.5
                                                                                      ? "border-yellow-200 bg-yellow-50/30 dark:border-yellow-900/30 dark:bg-yellow-900/10"
                                                                                      : "border-red-200 bg-red-50/30 dark:border-red-900/30 dark:bg-red-900/10"
                                                                            }`}
                                                                        >
                                                                            <div className="mb-3 flex items-center justify-between">
                                                                                <h4 className="text-base font-semibold">
                                                                                    {
                                                                                        evalItem.scorerKey
                                                                                    }
                                                                                </h4>
                                                                                <span
                                                                                    className={`text-2xl font-bold ${
                                                                                        evalItem.score >=
                                                                                        0.8
                                                                                            ? "text-green-600"
                                                                                            : evalItem.score >=
                                                                                                0.5
                                                                                              ? "text-yellow-600"
                                                                                              : "text-red-600"
                                                                                    }`}
                                                                                >
                                                                                    {(
                                                                                        evalItem.score *
                                                                                        100
                                                                                    ).toFixed(0)}
                                                                                    %
                                                                                </span>
                                                                            </div>
                                                                            {evalItem.label && (
                                                                                <Badge
                                                                                    className="mb-2"
                                                                                    variant={
                                                                                        evalItem.label ===
                                                                                        "pass"
                                                                                            ? "default"
                                                                                            : evalItem.label ===
                                                                                                "fail"
                                                                                              ? "destructive"
                                                                                              : "secondary"
                                                                                    }
                                                                                >
                                                                                    {evalItem.label}
                                                                                </Badge>
                                                                            )}
                                                                            {evalItem.reasoning && (
                                                                                <p className="text-muted-foreground mt-2 text-sm">
                                                                                    {
                                                                                        evalItem.reasoning
                                                                                    }
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            );
                                                        }

                                                        if (hasScoresJson) {
                                                            return (
                                                                <div className="space-y-4">
                                                                    <h4 className="font-medium">
                                                                        Scores from Trace
                                                                    </h4>
                                                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                                                        {Object.entries(
                                                                            scoresJson
                                                                        ).map(([key, value]) => {
                                                                            const score =
                                                                                typeof value ===
                                                                                "number"
                                                                                    ? value
                                                                                    : typeof value ===
                                                                                            "object" &&
                                                                                        value &&
                                                                                        "score" in
                                                                                            value
                                                                                      ? Number(
                                                                                            (
                                                                                                value as {
                                                                                                    score: number;
                                                                                                }
                                                                                            ).score
                                                                                        )
                                                                                      : 0;
                                                                            return (
                                                                                <div
                                                                                    key={key}
                                                                                    className={`rounded-lg border p-5 ${
                                                                                        score >= 0.8
                                                                                            ? "border-green-200 bg-green-50/30 dark:border-green-900/30 dark:bg-green-900/10"
                                                                                            : score >=
                                                                                                0.5
                                                                                              ? "border-yellow-200 bg-yellow-50/30 dark:border-yellow-900/30 dark:bg-yellow-900/10"
                                                                                              : "border-red-200 bg-red-50/30 dark:border-red-900/30 dark:bg-red-900/10"
                                                                                    }`}
                                                                                >
                                                                                    <div className="flex items-center justify-between">
                                                                                        <h4 className="text-base font-semibold">
                                                                                            {key}
                                                                                        </h4>
                                                                                        <span
                                                                                            className={`text-2xl font-bold ${
                                                                                                score >=
                                                                                                0.8
                                                                                                    ? "text-green-600"
                                                                                                    : score >=
                                                                                                        0.5
                                                                                                      ? "text-yellow-600"
                                                                                                      : "text-red-600"
                                                                                            }`}
                                                                                        >
                                                                                            {(
                                                                                                score *
                                                                                                100
                                                                                            ).toFixed(
                                                                                                0
                                                                                            )}
                                                                                            %
                                                                                        </span>
                                                                                    </div>
                                                                                    {typeof value ===
                                                                                        "object" && (
                                                                                        <pre className="bg-background mt-2 max-h-24 overflow-auto rounded border p-2 text-xs">
                                                                                            {JSON.stringify(
                                                                                                value,
                                                                                                null,
                                                                                                2
                                                                                            )}
                                                                                        </pre>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            );
                                                        }

                                                        return (
                                                            <div className="py-12 text-center">
                                                                <HugeiconsIcon
                                                                    icon={
                                                                        icons["chart-evaluation"]!
                                                                    }
                                                                    className="text-muted-foreground mx-auto mb-3 size-12"
                                                                />
                                                                <p className="text-muted-foreground text-lg">
                                                                    No evaluations for this run
                                                                </p>
                                                                <p className="text-muted-foreground mt-1 text-sm">
                                                                    Configure scorers on your agent
                                                                    to enable automatic evaluations
                                                                </p>
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* User Feedback */}
                                                    {runDetail?.feedback &&
                                                        runDetail.feedback.length > 0 && (
                                                            <>
                                                                <Separator className="my-6" />
                                                                <h3 className="mb-3 font-medium">
                                                                    User Feedback
                                                                </h3>
                                                                <div className="space-y-3">
                                                                    {runDetail.feedback.map(
                                                                        (fb) => (
                                                                            <div
                                                                                key={fb.id}
                                                                                className="bg-muted/30 rounded-lg border p-4"
                                                                            >
                                                                                <div className="mb-2 flex items-center gap-3">
                                                                                    {fb.rating !==
                                                                                        null && (
                                                                                        <div className="flex items-center gap-1">
                                                                                            {[
                                                                                                1,
                                                                                                2,
                                                                                                3,
                                                                                                4, 5
                                                                                            ].map(
                                                                                                (
                                                                                                    star
                                                                                                ) => (
                                                                                                    <span
                                                                                                        key={
                                                                                                            star
                                                                                                        }
                                                                                                        className={
                                                                                                            star <=
                                                                                                            fb.rating!
                                                                                                                ? "text-yellow-500"
                                                                                                                : "text-muted-foreground"
                                                                                                        }
                                                                                                    >
                                                                                                        ★
                                                                                                    </span>
                                                                                                )
                                                                                            )}
                                                                                        </div>
                                                                                    )}
                                                                                    <span className="text-muted-foreground text-xs">
                                                                                        {new Date(
                                                                                            fb.createdAt
                                                                                        ).toLocaleString()}
                                                                                    </span>
                                                                                </div>
                                                                                {fb.comment && (
                                                                                    <p className="text-sm">
                                                                                        {fb.comment}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        )
                                                                    )}
                                                                </div>
                                                            </>
                                                        )}
                                                </TabsContent>
                                            </>
                                        )}
                                    </div>
                                </Tabs>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
