"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    HugeiconsIcon,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Separator,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    icons
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface LiveFilters {
    agents: Array<{
        id: string;
        slug: string;
        name: string;
        isActive: boolean;
        version: number;
    }>;
    versions: Array<{
        id: string;
        agentId: string;
        version: number;
        modelProvider: string;
        modelName: string;
        createdAt: string;
    }>;
    sources: Array<{ source: string | null; count: number }>;
    models: Array<{ modelName: string | null; modelProvider: string | null; count: number }>;
    tools: string[];
    runTypes: Array<{ runType: string; count: number }>;
}

interface LiveMetricsSummary {
    totalRuns: number;
    completedRuns: number;
    failedRuns: number;
    runningRuns: number;
    queuedRuns: number;
    cancelledRuns: number;
    successRate: number;
    avgLatencyMs: number;
    avgToolCalls: number;
    totalTokens: number;
    totalCostUsd: number;
}

interface LiveMetricsTopRun {
    id: string;
    agentId: string;
    agentName: string;
    agentSlug: string;
    status: string;
    durationMs: number | null;
    modelName: string | null;
    modelProvider: string | null;
    startedAt: string;
    costUsd: number | null;
    totalTokens: number | null;
}

interface LiveMetrics {
    summary: LiveMetricsSummary;
    latency: {
        p50: number;
        p95: number;
        sampleSize: number;
    };
    topRuns: {
        slowest: LiveMetricsTopRun[];
        mostExpensive: LiveMetricsTopRun[];
    };
    perAgent: Array<{
        agentId: string;
        agentName: string;
        agentSlug: string;
        totalRuns: number;
        successRate: number;
        failureRate: number;
        avgLatencyMs: number;
        avgToolCalls: number;
        avgTokens: number;
        avgCostUsd: number;
    }>;
    perVersion: Array<{
        versionId: string | null;
        agentId: string | null;
        versionNumber: number | null;
        modelProvider: string | null;
        modelName: string | null;
        createdAt: string | null;
        totalRuns: number;
        successRate: number;
        failureRate: number;
        avgLatencyMs: number;
        avgTokens: number;
        avgCostUsd: number;
    }>;
    modelUsage: Array<{
        modelName: string | null;
        modelProvider: string | null;
        runs: number;
        avgLatencyMs: number;
        totalTokens: number;
        totalCostUsd: number;
        failureRate: number;
    }>;
    dateRange: {
        from: string | null;
        to: string | null;
    };
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
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    costUsd: number | null;
    toolCallCount: number;
    uniqueToolCount: number;
    stepCount: number;
    versionId: string | null;
    versionNumber: number | null;
}

interface RunCounts {
    total: number;
    queued: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
}

interface TraceStep {
    id: string;
    stepNumber: number;
    type: string;
    content: unknown;
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
    scoresJson: Record<string, number>;
    scorerVersion: string | null;
    createdAt: string;
}

interface Feedback {
    id: string;
    thumbs: boolean | null;
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

interface GuardrailEvent {
    id: string;
    type: string;
    guardrailKey: string;
    reason: string;
    inputSnippet: string | null;
    outputSnippet: string | null;
    createdAt: string;
}

interface VersionInfo {
    id: string;
    version: number;
    description: string | null;
    instructions: string;
    modelProvider: string;
    modelName: string;
    snapshot: Record<string, unknown> | null;
    createdAt: string;
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
    evaluation: Evaluation | Evaluation[] | null;
    feedback: Feedback | Feedback[] | null;
    costEvent: CostEvent | null;
    guardrailEvents: GuardrailEvent[] | null;
    version: VersionInfo | null;
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

function getDateRange(timeRange: string): { from: Date | null; to: Date | null } {
    if (timeRange === "all") {
        return { from: null, to: null };
    }

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

function formatCost(value: number | null | undefined): string {
    if (value === null || value === undefined) return "-";
    if (value === 0) return "$0.00";
    return value < 1 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`;
}

function formatTokens(value: number | null | undefined): string {
    if (value === null || value === undefined) return "-";
    return value.toLocaleString();
}

function formatModelLabel(modelName: string | null, modelProvider?: string | null): string {
    if (!modelName) return "-";
    const cleaned = modelName
        .replace(/-\d{8}$/, "")
        .replace(/^claude-/, "")
        .replace(/^gpt-/, "");
    return modelProvider ? `${cleaned} (${modelProvider})` : cleaned;
}

function resolveToolLabel(toolCall: ToolCall): string {
    if (toolCall.toolKey && toolCall.toolKey !== "unknown") {
        return toolCall.toolKey;
    }

    const input = toolCall.inputJson as Record<string, unknown> | null;
    const output = toolCall.outputJson as Record<string, unknown> | null;
    const payload = (output?.payload as Record<string, unknown> | undefined) || undefined;
    const candidates = [
        input?.toolName,
        input?.tool,
        input?.name,
        (input?.function as Record<string, unknown> | undefined)?.name,
        output?.toolName,
        output?.tool,
        output?.name,
        payload?.toolName,
        payload?.tool,
        payload?.name,
        (payload?.function as Record<string, unknown> | undefined)?.name
    ];

    const resolved = candidates.find(
        (value): value is string => typeof value === "string" && value.trim().length > 0
    );
    return resolved || "Tool Call";
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
    const [filtersLoading, setFiltersLoading] = useState(false);
    const [metrics, setMetrics] = useState<LiveMetrics | null>(null);
    const [filters, setFilters] = useState<LiveFilters | null>(null);
    const [runs, setRuns] = useState<Run[]>([]);
    const [runCounts, setRunCounts] = useState<RunCounts | null>(null);
    const [runsLoading, setRunsLoading] = useState(false);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [sourceFilter, setSourceFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [agentFilter, setAgentFilter] = useState("all");
    const [versionFilter, setVersionFilter] = useState("all");
    const [modelFilter, setModelFilter] = useState("all");
    const [toolUsageFilter, setToolUsageFilter] = useState("all");
    const [runTypeFilter, setRunTypeFilter] = useState("PROD");
    const [timeRange, setTimeRange] = useState("24h");
    const [groupBy, setGroupBy] = useState("none");
    const [sortKey, setSortKey] = useState("startedAt");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
    const [autoRefresh, setAutoRefresh] = useState(true);

    const [selectedRun, setSelectedRun] = useState<Run | null>(null);
    const [runDetail, setRunDetail] = useState<RunDetail | null>(null);
    const [runDetailLoading, setRunDetailLoading] = useState(false);
    const [detailTab, setDetailTab] = useState("overview");

    const { from: rangeFrom, to: rangeTo } = useMemo(() => {
        return getDateRange(timeRange);
    }, [timeRange]);

    const fetchFilters = useCallback(async () => {
        setFiltersLoading(true);
        try {
            const params = new URLSearchParams();
            params.set("runType", runTypeFilter);
            if (rangeFrom) {
                params.set("from", rangeFrom.toISOString());
            }
            if (rangeTo) {
                params.set("to", rangeTo.toISOString());
            }
            const res = await fetch(`${getApiBase()}/api/live/filters?${params.toString()}`);
            const data = await res.json();
            if (data.success) {
                setFilters(data.filters);
            }
        } catch (error) {
            console.error("Failed to fetch filters:", error);
        } finally {
            setFiltersLoading(false);
        }
    }, [runTypeFilter, rangeFrom, rangeTo]);

    const fetchMetrics = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            params.set("runType", runTypeFilter);
            if (rangeFrom) {
                params.set("from", rangeFrom.toISOString());
            }
            if (rangeTo) {
                params.set("to", rangeTo.toISOString());
            }
            const res = await fetch(`${getApiBase()}/api/live/metrics?${params.toString()}`);
            const data = await res.json();
            if (data.success) {
                setMetrics(data);
            }
        } catch (error) {
            console.error("Failed to fetch metrics:", error);
        }
    }, [runTypeFilter, rangeFrom, rangeTo]);

    const fetchRuns = useCallback(async () => {
        setRunsLoading(true);
        try {
            const params = new URLSearchParams();
            params.set("runType", runTypeFilter);
            if (statusFilter !== "all") {
                params.set("status", statusFilter);
            }
            if (sourceFilter !== "all") {
                params.set("source", sourceFilter);
            }
            if (agentFilter !== "all") {
                params.set("agentId", agentFilter);
            }
            if (versionFilter !== "all") {
                params.set("versionId", versionFilter);
            }
            if (modelFilter !== "all") {
                params.set("modelName", modelFilter);
            }
            if (toolUsageFilter !== "all") {
                params.set("toolUsage", toolUsageFilter);
            }
            if (searchQuery) {
                params.set("search", searchQuery);
            }
            if (rangeFrom) {
                params.set("from", rangeFrom.toISOString());
            }
            if (rangeTo) {
                params.set("to", rangeTo.toISOString());
            }
            const res = await fetch(`${getApiBase()}/api/live/runs?${params.toString()}`);
            const data = await res.json();
            if (data.success) {
                setRuns(data.runs);
                setRunCounts(data.counts);
                setLastUpdatedAt(new Date());
            }
        } catch (error) {
            console.error("Failed to fetch runs:", error);
        } finally {
            setRunsLoading(false);
        }
    }, [
        runTypeFilter,
        statusFilter,
        sourceFilter,
        agentFilter,
        versionFilter,
        modelFilter,
        toolUsageFilter,
        searchQuery,
        rangeFrom,
        rangeTo
    ]);

    const fetchRunDetail = useCallback(async (run: Run) => {
        setRunDetailLoading(true);
        setDetailTab("overview");
        setRunDetail(null);
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

    useEffect(() => {
        Promise.all([fetchFilters(), fetchMetrics(), fetchRuns()]).finally(() => {
            setLoading(false);
        });
    }, [fetchFilters, fetchMetrics, fetchRuns]);

    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(() => {
            fetchMetrics();
            fetchRuns();
        }, 30000);

        return () => clearInterval(interval);
    }, [autoRefresh, fetchMetrics, fetchRuns]);

    useEffect(() => {
        if (loading) return;
        fetchRuns();
    }, [fetchRuns, loading]);

    useEffect(() => {
        if (loading) return;
        fetchFilters();
        fetchMetrics();
    }, [fetchFilters, fetchMetrics, loading]);

    useEffect(() => {
        if (!selectedRun) return;
        const updatedRun = runs.find((run) => run.id === selectedRun.id);
        if (updatedRun) {
            setSelectedRun(updatedRun);
        }
    }, [runs, selectedRun]);

    const handleAgentClick = (agentSlug: string) => {
        router.push(`/workspace/${agentSlug}/overview`);
    };

    const handleRunClick = (run: Run) => {
        setSelectedRun(run);
        fetchRunDetail(run);
    };

    const handleRunSelectById = useCallback(
        (runId: string) => {
            const run = runs.find((item) => item.id === runId);
            if (run) {
                setSelectedRun(run);
                fetchRunDetail(run);
            }
        },
        [runs, fetchRunDetail]
    );

    const slowRunIds = useMemo(() => {
        return new Set(metrics?.topRuns.slowest.map((run) => run.id) || []);
    }, [metrics]);

    const expensiveRunIds = useMemo(() => {
        return new Set(metrics?.topRuns.mostExpensive.map((run) => run.id) || []);
    }, [metrics]);

    const sortedRuns = useMemo(() => {
        const sorted = [...runs];
        const dir = sortDirection === "asc" ? 1 : -1;
        sorted.sort((a, b) => {
            switch (sortKey) {
                case "durationMs":
                    return ((a.durationMs || 0) - (b.durationMs || 0)) * dir;
                case "costUsd":
                    return ((a.costUsd || 0) - (b.costUsd || 0)) * dir;
                case "totalTokens":
                    return ((a.totalTokens || 0) - (b.totalTokens || 0)) * dir;
                case "toolCallCount":
                    return (a.toolCallCount - b.toolCallCount) * dir;
                case "status":
                    return a.status.localeCompare(b.status) * dir;
                case "startedAt":
                default:
                    return (
                        (new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()) * dir
                    );
            }
        });
        return sorted;
    }, [runs, sortKey, sortDirection]);

    const groupedRuns = useMemo(() => {
        if (groupBy === "none") {
            return [{ label: "All Runs", runs: sortedRuns }];
        }

        const groups = new Map<string, Run[]>();
        const getGroupLabel = (run: Run) => {
            switch (groupBy) {
                case "agent":
                    return run.agentName;
                case "version":
                    return run.versionNumber ? `v${run.versionNumber}` : "Unknown Version";
                case "model":
                    return run.modelName || "Unknown Model";
                case "status":
                    return run.status;
                case "source":
                    return run.source || "Unknown Source";
                default:
                    return "All Runs";
            }
        };

        for (const run of sortedRuns) {
            const label = getGroupLabel(run);
            const list = groups.get(label) || [];
            list.push(run);
            groups.set(label, list);
        }

        return Array.from(groups.entries()).map(([label, runs]) => ({ label, runs }));
    }, [sortedRuns, groupBy]);

    const feedbackList = useMemo(() => {
        const feedback = runDetail?.feedback;
        if (!feedback) return [];
        return Array.isArray(feedback) ? feedback : [feedback];
    }, [runDetail]);

    const evaluationScores = useMemo(() => {
        const evaluation = runDetail?.evaluation;
        const evaluationScoresJson = Array.isArray(evaluation)
            ? evaluation[0]?.scoresJson
            : evaluation?.scoresJson;
        const traceScores =
            typeof runDetail?.trace?.scoresJson === "object"
                ? (runDetail?.trace?.scoresJson as Record<string, unknown>)
                : null;
        return evaluationScoresJson || traceScores;
    }, [runDetail]);

    const toolErrors = useMemo(() => {
        return (runDetail?.trace?.toolCalls || []).filter((toolCall) => !toolCall.success);
    }, [runDetail]);

    const guardrailEvents = useMemo(() => {
        return runDetail?.guardrailEvents || [];
    }, [runDetail]);

    const summary = metrics?.summary;
    const hasActiveFilters =
        searchQuery.length > 0 ||
        statusFilter !== "all" ||
        sourceFilter !== "all" ||
        agentFilter !== "all" ||
        versionFilter !== "all" ||
        modelFilter !== "all" ||
        toolUsageFilter !== "all" ||
        runTypeFilter !== "PROD" ||
        timeRange !== "24h";

    const agentNameById = useMemo(() => {
        return new Map((filters?.agents || []).map((agent) => [agent.id, agent.name]));
    }, [filters]);

    const perAgentSorted = useMemo(() => {
        return [...(metrics?.perAgent || [])].sort((a, b) => b.totalRuns - a.totalRuns);
    }, [metrics]);

    const perVersionSorted = useMemo(() => {
        return [...(metrics?.perVersion || [])].sort((a, b) => b.totalRuns - a.totalRuns);
    }, [metrics]);

    const modelUsageSorted = useMemo(() => {
        return [...(metrics?.modelUsage || [])].sort((a, b) => b.runs - a.runs);
    }, [metrics]);

    const sourceOptions = useMemo(() => {
        const sources = (filters?.sources || [])
            .map((source) => source.source)
            .filter((value): value is string => Boolean(value));
        return sources.length > 0
            ? sources
            : ["slack", "whatsapp", "voice", "telegram", "elevenlabs", "api"];
    }, [filters]);

    const runTypeOptions = useMemo(() => {
        const types = (filters?.runTypes || []).map((type) => type.runType);
        return types.length > 0 ? types : ["PROD", "TEST", "AB"];
    }, [filters]);

    if (loading) {
        return (
            <div className="container mx-auto space-y-6 py-6">
                <Skeleton className="h-10 w-64" />
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="h-24" />
                    ))}
                </div>
                <Skeleton className="h-16 w-full" />
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                    <Skeleton className="h-[500px]" />
                    <Skeleton className="h-[500px]" />
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto space-y-6 py-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold">Live Runs</h1>
                        <Badge
                            variant="outline"
                            className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                        >
                            {autoRefresh ? "Auto-refreshing" : "Paused"}
                        </Badge>
                    </div>
                    <p className="text-muted-foreground">
                        Primary Debug + Monitoring Zone for agent executions.
                    </p>
                    {lastUpdatedAt && (
                        <p className="text-muted-foreground mt-1 text-xs">
                            Last updated {lastUpdatedAt.toLocaleTimeString()}
                        </p>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            fetchMetrics();
                            fetchRuns();
                        }}
                    >
                        <HugeiconsIcon icon={icons.refresh!} className="mr-2 size-4" />
                        Refresh
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAutoRefresh(!autoRefresh)}
                    >
                        {autoRefresh ? "Pause Auto-refresh" : "Resume Auto-refresh"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => router.push("/workspace")}>
                        <HugeiconsIcon icon={icons["arrow-right"]!} className="mr-2 size-4" />
                        Workspace
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Runs</CardDescription>
                        <CardTitle className="text-2xl">
                            {summary ? summary.totalRuns.toLocaleString() : "-"}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Running</CardDescription>
                        <CardTitle className="text-2xl text-blue-600">
                            {summary ? summary.runningRuns.toLocaleString() : "-"}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Failed</CardDescription>
                        <CardTitle className="text-2xl text-red-600">
                            {summary ? summary.failedRuns.toLocaleString() : "-"}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Success Rate</CardDescription>
                        <CardTitle
                            className={`text-2xl ${
                                summary && summary.successRate >= 90
                                    ? "text-green-600"
                                    : summary && summary.successRate >= 70
                                      ? "text-yellow-600"
                                      : "text-red-600"
                            }`}
                        >
                            {summary ? `${summary.successRate}%` : "-"}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Avg Latency</CardDescription>
                        <CardTitle className="text-2xl">
                            {summary ? formatLatency(summary.avgLatencyMs) : "-"}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Avg Tool Calls</CardDescription>
                        <CardTitle className="text-2xl">
                            {summary ? summary.avgToolCalls.toFixed(2) : "-"}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Tokens</CardDescription>
                        <CardTitle className="text-2xl">
                            {summary ? summary.totalTokens.toLocaleString() : "-"}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Cost</CardDescription>
                        <CardTitle className="text-2xl">
                            {summary ? formatCost(summary.totalCostUsd) : "-"}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            <Card className="sticky top-4 z-10">
                <CardContent className="flex flex-col gap-4 py-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <Input
                            placeholder="Search run ID or keyword in input/output..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="min-w-[240px] flex-1"
                        />
                        <Select
                            value={statusFilter}
                            onValueChange={(value) => setStatusFilter(value ?? "all")}
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
                            onValueChange={(value) => setSourceFilter(value ?? "all")}
                        >
                            <SelectTrigger className="w-40">
                                <SelectValue placeholder="Source" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Sources</SelectItem>
                                {sourceOptions.map((source) => (
                                    <SelectItem key={source} value={source}>
                                        {source}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={agentFilter}
                            onValueChange={(value) => setAgentFilter(value ?? "all")}
                        >
                            <SelectTrigger className="w-48">
                                <SelectValue placeholder="Agent" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Agents</SelectItem>
                                {(filters?.agents || [])
                                    .slice()
                                    .sort((a, b) => a.name.localeCompare(b.name))
                                    .map((agent) => (
                                        <SelectItem key={agent.id} value={agent.id}>
                                            {agent.name}
                                        </SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={versionFilter}
                            onValueChange={(value) => setVersionFilter(value ?? "all")}
                        >
                            <SelectTrigger className="w-52">
                                <SelectValue placeholder="Version" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Versions</SelectItem>
                                {(filters?.versions || [])
                                    .slice()
                                    .sort((a, b) => b.version - a.version)
                                    .map((version) => (
                                        <SelectItem key={version.id} value={version.id}>
                                            {`${agentNameById.get(version.agentId) || "Agent"} v${version.version}`}
                                        </SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={modelFilter}
                            onValueChange={(value) => setModelFilter(value ?? "all")}
                        >
                            <SelectTrigger className="w-48">
                                <SelectValue placeholder="Model" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Models</SelectItem>
                                {(filters?.models || [])
                                    .filter((model) => model.modelName)
                                    .slice()
                                    .sort((a, b) =>
                                        `${a.modelProvider}-${a.modelName}`.localeCompare(
                                            `${b.modelProvider}-${b.modelName}`
                                        )
                                    )
                                    .map((model) => (
                                        <SelectItem
                                            key={`${model.modelProvider}-${model.modelName}`}
                                            value={model.modelName as string}
                                        >
                                            {formatModelLabel(model.modelName, model.modelProvider)}
                                        </SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={toolUsageFilter}
                            onValueChange={(value) => setToolUsageFilter(value ?? "all")}
                        >
                            <SelectTrigger className="w-44">
                                <SelectValue placeholder="Tool Usage" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Tool Usage</SelectItem>
                                <SelectItem value="with_tools">With Tools</SelectItem>
                                <SelectItem value="without_tools">No Tools</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select
                            value={runTypeFilter}
                            onValueChange={(value) => setRunTypeFilter(value ?? "PROD")}
                        >
                            <SelectTrigger className="w-36">
                                <SelectValue placeholder="Run Type" />
                            </SelectTrigger>
                            <SelectContent>
                                {runTypeOptions.map((runType) => (
                                    <SelectItem key={runType} value={runType}>
                                        {runType}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={timeRange}
                            onValueChange={(value) => setTimeRange(value ?? "24h")}
                        >
                            <SelectTrigger className="w-32">
                                <SelectValue placeholder="Time Range" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="24h">Last 24h</SelectItem>
                                <SelectItem value="7d">Last 7d</SelectItem>
                                <SelectItem value="30d">Last 30d</SelectItem>
                                <SelectItem value="90d">Last 90d</SelectItem>
                                <SelectItem value="all">All Time</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select
                            value={groupBy}
                            onValueChange={(value) => setGroupBy(value ?? "none")}
                        >
                            <SelectTrigger className="w-32">
                                <SelectValue placeholder="Group By" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No Group</SelectItem>
                                <SelectItem value="agent">Agent</SelectItem>
                                <SelectItem value="version">Version</SelectItem>
                                <SelectItem value="model">Model</SelectItem>
                                <SelectItem value="status">Status</SelectItem>
                                <SelectItem value="source">Source</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select
                            value={sortKey}
                            onValueChange={(value) => setSortKey(value ?? "startedAt")}
                        >
                            <SelectTrigger className="w-36">
                                <SelectValue placeholder="Sort By" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="startedAt">Time</SelectItem>
                                <SelectItem value="durationMs">Duration</SelectItem>
                                <SelectItem value="costUsd">Cost</SelectItem>
                                <SelectItem value="totalTokens">Tokens</SelectItem>
                                <SelectItem value="toolCallCount">Tool Calls</SelectItem>
                                <SelectItem value="status">Status</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select
                            value={sortDirection}
                            onValueChange={(value) => setSortDirection(value as "asc" | "desc")}
                        >
                            <SelectTrigger className="w-28">
                                <SelectValue placeholder="Order" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="desc">Desc</SelectItem>
                                <SelectItem value="asc">Asc</SelectItem>
                            </SelectContent>
                        </Select>
                        {hasActiveFilters && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setSearchQuery("");
                                    setStatusFilter("all");
                                    setSourceFilter("all");
                                    setAgentFilter("all");
                                    setVersionFilter("all");
                                    setModelFilter("all");
                                    setToolUsageFilter("all");
                                    setRunTypeFilter("PROD");
                                    setTimeRange("24h");
                                    setGroupBy("none");
                                    setSortKey("startedAt");
                                    setSortDirection("desc");
                                }}
                            >
                                Clear Filters
                            </Button>
                        )}
                    </div>
                    {filtersLoading && (
                        <p className="text-muted-foreground text-xs">Loading filter options...</p>
                    )}
                </CardContent>
            </Card>

            {runCounts && (
                <div className="flex flex-wrap gap-2">
                    <Badge
                        variant={statusFilter === "all" ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setStatusFilter("all")}
                    >
                        Total {runCounts.total.toLocaleString()}
                    </Badge>
                    <Badge
                        variant={statusFilter === "completed" ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setStatusFilter("completed")}
                    >
                        Completed {runCounts.completed.toLocaleString()}
                    </Badge>
                    <Badge
                        variant={statusFilter === "failed" ? "destructive" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setStatusFilter("failed")}
                    >
                        Failed {runCounts.failed.toLocaleString()}
                    </Badge>
                    <Badge
                        variant={statusFilter === "running" ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setStatusFilter("running")}
                    >
                        Running {runCounts.running.toLocaleString()}
                    </Badge>
                    <Badge
                        variant={statusFilter === "queued" ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setStatusFilter("queued")}
                    >
                        Queued {runCounts.queued.toLocaleString()}
                    </Badge>
                    <Badge
                        variant={statusFilter === "cancelled" ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setStatusFilter("cancelled")}
                    >
                        Cancelled {runCounts.cancelled.toLocaleString()}
                    </Badge>
                </div>
            )}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Card>
                    <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <CardTitle>Runs</CardTitle>
                                <CardDescription>
                                    {runs.length} shown
                                    {runCounts
                                        ? ` of ${runCounts.total.toLocaleString()} matching runs`
                                        : ""}
                                </CardDescription>
                            </div>
                            {runsLoading && (
                                <p className="text-muted-foreground text-xs">Refreshing...</p>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {runsLoading ? (
                            <div className="space-y-3">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <Skeleton key={i} className="h-14 w-full" />
                                ))}
                            </div>
                        ) : runs.length === 0 ? (
                            <div className="py-12 text-center">
                                <p className="text-muted-foreground text-lg">
                                    No runs match the current filters
                                </p>
                                <p className="text-muted-foreground mt-2 text-sm">
                                    Adjust filters or broaden the time range to see more runs
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Agent</TableHead>
                                            <TableHead>Version</TableHead>
                                            <TableHead>Model</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Source</TableHead>
                                            <TableHead>Input</TableHead>
                                            <TableHead className="text-right">Duration</TableHead>
                                            <TableHead className="text-right">Tool Calls</TableHead>
                                            <TableHead className="text-right">Tools</TableHead>
                                            <TableHead className="text-right">Tokens</TableHead>
                                            <TableHead className="text-right">Cost</TableHead>
                                            <TableHead className="text-right">Time</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {groupedRuns.map((group) => (
                                            <Fragment key={group.label}>
                                                {groupBy !== "none" && (
                                                    <TableRow>
                                                        <TableCell
                                                            colSpan={12}
                                                            className="text-muted-foreground bg-muted/30 text-xs font-semibold uppercase"
                                                        >
                                                            {group.label} ({group.runs.length})
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                                {group.runs.map((run) => {
                                                    const isSelected = selectedRun?.id === run.id;
                                                    const isSlow = slowRunIds.has(run.id);
                                                    const isExpensive = expensiveRunIds.has(run.id);
                                                    return (
                                                        <TableRow
                                                            key={run.id}
                                                            className={`cursor-pointer ${
                                                                isSelected ? "bg-muted/50" : ""
                                                            } ${
                                                                isSlow
                                                                    ? "border-l-4 border-yellow-400"
                                                                    : ""
                                                            } ${
                                                                isExpensive
                                                                    ? "border-l-4 border-purple-400"
                                                                    : ""
                                                            }`}
                                                            onClick={() => handleRunClick(run)}
                                                        >
                                                            <TableCell>
                                                                <div>
                                                                    <p className="font-medium">
                                                                        {run.agentName}
                                                                    </p>
                                                                    <p className="text-muted-foreground text-xs">
                                                                        {run.id}
                                                                    </p>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                {run.versionNumber
                                                                    ? `v${run.versionNumber}`
                                                                    : "-"}
                                                            </TableCell>
                                                            <TableCell>
                                                                {formatModelLabel(
                                                                    run.modelName,
                                                                    run.modelProvider
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge
                                                                    variant={getStatusBadgeVariant(
                                                                        run.status
                                                                    )}
                                                                >
                                                                    {run.status}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell>
                                                                {run.source ? (
                                                                    <Badge
                                                                        className={getSourceBadgeColor(
                                                                            run.source
                                                                        )}
                                                                    >
                                                                        {run.source}
                                                                    </Badge>
                                                                ) : (
                                                                    "-"
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                <p className="max-w-xs truncate">
                                                                    {run.inputText}
                                                                </p>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                {run.durationMs
                                                                    ? formatLatency(run.durationMs)
                                                                    : "-"}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                {run.toolCallCount}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                {run.uniqueToolCount}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                {formatTokens(run.totalTokens)}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                {formatCost(run.costUsd)}
                                                            </TableCell>
                                                            <TableCell className="text-muted-foreground text-right">
                                                                <span
                                                                    title={new Date(
                                                                        run.startedAt
                                                                    ).toLocaleString()}
                                                                >
                                                                    {formatRelativeTime(
                                                                        run.startedAt
                                                                    )}
                                                                </span>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </Fragment>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="flex flex-col">
                    <CardHeader className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <CardTitle className="text-lg">
                                    {selectedRun ? selectedRun.agentName : "Run Detail"}
                                </CardTitle>
                                <CardDescription>
                                    {selectedRun
                                        ? `Run ID: ${selectedRun.id}`
                                        : "Select a run to inspect trace, tools, and context."}
                                </CardDescription>
                            </div>
                            {selectedRun && (
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
                            )}
                        </div>
                        {selectedRun && (
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={getStatusBadgeVariant(selectedRun.status)}>
                                    {selectedRun.status}
                                </Badge>
                                {selectedRun.source && (
                                    <Badge className={getSourceBadgeColor(selectedRun.source)}>
                                        {selectedRun.source}
                                    </Badge>
                                )}
                                {selectedRun.versionNumber && (
                                    <Badge variant="outline">v{selectedRun.versionNumber}</Badge>
                                )}
                                <Badge variant="outline">{selectedRun.runType}</Badge>
                                <Badge variant="outline">
                                    {formatModelLabel(
                                        selectedRun.modelName,
                                        selectedRun.modelProvider
                                    )}
                                </Badge>
                            </div>
                        )}
                        {selectedRun && (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-muted/50 rounded-lg p-3">
                                    <p className="text-muted-foreground text-xs">Duration</p>
                                    <p className="text-base font-semibold">
                                        {selectedRun.durationMs
                                            ? formatLatency(selectedRun.durationMs)
                                            : "-"}
                                    </p>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-3">
                                    <p className="text-muted-foreground text-xs">Tokens</p>
                                    <p className="text-base font-semibold">
                                        {formatTokens(selectedRun.totalTokens)}
                                    </p>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-3">
                                    <p className="text-muted-foreground text-xs">Cost</p>
                                    <p className="text-base font-semibold">
                                        {formatCost(selectedRun.costUsd)}
                                    </p>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-3">
                                    <p className="text-muted-foreground text-xs">Tool Calls</p>
                                    <p className="text-base font-semibold">
                                        {selectedRun.toolCallCount}
                                    </p>
                                </div>
                            </div>
                        )}
                    </CardHeader>
                    <CardContent className="flex-1 overflow-hidden">
                        {!selectedRun ? (
                            <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 py-12 text-center">
                                <HugeiconsIcon icon={icons.activity!} className="size-10" />
                                <p className="text-sm">
                                    Select a run to view its trace, tools, and latency breakdown.
                                </p>
                            </div>
                        ) : (
                            <Tabs
                                defaultValue="overview"
                                value={detailTab}
                                onValueChange={(value) => setDetailTab(value ?? "overview")}
                                className="flex h-full flex-col"
                            >
                                <TabsList className="flex w-full flex-nowrap justify-start gap-2 overflow-x-auto">
                                    <TabsTrigger value="overview" className="shrink-0 gap-2">
                                        <HugeiconsIcon icon={icons.file!} className="size-4" />
                                        Overview
                                    </TabsTrigger>
                                    <TabsTrigger value="trace" className="shrink-0 gap-2">
                                        <HugeiconsIcon icon={icons.activity!} className="size-4" />
                                        Trace
                                    </TabsTrigger>
                                    <TabsTrigger value="tools" className="shrink-0 gap-2">
                                        <HugeiconsIcon icon={icons.settings!} className="size-4" />
                                        Tools
                                    </TabsTrigger>
                                    <TabsTrigger value="errors" className="shrink-0 gap-2">
                                        <HugeiconsIcon
                                            icon={icons["alert-diamond"]!}
                                            className="size-4"
                                        />
                                        Errors
                                    </TabsTrigger>
                                    <TabsTrigger value="latency" className="shrink-0 gap-2">
                                        <HugeiconsIcon icon={icons.clock!} className="size-4" />
                                        Latency
                                    </TabsTrigger>
                                </TabsList>

                                <div className="mt-4 flex-1 overflow-y-auto">
                                    {runDetailLoading ? (
                                        <div className="space-y-4">
                                            <Skeleton className="h-32 w-full" />
                                            <Skeleton className="h-48 w-full" />
                                        </div>
                                    ) : (
                                        <>
                                            <TabsContent
                                                value="overview"
                                                className="mt-0 space-y-6"
                                            >
                                                <div className="grid gap-4 lg:grid-cols-2">
                                                    <div className="flex flex-col">
                                                        <h3 className="mb-2 text-sm font-semibold">
                                                            User Input
                                                        </h3>
                                                        <div className="bg-muted/20 flex-1 overflow-auto rounded-lg border p-3">
                                                            <pre className="font-mono text-xs whitespace-pre-wrap">
                                                                {selectedRun.inputText}
                                                            </pre>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <h3 className="mb-2 text-sm font-semibold">
                                                            Agent Response
                                                        </h3>
                                                        <div className="bg-muted/20 flex-1 overflow-auto rounded-lg border p-3">
                                                            <pre className="font-mono text-xs whitespace-pre-wrap">
                                                                {selectedRun.outputText ||
                                                                    runDetail?.outputText ||
                                                                    "No output"}
                                                            </pre>
                                                        </div>
                                                    </div>
                                                </div>

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

                                                <div>
                                                    <h3 className="text-muted-foreground mb-2 text-xs font-medium uppercase">
                                                        Token Breakdown
                                                    </h3>
                                                    <div className="flex flex-wrap gap-4 text-sm">
                                                        <span>
                                                            Prompt:{" "}
                                                            <strong>
                                                                {formatTokens(
                                                                    runDetail?.promptTokens ??
                                                                        selectedRun.promptTokens
                                                                )}
                                                            </strong>
                                                        </span>
                                                        <span>
                                                            Completion:{" "}
                                                            <strong>
                                                                {formatTokens(
                                                                    runDetail?.completionTokens ??
                                                                        selectedRun.completionTokens
                                                                )}
                                                            </strong>
                                                        </span>
                                                        <span>
                                                            Total:{" "}
                                                            <strong>
                                                                {formatTokens(
                                                                    runDetail?.totalTokens ??
                                                                        selectedRun.totalTokens
                                                                )}
                                                            </strong>
                                                        </span>
                                                    </div>
                                                </div>

                                                <div>
                                                    <h3 className="text-muted-foreground mb-2 text-xs font-medium uppercase">
                                                        System Context
                                                    </h3>
                                                    {runDetail?.version ? (
                                                        <div className="bg-muted/20 rounded-lg border p-3">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <Badge variant="outline">
                                                                    v{runDetail.version.version}
                                                                </Badge>
                                                                <Badge variant="outline">
                                                                    {formatModelLabel(
                                                                        runDetail.version.modelName,
                                                                        runDetail.version
                                                                            .modelProvider
                                                                    )}
                                                                </Badge>
                                                            </div>
                                                            <pre className="bg-background mt-3 max-h-48 overflow-auto rounded border p-3 text-xs whitespace-pre-wrap">
                                                                {runDetail.version.instructions}
                                                            </pre>
                                                            {Array.isArray(
                                                                runDetail.version.snapshot?.tools
                                                            ) && (
                                                                <div className="mt-3 flex flex-wrap gap-2">
                                                                    {(
                                                                        runDetail.version.snapshot
                                                                            ?.tools as Array<
                                                                            | string
                                                                            | {
                                                                                  toolId?: string;
                                                                              }
                                                                        >
                                                                    ).map((tool, idx) => {
                                                                        const label =
                                                                            typeof tool === "string"
                                                                                ? tool
                                                                                : tool.toolId ||
                                                                                  "unknown";
                                                                        return (
                                                                            <Badge
                                                                                key={`${label}-${idx}`}
                                                                                variant="outline"
                                                                            >
                                                                                {label}
                                                                            </Badge>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <p className="text-muted-foreground text-sm">
                                                            No version snapshot available for this
                                                            run.
                                                        </p>
                                                    )}
                                                </div>

                                                {evaluationScores && (
                                                    <div>
                                                        <h3 className="text-muted-foreground mb-2 text-xs font-medium uppercase">
                                                            Evaluation Scores
                                                        </h3>
                                                        <div className="grid gap-3 md:grid-cols-2">
                                                            {Object.entries(evaluationScores).map(
                                                                ([key, value]) => {
                                                                    const score =
                                                                        typeof value === "number"
                                                                            ? value
                                                                            : typeof value ===
                                                                                    "object" &&
                                                                                value &&
                                                                                "score" in value
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
                                                                            className="bg-muted/20 rounded-lg border p-3"
                                                                        >
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="text-sm font-medium">
                                                                                    {key}
                                                                                </span>
                                                                                <span className="text-sm font-semibold">
                                                                                    {(
                                                                                        score * 100
                                                                                    ).toFixed(0)}
                                                                                    %
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {feedbackList.length > 0 && (
                                                    <div>
                                                        <Separator className="my-4" />
                                                        <h3 className="mb-2 text-sm font-semibold">
                                                            User Feedback
                                                        </h3>
                                                        <div className="space-y-3">
                                                            {feedbackList.map((fb) => (
                                                                <div
                                                                    key={fb.id}
                                                                    className="bg-muted/20 rounded-lg border p-3 text-sm"
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        {fb.rating !== null && (
                                                                            <span>
                                                                                Rating: {fb.rating}
                                                                            </span>
                                                                        )}
                                                                        {fb.thumbs !== null && (
                                                                            <span>
                                                                                {fb.thumbs
                                                                                    ? "Thumbs up"
                                                                                    : "Thumbs down"}
                                                                            </span>
                                                                        )}
                                                                        <span className="text-muted-foreground text-xs">
                                                                            {new Date(
                                                                                fb.createdAt
                                                                            ).toLocaleString()}
                                                                        </span>
                                                                    </div>
                                                                    {fb.comment && (
                                                                        <p className="mt-2">
                                                                            {fb.comment}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </TabsContent>

                                            <TabsContent value="trace" className="mt-0 space-y-4">
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
                                                                        className="bg-muted/30 rounded-lg border p-4"
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
                                                                        <pre className="bg-background max-h-48 overflow-auto rounded border p-3 text-xs whitespace-pre-wrap">
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
                                                                        const s = step as Record<
                                                                            string,
                                                                            unknown
                                                                        >;
                                                                        return (
                                                                            <div
                                                                                key={idx}
                                                                                className="bg-muted/30 rounded-lg border p-4"
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
                                                                                                    "step"
                                                                                            )}
                                                                                        </Badge>
                                                                                    </div>
                                                                                    <span className="text-muted-foreground text-sm">
                                                                                        {typeof s.durationMs ===
                                                                                        "number"
                                                                                            ? formatLatency(
                                                                                                  s.durationMs
                                                                                              )
                                                                                            : "-"}
                                                                                    </span>
                                                                                </div>
                                                                                <pre className="bg-background max-h-48 overflow-auto rounded border p-3 text-xs whitespace-pre-wrap">
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

                                                    return (
                                                        <div className="py-8 text-center">
                                                            <p className="text-muted-foreground text-sm">
                                                                No trace steps available for this
                                                                run.
                                                            </p>
                                                        </div>
                                                    );
                                                })()}
                                            </TabsContent>

                                            <TabsContent value="tools" className="mt-0 space-y-4">
                                                {runDetail?.trace?.toolCalls &&
                                                runDetail.trace.toolCalls.length > 0 ? (
                                                    <div className="space-y-4">
                                                        {runDetail.trace.toolCalls.map(
                                                            (toolCall, idx) => (
                                                                <div
                                                                    key={toolCall.id}
                                                                    className="bg-muted/30 rounded-lg border p-4"
                                                                >
                                                                    <div className="mb-3 flex items-center justify-between">
                                                                        <div className="flex items-center gap-3">
                                                                            <span className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-full text-sm font-medium">
                                                                                {idx + 1}
                                                                            </span>
                                                                            <div>
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="font-semibold">
                                                                                        {resolveToolLabel(
                                                                                            toolCall
                                                                                        )}
                                                                                    </span>
                                                                                    {toolCall.mcpServerId && (
                                                                                        <Badge
                                                                                            variant="outline"
                                                                                            className="text-xs"
                                                                                        >
                                                                                            {
                                                                                                toolCall.mcpServerId
                                                                                            }
                                                                                        </Badge>
                                                                                    )}
                                                                                </div>
                                                                                <div className="text-muted-foreground text-xs">
                                                                                    {toolCall.success ? (
                                                                                        <span className="text-green-600">
                                                                                            Success
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="text-red-600">
                                                                                            Failed
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-muted-foreground text-sm">
                                                                            {toolCall.durationMs
                                                                                ? formatLatency(
                                                                                      toolCall.durationMs
                                                                                  )
                                                                                : "-"}
                                                                        </div>
                                                                    </div>

                                                                    <div className="grid gap-4 md:grid-cols-2">
                                                                        <div>
                                                                            <h4 className="text-muted-foreground mb-2 text-xs font-medium uppercase">
                                                                                Input
                                                                            </h4>
                                                                            <pre className="bg-background max-h-32 overflow-auto rounded border p-3 text-xs">
                                                                                {JSON.stringify(
                                                                                    toolCall.inputJson,
                                                                                    null,
                                                                                    2
                                                                                )}
                                                                            </pre>
                                                                        </div>
                                                                        <div>
                                                                            <h4 className="text-muted-foreground mb-2 text-xs font-medium uppercase">
                                                                                Output
                                                                            </h4>
                                                                            {toolCall.success ? (
                                                                                <pre className="bg-background max-h-32 overflow-auto rounded border p-3 text-xs">
                                                                                    {JSON.stringify(
                                                                                        toolCall.outputJson,
                                                                                        null,
                                                                                        2
                                                                                    )}
                                                                                </pre>
                                                                            ) : (
                                                                                <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-900/30 dark:bg-red-900/10">
                                                                                    {toolCall.error ||
                                                                                        "Unknown error"}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="py-8 text-center">
                                                        <p className="text-muted-foreground text-sm">
                                                            No tool calls for this run.
                                                        </p>
                                                    </div>
                                                )}
                                            </TabsContent>

                                            <TabsContent value="errors" className="mt-0 space-y-4">
                                                {selectedRun.status === "FAILED" && (
                                                    <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10">
                                                        <p className="font-semibold">Run failed</p>
                                                        <p className="mt-2">
                                                            {runDetail?.outputText ||
                                                                selectedRun.outputText ||
                                                                "No error output captured."}
                                                        </p>
                                                    </div>
                                                )}

                                                {toolErrors.length > 0 && (
                                                    <div>
                                                        <h3 className="text-sm font-semibold">
                                                            Tool Errors
                                                        </h3>
                                                        <div className="mt-2 space-y-3">
                                                            {toolErrors.map((toolCall) => (
                                                                <div
                                                                    key={toolCall.id}
                                                                    className="bg-muted/20 rounded-lg border p-3 text-sm"
                                                                >
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="font-medium">
                                                                            {resolveToolLabel(
                                                                                toolCall
                                                                            )}
                                                                        </span>
                                                                        <span className="text-muted-foreground text-xs">
                                                                            {toolCall.durationMs
                                                                                ? formatLatency(
                                                                                      toolCall.durationMs
                                                                                  )
                                                                                : "-"}
                                                                        </span>
                                                                    </div>
                                                                    <p className="mt-2 text-xs text-red-600">
                                                                        {toolCall.error ||
                                                                            "Unknown error"}
                                                                    </p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {guardrailEvents.length > 0 && (
                                                    <div>
                                                        <h3 className="text-sm font-semibold">
                                                            Guardrail Events
                                                        </h3>
                                                        <div className="mt-2 space-y-3">
                                                            {guardrailEvents.map((event) => (
                                                                <div
                                                                    key={event.id}
                                                                    className="bg-muted/20 rounded-lg border p-3 text-sm"
                                                                >
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="font-medium">
                                                                            {event.guardrailKey}
                                                                        </span>
                                                                        <Badge variant="outline">
                                                                            {event.type}
                                                                        </Badge>
                                                                    </div>
                                                                    <p className="text-muted-foreground mt-2 text-xs">
                                                                        {event.reason}
                                                                    </p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {toolErrors.length === 0 &&
                                                    guardrailEvents.length === 0 &&
                                                    selectedRun.status !== "FAILED" && (
                                                        <p className="text-muted-foreground text-sm">
                                                            No errors, retries, or guardrail events
                                                            recorded for this run.
                                                        </p>
                                                    )}
                                            </TabsContent>

                                            <TabsContent value="latency" className="mt-0 space-y-4">
                                                {(() => {
                                                    const steps = runDetail?.trace?.steps ?? [];
                                                    const stepsJson = runDetail?.trace
                                                        ?.stepsJson as unknown[] | null;
                                                    const rawSteps =
                                                        steps.length > 0
                                                            ? steps
                                                            : Array.isArray(stepsJson)
                                                              ? stepsJson
                                                              : [];

                                                    if (rawSteps.length === 0) {
                                                        return (
                                                            <p className="text-muted-foreground text-sm">
                                                                No latency data available for this
                                                                run.
                                                            </p>
                                                        );
                                                    }

                                                    const normalizedSteps = rawSteps.map(
                                                        (step, idx) => {
                                                            if (typeof step === "object" && step) {
                                                                const s = step as Record<
                                                                    string,
                                                                    unknown
                                                                >;
                                                                return {
                                                                    number: Number(
                                                                        s.stepNumber ??
                                                                            s.step ??
                                                                            idx + 1
                                                                    ),
                                                                    type: String(s.type || "step"),
                                                                    durationMs:
                                                                        typeof s.durationMs ===
                                                                        "number"
                                                                            ? s.durationMs
                                                                            : null,
                                                                    content: s.content ?? s
                                                                };
                                                            }
                                                            return {
                                                                number: idx + 1,
                                                                type: "step",
                                                                durationMs: null,
                                                                content: step
                                                            };
                                                        }
                                                    );

                                                    return (
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead>#</TableHead>
                                                                    <TableHead>Type</TableHead>
                                                                    <TableHead className="text-right">
                                                                        Duration
                                                                    </TableHead>
                                                                    <TableHead>Details</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {normalizedSteps.map((step) => (
                                                                    <TableRow
                                                                        key={`${step.type}-${step.number}`}
                                                                    >
                                                                        <TableCell>
                                                                            {step.number}
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            {step.type}
                                                                        </TableCell>
                                                                        <TableCell className="text-right">
                                                                            {step.durationMs
                                                                                ? formatLatency(
                                                                                      step.durationMs
                                                                                  )
                                                                                : "-"}
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <pre className="bg-muted/20 max-h-24 overflow-auto rounded border p-2 text-xs whitespace-pre-wrap">
                                                                                {typeof step.content ===
                                                                                "string"
                                                                                    ? step.content
                                                                                    : JSON.stringify(
                                                                                          step.content,
                                                                                          null,
                                                                                          2
                                                                                      )}
                                                                            </pre>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    );
                                                })()}
                                            </TabsContent>
                                        </>
                                    )}
                                </div>
                            </Tabs>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Slowest Runs</CardTitle>
                        <CardDescription>Highest latency in current window</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {(metrics?.topRuns.slowest || []).length === 0 ? (
                            <p className="text-muted-foreground text-sm">No slow runs recorded.</p>
                        ) : (
                            metrics?.topRuns.slowest.map((run) => (
                                <div
                                    key={run.id}
                                    className="flex items-start justify-between gap-3"
                                >
                                    <div>
                                        <button
                                            className="text-left text-sm font-medium hover:underline"
                                            onClick={() => handleRunSelectById(run.id)}
                                        >
                                            {run.agentName}
                                        </button>
                                        <p className="text-muted-foreground text-xs">{run.id}</p>
                                    </div>
                                    <div className="text-right text-sm">
                                        <p className="font-semibold">
                                            {run.durationMs ? formatLatency(run.durationMs) : "-"}
                                        </p>
                                        <p className="text-muted-foreground text-xs">
                                            {formatModelLabel(run.modelName, run.modelProvider)}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Most Expensive</CardTitle>
                        <CardDescription>Highest cost runs in window</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {(metrics?.topRuns.mostExpensive || []).length === 0 ? (
                            <p className="text-muted-foreground text-sm">
                                No expensive runs recorded.
                            </p>
                        ) : (
                            metrics?.topRuns.mostExpensive.map((run) => (
                                <div
                                    key={run.id}
                                    className="flex items-start justify-between gap-3"
                                >
                                    <div>
                                        <button
                                            className="text-left text-sm font-medium hover:underline"
                                            onClick={() => handleRunSelectById(run.id)}
                                        >
                                            {run.agentName}
                                        </button>
                                        <p className="text-muted-foreground text-xs">{run.id}</p>
                                    </div>
                                    <div className="text-right text-sm">
                                        <p className="font-semibold">{formatCost(run.costUsd)}</p>
                                        <p className="text-muted-foreground text-xs">
                                            {formatTokens(run.totalTokens)}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Model Usage</CardTitle>
                        <CardDescription>Runs by model in window</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {modelUsageSorted.length === 0 ? (
                            <p className="text-muted-foreground text-sm">
                                No model usage data available.
                            </p>
                        ) : (
                            modelUsageSorted.slice(0, 6).map((model) => (
                                <div
                                    key={`${model.modelProvider}-${model.modelName}`}
                                    className="flex items-center justify-between text-sm"
                                >
                                    <span className="font-medium">
                                        {formatModelLabel(model.modelName, model.modelProvider)}
                                    </span>
                                    <span className="text-muted-foreground">{model.runs}</span>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Agent Performance</CardTitle>
                        <CardDescription>Avg latency, tools, and failures</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {perAgentSorted.length === 0 ? (
                            <p className="text-muted-foreground text-sm">
                                No agent performance data available.
                            </p>
                        ) : (
                            <div className="overflow-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Agent</TableHead>
                                            <TableHead className="text-right">Runs</TableHead>
                                            <TableHead className="text-right">Success</TableHead>
                                            <TableHead className="text-right">
                                                Avg Latency
                                            </TableHead>
                                            <TableHead className="text-right">Avg Tools</TableHead>
                                            <TableHead className="text-right">Avg Cost</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {perAgentSorted.map((agent) => (
                                            <TableRow
                                                key={agent.agentId}
                                                className="cursor-pointer"
                                                onClick={() => handleAgentClick(agent.agentSlug)}
                                            >
                                                <TableCell className="font-medium">
                                                    {agent.agentName}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {agent.totalRuns}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {agent.successRate}%
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {formatLatency(agent.avgLatencyMs)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {agent.avgToolCalls.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {formatCost(agent.avgCostUsd)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Version Comparison</CardTitle>
                        <CardDescription>Success rate by agent version</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {perVersionSorted.length === 0 ? (
                            <p className="text-muted-foreground text-sm">
                                No version metrics available.
                            </p>
                        ) : (
                            <div className="overflow-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Version</TableHead>
                                            <TableHead>Agent</TableHead>
                                            <TableHead className="text-right">Runs</TableHead>
                                            <TableHead className="text-right">Success</TableHead>
                                            <TableHead className="text-right">
                                                Avg Latency
                                            </TableHead>
                                            <TableHead className="text-right">Avg Cost</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {perVersionSorted.map((version) => (
                                            <TableRow key={version.versionId || "unknown"}>
                                                <TableCell>
                                                    {version.versionNumber
                                                        ? `v${version.versionNumber}`
                                                        : "-"}
                                                </TableCell>
                                                <TableCell>
                                                    {version.agentId
                                                        ? agentNameById.get(version.agentId) ||
                                                          "Unknown"
                                                        : "Unknown"}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {version.totalRuns}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {version.successRate}%
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {formatLatency(version.avgLatencyMs)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {formatCost(version.avgCostUsd)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
