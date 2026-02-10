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
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    icons
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";
import RunDetailPanel from "@/components/RunDetailPanel";
import type { RunDetail } from "@/components/run-detail-utils";
import {
    formatLatency as sharedFormatLatency,
    formatRelativeTime as sharedFormatRelativeTime,
    formatCost as sharedFormatCost,
    formatTokens as sharedFormatTokens,
    formatModelLabel as sharedFormatModelLabel,
    getStatusBadgeVariant as sharedGetStatusBadgeVariant,
    getSourceBadgeColor as sharedGetSourceBadgeColor,
    getDateRange as sharedGetDateRange
} from "@/components/run-detail-utils";

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

// Interfaces re-exported from shared module (imported at top of file)
// TraceStep, ToolCall, Trace, Evaluation, Feedback, CostEvent, GuardrailEvent, VersionInfo, RunDetail

const formatLatency = (ms: number) => sharedFormatLatency(ms);
const formatRelativeTime = sharedFormatRelativeTime;
const getDateRange = sharedGetDateRange;
const formatCost = sharedFormatCost;
const formatTokens = sharedFormatTokens;
const formatModelLabel = sharedFormatModelLabel;
const getStatusBadgeVariant = sharedGetStatusBadgeVariant;
const getSourceBadgeColor = sharedGetSourceBadgeColor;

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
        router.push(`/agents/${agentSlug}/overview`);
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
            <div className="h-full overflow-y-auto">
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
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto">
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
                        <Button variant="outline" size="sm" onClick={() => router.push("/agents")}>
                            <HugeiconsIcon icon={icons["arrow-right"]!} className="mr-2 size-4" />
                            Agents
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
                                                {formatModelLabel(
                                                    model.modelName,
                                                    model.modelProvider
                                                )}
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
                            <p className="text-muted-foreground text-xs">
                                Loading filter options...
                            </p>
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
                                                <TableHead className="text-right">
                                                    Duration
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    Tool Calls
                                                </TableHead>
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
                                                        const isSelected =
                                                            selectedRun?.id === run.id;
                                                        const isSlow = slowRunIds.has(run.id);
                                                        const isExpensive = expensiveRunIds.has(
                                                            run.id
                                                        );
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
                                                                        ? formatLatency(
                                                                              run.durationMs
                                                                          )
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
                                                `/agents/${selectedRun.agentSlug}/runs?runId=${selectedRun.id}`
                                            )
                                        }
                                    >
                                        Open in Agents
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
                                        <Badge variant="outline">
                                            v{selectedRun.versionNumber}
                                        </Badge>
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
                                        Select a run to view its trace, tools, and latency
                                        breakdown.
                                    </p>
                                </div>
                            ) : (
                                <RunDetailPanel
                                    runDetail={runDetail}
                                    loading={runDetailLoading}
                                    inputText={selectedRun.inputText}
                                    outputText={selectedRun.outputText}
                                    status={selectedRun.status}
                                    promptTokens={selectedRun.promptTokens}
                                    completionTokens={selectedRun.completionTokens}
                                    totalTokens={selectedRun.totalTokens}
                                    sessionId={selectedRun.sessionId}
                                    threadId={selectedRun.threadId}
                                />
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
                                <p className="text-muted-foreground text-sm">
                                    No slow runs recorded.
                                </p>
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
                                            <p className="text-muted-foreground text-xs">
                                                {run.id}
                                            </p>
                                        </div>
                                        <div className="text-right text-sm">
                                            <p className="font-semibold">
                                                {run.durationMs
                                                    ? formatLatency(run.durationMs)
                                                    : "-"}
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
                                            <p className="text-muted-foreground text-xs">
                                                {run.id}
                                            </p>
                                        </div>
                                        <div className="text-right text-sm">
                                            <p className="font-semibold">
                                                {formatCost(run.costUsd)}
                                            </p>
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
                                                <TableHead className="text-right">
                                                    Success
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    Avg Latency
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    Avg Tools
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    Avg Cost
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {perAgentSorted.map((agent) => (
                                                <TableRow
                                                    key={agent.agentId}
                                                    className="cursor-pointer"
                                                    onClick={() =>
                                                        handleAgentClick(agent.agentSlug)
                                                    }
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
                                                <TableHead className="text-right">
                                                    Success
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    Avg Latency
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    Avg Cost
                                                </TableHead>
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
        </div>
    );
}
