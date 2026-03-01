"use client";

import React, { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from "recharts";
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
    workflows: Array<{ id: string; slug: string; name: string }>;
    networks: Array<{ id: string; slug: string; name: string }>;
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
    kinds: Array<{ kind: string; label: string }>;
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
    workflowSummary?: {
        totalRuns: number;
        completedRuns: number;
        failedRuns: number;
        runningRuns: number;
        queuedRuns: number;
        successRate: number;
        avgLatencyMs: number;
        totalTokens: number;
        totalCostUsd: number;
    };
    networkSummary?: {
        totalRuns: number;
        completedRuns: number;
        failedRuns: number;
        runningRuns: number;
        queuedRuns: number;
        successRate: number;
        avgLatencyMs: number;
        totalTokens: number;
        totalCostUsd: number;
    };
    grandTotal?: {
        allRuns: number;
        allCompleted: number;
        allFailed: number;
        allRunning: number;
    };
    dateRange: {
        from: string | null;
        to: string | null;
    };
}

interface Run {
    id: string;
    kind: "agent" | "workflow" | "network";
    name: string;
    slug: string;
    agentId?: string | null;
    agentSlug?: string;
    agentName?: string;
    runType?: string | null;
    status: string;
    source: string | null;
    sessionId?: string | null;
    threadId?: string | null;
    inputText: string;
    outputText?: string | null;
    durationMs: number | null;
    startedAt: string;
    completedAt?: string | null;
    modelProvider?: string | null;
    modelName?: string | null;
    promptTokens?: number | null;
    completionTokens?: number | null;
    totalTokens?: number | null;
    costUsd?: number | null;
    toolCallCount?: number | null;
    uniqueToolCount?: number;
    stepCount?: number;
    stepsCount?: number | null;
    versionId?: string | null;
    versionNumber?: number | null;
    failureReason?: string | null;
    triggerType?: string;
    suspendedStep?: string | null;
    environment?: string | null;
}

interface RunCounts {
    total: number;
    byKind?: {
        agent: number;
        workflow: number;
        network: number;
    };
    queued?: number;
    running?: number;
    completed?: number;
    failed?: number;
    cancelled?: number;
}

interface BudgetAlert {
    agentId: string;
    agentSlug: string;
    agentName: string;
    currentSpendUsd: number;
    monthlyLimitUsd: number;
    percentUsed: number;
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

export function LiveRunsContent() {
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
    const [kindFilter, setKindFilter] = useState("all");
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

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(50);
    const [totalFilteredCount, setTotalFilteredCount] = useState(0);
    const [hasMore, setHasMore] = useState(false);

    const [budgetAlerts, setBudgetAlerts] = useState<BudgetAlert[]>([]);
    const [budgetBannerDismissed, setBudgetBannerDismissed] = useState(false);
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
            params.set("kind", kindFilter);
            params.set("runType", runTypeFilter);
            params.set("limit", String(pageSize));
            params.set("offset", String((currentPage - 1) * pageSize));
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
                if (data.budgetAlerts?.length > 0) {
                    setBudgetAlerts(data.budgetAlerts);
                }
                if (data.pagination) {
                    setHasMore(data.pagination.hasMore);
                }
                if (data.counts) {
                    setTotalFilteredCount(data.counts.total ?? 0);
                }
            }
        } catch (error) {
            console.error("Failed to fetch runs:", error);
        } finally {
            setRunsLoading(false);
        }
    }, [
        kindFilter,
        runTypeFilter,
        statusFilter,
        sourceFilter,
        agentFilter,
        versionFilter,
        modelFilter,
        toolUsageFilter,
        searchQuery,
        rangeFrom,
        rangeTo,
        currentPage,
        pageSize
    ]);

    const fetchRunDetail = useCallback(async (run: Run) => {
        setRunDetailLoading(true);
        setRunDetail(null);
        try {
            let url: string;
            if (run.kind === "workflow") {
                url = `${getApiBase()}/api/workflows/${run.slug}/runs/${run.id}`;
            } else if (run.kind === "network") {
                url = `${getApiBase()}/api/networks/${run.slug}/runs/${run.id}`;
            } else {
                url = `${getApiBase()}/api/agents/${run.agentSlug || run.slug}/runs/${run.id}`;
            }
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                if (run.kind === "workflow") {
                    const wfRun = data.run;
                    const inputStr =
                        typeof wfRun.inputJson === "object" && wfRun.inputJson
                            ? JSON.stringify(wfRun.inputJson, null, 2)
                            : wfRun.inputText || "";
                    const outputStr =
                        typeof wfRun.outputJson === "object" && wfRun.outputJson
                            ? JSON.stringify(wfRun.outputJson, null, 2)
                            : wfRun.outputText || null;
                    setRunDetail({
                        id: wfRun.id,
                        agentId: "",
                        runType: "workflow",
                        status: wfRun.status,
                        inputText: inputStr,
                        outputText: outputStr,
                        durationMs: wfRun.durationMs,
                        startedAt: wfRun.startedAt,
                        completedAt: wfRun.completedAt,
                        modelProvider: null,
                        modelName: null,
                        versionId: wfRun.versionId || null,
                        promptTokens: null,
                        completionTokens: null,
                        totalTokens: wfRun.totalTokens || null,
                        costUsd: wfRun.totalCostUsd || null,
                        trace: null,
                        evaluation: null,
                        feedback: wfRun.feedback || null,
                        costEvent: null,
                        guardrailEvents: null,
                        version: null,
                        workflowSteps: wfRun.steps || [],
                        workflowEvaluation: wfRun.evaluation || null,
                        workflow: data.workflow || null,
                        suspendedStep: wfRun.suspendedStep || null,
                        environment: wfRun.environment || null,
                        inputJson: wfRun.inputJson,
                        outputJson: wfRun.outputJson,
                    });
                } else if (run.kind === "network") {
                    const netRun = data.run;
                    setRunDetail({
                        id: netRun.id,
                        agentId: "",
                        runType: "network",
                        status: netRun.status,
                        inputText: netRun.inputText || "",
                        outputText: netRun.outputText || null,
                        durationMs: netRun.durationMs,
                        startedAt: netRun.startedAt,
                        completedAt: netRun.completedAt,
                        modelProvider: null,
                        modelName: null,
                        versionId: netRun.versionId || null,
                        promptTokens: null,
                        completionTokens: null,
                        totalTokens: netRun.totalTokens || null,
                        costUsd: netRun.totalCostUsd || null,
                        trace: null,
                        evaluation: null,
                        feedback: netRun.feedback || null,
                        costEvent: null,
                        guardrailEvents: null,
                        version: null,
                        networkSteps: netRun.steps || [],
                        networkEvaluation: netRun.evaluation || null,
                        network: data.network || null,
                        environment: netRun.environment || null,
                        outputJson: netRun.outputJson,
                    });
                } else {
                    setRunDetail(data.run);
                }
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

    const handleRunClick = (run: Run) => {
        setSelectedRun(run);
        fetchRunDetail(run);
    };

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
                    return ((a.toolCallCount || 0) - (b.toolCallCount || 0)) * dir;
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
                case "kind":
                    return (run.kind ?? "agent").charAt(0).toUpperCase() + (run.kind ?? "agent").slice(1);
                case "agent":
                    return run.name || run.agentName || "Unknown";
                case "version":
                    return run.versionNumber ? `v${run.versionNumber}` : "Unknown Version";
                case "model":
                    return run.modelName ?? "Unknown Model";
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
    useEffect(() => {
        setCurrentPage(1);
    }, [
        statusFilter,
        sourceFilter,
        agentFilter,
        versionFilter,
        modelFilter,
        toolUsageFilter,
        runTypeFilter,
        searchQuery,
        timeRange
    ]);

    const totalPages = Math.max(1, Math.ceil(totalFilteredCount / pageSize));

    const hasActiveFilters =
        searchQuery.length > 0 ||
        kindFilter !== "all" ||
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
                    <Skeleton className="h-[500px] w-full" />
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

                {budgetAlerts.length > 0 && !budgetBannerDismissed && (
                    <div className="relative rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                        <button
                            onClick={() => setBudgetBannerDismissed(true)}
                            className="text-muted-foreground hover:text-foreground absolute top-3 right-3 text-sm"
                            aria-label="Dismiss"
                        >
                            <HugeiconsIcon icon={icons.cancel!} className="size-4" />
                        </button>
                        <div className="flex items-start gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
                                <HugeiconsIcon
                                    icon={icons["alert-diamond"]!}
                                    className="size-5 text-amber-500"
                                />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                                    Budget Exceeded &mdash;{" "}
                                    {budgetAlerts.length === 1
                                        ? `${budgetAlerts[0]!.agentName} is paused`
                                        : `${budgetAlerts.length} agents paused`}
                                </h3>
                                <p className="text-muted-foreground mt-0.5 text-xs">
                                    {budgetAlerts.length === 1
                                        ? `${budgetAlerts[0]!.agentName} has spent $${budgetAlerts[0]!.currentSpendUsd.toFixed(2)} of its $${budgetAlerts[0]!.monthlyLimitUsd} monthly limit. All new runs will fail until the budget is increased.`
                                        : "The following agents have exceeded their monthly budget limits. New runs will fail until budgets are increased."}
                                </p>
                                {budgetAlerts.length > 1 && (
                                    <div className="mt-2 space-y-1">
                                        {budgetAlerts.map((alert) => (
                                            <div
                                                key={alert.agentId}
                                                className="flex items-center gap-2 text-xs"
                                            >
                                                <span className="font-medium">
                                                    {alert.agentName}
                                                </span>
                                                <span className="text-muted-foreground">
                                                    ${alert.currentSpendUsd.toFixed(2)} / $
                                                    {alert.monthlyLimitUsd}
                                                </span>
                                                <a
                                                    href={`/agents/${alert.agentSlug}/costs`}
                                                    className="text-primary hover:underline"
                                                >
                                                    Manage
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {budgetAlerts.length === 1 && (
                                        <a
                                            href={`/agents/${budgetAlerts[0]!.agentSlug}/costs`}
                                            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
                                        >
                                            Increase Budget
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {runCounts?.byKind && (
                    <div className="grid grid-cols-3 gap-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription className="flex items-center gap-1.5">
                                    <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                                    Agent Runs
                                </CardDescription>
                                <CardTitle className="text-xl">
                                    {runCounts.byKind.agent.toLocaleString()}
                                </CardTitle>
                            </CardHeader>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription className="flex items-center gap-1.5">
                                    <span className="inline-block h-2 w-2 rounded-full bg-purple-500" />
                                    Workflow Runs
                                </CardDescription>
                                <CardTitle className="text-xl">
                                    {runCounts.byKind.workflow.toLocaleString()}
                                </CardTitle>
                            </CardHeader>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription className="flex items-center gap-1.5">
                                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                                    Network Runs
                                </CardDescription>
                                <CardTitle className="text-xl">
                                    {runCounts.byKind.network.toLocaleString()}
                                </CardTitle>
                            </CardHeader>
                        </Card>
                    </div>
                )}

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
                                className="min-w-0 flex-1 sm:min-w-[240px]"
                            />
                            <Select
                                value={kindFilter}
                                onValueChange={(value) => {
                                    setKindFilter(value ?? "all");
                                    if (value !== "all" && value !== "agent") {
                                        setAgentFilter("all");
                                    }
                                }}
                            >
                                <SelectTrigger className="w-40">
                                    <SelectValue placeholder="Kind" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Kinds</SelectItem>
                                    <SelectItem value="agent">Agent</SelectItem>
                                    <SelectItem value="workflow">Workflow</SelectItem>
                                    <SelectItem value="network">Network</SelectItem>
                                </SelectContent>
                            </Select>
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
                                    <SelectItem value="kind">Kind</SelectItem>
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
                                        setKindFilter("all");
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
                                        setCurrentPage(1);
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
                            Completed {(runCounts.completed ?? 0).toLocaleString()}
                        </Badge>
                        <Badge
                            variant={statusFilter === "failed" ? "destructive" : "outline"}
                            className="cursor-pointer"
                            onClick={() => setStatusFilter("failed")}
                        >
                            Failed {(runCounts.failed ?? 0).toLocaleString()}
                        </Badge>
                        <Badge
                            variant={statusFilter === "running" ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => setStatusFilter("running")}
                        >
                            Running {(runCounts.running ?? 0).toLocaleString()}
                        </Badge>
                        <Badge
                            variant={statusFilter === "queued" ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => setStatusFilter("queued")}
                        >
                            Queued {(runCounts.queued ?? 0).toLocaleString()}
                        </Badge>
                        <Badge
                            variant={statusFilter === "cancelled" ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => setStatusFilter("cancelled")}
                        >
                            Cancelled {(runCounts.cancelled ?? 0).toLocaleString()}
                        </Badge>
                    </div>
                )}

                <Card>
                    <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <CardTitle>Runs</CardTitle>
                                <CardDescription>
                                    Showing {((currentPage - 1) * pageSize + 1).toLocaleString()}
                                    &ndash;
                                    {Math.min(
                                        currentPage * pageSize,
                                        totalFilteredCount
                                    ).toLocaleString()}{" "}
                                    of {totalFilteredCount.toLocaleString()} matching runs
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
                            <>
                                <div className="overflow-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Kind</TableHead>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Source</TableHead>
                                                <TableHead>Input</TableHead>
                                                <TableHead className="text-right">
                                                    Duration
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    Steps
                                                </TableHead>
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
                                                                colSpan={10}
                                                                className="text-muted-foreground bg-muted/30 text-xs font-semibold uppercase"
                                                            >
                                                                {group.label} ({group.runs.length})
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                    {group.runs.map((run) => {
                                                        const isSelected =
                                                            selectedRun?.id === run.id;
                                                        return (
                                                            <TableRow
                                                                key={run.id}
                                                                className={`cursor-pointer ${
                                                                    isSelected ? "bg-muted/50" : ""
                                                                }`}
                                                                onClick={() => handleRunClick(run)}
                                                            >
                                                                <TableCell>
                                                                    <Badge
                                                                        variant="outline"
                                                                        className={
                                                                            run.kind === "agent"
                                                                                ? "border-blue-500/30 text-blue-600 dark:text-blue-400"
                                                                                : run.kind ===
                                                                                    "workflow"
                                                                                  ? "border-purple-500/30 text-purple-600 dark:text-purple-400"
                                                                                  : "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                                                                        }
                                                                    >
                                                                        {run.kind}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div>
                                                                        <p className="font-medium">
                                                                            {run.name ||
                                                                                run.agentName}
                                                                        </p>
                                                                        <p className="text-muted-foreground text-xs">
                                                                            {run.id.slice(0, 12)}...
                                                                        </p>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <Badge
                                                                            variant={getStatusBadgeVariant(
                                                                                run.status
                                                                            )}
                                                                        >
                                                                            {run.status}
                                                                        </Badge>
                                                                        {run.failureReason ===
                                                                            "BUDGET_EXCEEDED" && (
                                                                            <Badge
                                                                                variant="outline"
                                                                                className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                                                            >
                                                                                Budget
                                                                            </Badge>
                                                                        )}
                                                                    </div>
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
                                                                    {run.stepsCount ??
                                                                        run.stepCount ??
                                                                        run.toolCallCount ??
                                                                        0}
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

                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between border-t pt-4">
                                        <p className="text-muted-foreground text-sm">
                                            Page {currentPage} of {totalPages.toLocaleString()}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={currentPage <= 1}
                                                onClick={() =>
                                                    setCurrentPage((p) => Math.max(1, p - 1))
                                                }
                                            >
                                                <HugeiconsIcon
                                                    icon={icons["arrow-left"]!}
                                                    className="mr-1 size-4"
                                                />
                                                Previous
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={!hasMore}
                                                onClick={() =>
                                                    setCurrentPage((p) =>
                                                        Math.min(totalPages, p + 1)
                                                    )
                                                }
                                            >
                                                Next
                                                <HugeiconsIcon
                                                    icon={icons["arrow-right"]!}
                                                    className="ml-1 size-4"
                                                />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>

                {selectedRun &&
                    createPortal(
                        <>
                            <div
                                className="fixed inset-0 z-[60] bg-black/60"
                                onClick={() => setSelectedRun(null)}
                            />
                            <div className="bg-background fixed inset-x-0 bottom-0 z-[70] h-[95vh] shadow-2xl transition-transform duration-300">
                                <div className="mx-6 flex h-full flex-col rounded-t-2xl border-x border-t">
                                    <div className="flex shrink-0 flex-col gap-4 border-b px-6 py-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <Badge
                                                        variant="outline"
                                                        className={
                                                            selectedRun.kind === "agent"
                                                                ? "border-blue-500/30 text-blue-600 dark:text-blue-400"
                                                                : selectedRun.kind ===
                                                                    "workflow"
                                                                  ? "border-purple-500/30 text-purple-600 dark:text-purple-400"
                                                                  : "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                                                        }
                                                    >
                                                        {selectedRun.kind}
                                                    </Badge>
                                                    <h2 className="text-xl font-semibold">
                                                        {selectedRun.name ||
                                                            selectedRun.agentName}
                                                    </h2>
                                                </div>
                                                <p className="text-muted-foreground truncate font-mono text-xs">
                                                    {selectedRun.id}
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-2">
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
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setSelectedRun(null)}
                                                >
                                                    <HugeiconsIcon
                                                        icon={icons.cancel!}
                                                        className="size-4"
                                                    />
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge
                                                variant={getStatusBadgeVariant(selectedRun.status)}
                                            >
                                                {selectedRun.status}
                                            </Badge>
                                            {selectedRun.source && (
                                                <Badge
                                                    className={getSourceBadgeColor(
                                                        selectedRun.source
                                                    )}
                                                >
                                                    {selectedRun.source}
                                                </Badge>
                                            )}
                                            {selectedRun.versionNumber && (
                                                <Badge variant="outline">
                                                    v{selectedRun.versionNumber}
                                                </Badge>
                                            )}
                                            {selectedRun.runType && (
                                                <Badge variant="outline">
                                                    {selectedRun.runType}
                                                </Badge>
                                            )}
                                            {(selectedRun.modelName ||
                                                selectedRun.modelProvider) && (
                                                <Badge variant="outline">
                                                    {formatModelLabel(
                                                        selectedRun.modelName ?? null,
                                                        selectedRun.modelProvider ?? null
                                                    )}
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-4 gap-3">
                                            <div className="bg-muted/50 rounded-lg p-3">
                                                <p className="text-muted-foreground text-xs">
                                                    Duration
                                                </p>
                                                <p className="text-base font-semibold">
                                                    {selectedRun.durationMs
                                                        ? formatLatency(selectedRun.durationMs)
                                                        : "-"}
                                                </p>
                                            </div>
                                            <div className="bg-muted/50 rounded-lg p-3">
                                                <p className="text-muted-foreground text-xs">
                                                    Tokens
                                                </p>
                                                <p className="text-base font-semibold">
                                                    {formatTokens(selectedRun.totalTokens)}
                                                </p>
                                            </div>
                                            <div className="bg-muted/50 rounded-lg p-3">
                                                <p className="text-muted-foreground text-xs">
                                                    Cost
                                                </p>
                                                <p className="text-base font-semibold">
                                                    {formatCost(selectedRun.costUsd)}
                                                </p>
                                            </div>
                                            <div className="bg-muted/50 rounded-lg p-3">
                                                <p className="text-muted-foreground text-xs">
                                                    Tool Calls
                                                </p>
                                                <p className="text-base font-semibold">
                                                    {selectedRun.toolCallCount}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
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
                                            agentSlug={
                                                selectedRun.agentSlug || selectedRun.slug
                                            }
                                            runId={selectedRun.id}
                                            kind={selectedRun.kind}
                                            primitiveName={selectedRun.name}
                                            onRefresh={() => fetchRunDetail(selectedRun)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </>,
                        document.body
                    )}
            </div>
        </div>
    );
}

interface TimeseriesBucket {
    time: string;
    runs: number;
    completed: number;
    failed: number;
    avgLatencyMs: number;
    totalTokens: number;
    totalCost: number;
}

interface AgentBreakdownRow {
    agentId: string;
    name: string;
    runs: number;
    cost: number;
    tokens: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label, isDark }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div
            className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 text-xs shadow-lg"
            style={{
                backgroundColor: isDark ? "#27272a" : "#ffffff",
                border: `1px solid ${isDark ? "#3f3f46" : "#e4e4e7"}`
            }}
        >
            <p style={{ color: isDark ? "#a1a1aa" : "#71717a" }} className="mb-1">
                {label}
            </p>
            {payload.map((p: { name: string; value: number; color: string }) => (
                <p key={p.name} style={{ color: p.color || (isDark ? "#e4e4e7" : "#18181b") }}>
                    {p.name}:{" "}
                    {typeof p.value === "number" && p.name.includes("Cost")
                        ? `$${p.value.toFixed(4)}`
                        : typeof p.value === "number"
                          ? p.value.toLocaleString()
                          : p.value}
                </p>
            ))}
        </div>
    );
}

function formatChartTime(iso: string, range: string): string {
    const d = new Date(iso);
    if (range === "1h" || range === "6h") {
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    if (range === "24h") {
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    if (range === "7d") {
        return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function ObservabilityDashboard() {
    const router = useRouter();
    const { resolvedTheme } = useTheme();
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState<LiveMetrics | null>(null);
    const [filters, setFilters] = useState<LiveFilters | null>(null);
    const [timeseries, setTimeseries] = useState<TimeseriesBucket[]>([]);
    const [agentBreakdown, setAgentBreakdown] = useState<AgentBreakdownRow[]>([]);
    const [timeRange, setTimeRange] = useState("30d");
    const [runTypeFilter, setRunTypeFilter] = useState("PROD");

    const { from: rangeFrom, to: rangeTo } = useMemo(() => {
        return getDateRange(timeRange);
    }, [timeRange]);

    const bucketCount = useMemo(() => {
        switch (timeRange) {
            case "1h":
                return 12;
            case "6h":
                return 18;
            case "24h":
                return 24;
            case "7d":
                return 7;
            case "30d":
                return 30;
            default:
                return 30;
        }
    }, [timeRange]);

    const fetchData = useCallback(async () => {
        const params = new URLSearchParams();
        params.set("runType", runTypeFilter);
        if (rangeFrom) params.set("from", rangeFrom.toISOString());
        if (rangeTo) params.set("to", rangeTo.toISOString());

        const tsParams = new URLSearchParams(params);
        tsParams.set("buckets", String(bucketCount));

        try {
            const [metricsRes, filtersRes, tsRes] = await Promise.all([
                fetch(`${getApiBase()}/api/live/metrics?${params.toString()}`),
                fetch(`${getApiBase()}/api/live/filters?${params.toString()}`),
                fetch(`${getApiBase()}/api/live/metrics/timeseries?${tsParams.toString()}`)
            ]);
            const metricsData = await metricsRes.json();
            const filtersData = await filtersRes.json();
            const tsData = await tsRes.json();
            if (metricsData.success) setMetrics(metricsData);
            if (filtersData.success) setFilters(filtersData.filters);
            if (tsData.success) {
                setTimeseries(tsData.timeseries || []);
                setAgentBreakdown(tsData.agentBreakdown || []);
            }
        } catch (error) {
            console.error("Failed to fetch dashboard data:", error);
        }
    }, [runTypeFilter, rangeFrom, rangeTo, bucketCount]);

    useEffect(() => {
        let cancelled = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data-fetching pattern; setState is called asynchronously after fetch completes
        fetchData().finally(() => {
            if (!cancelled) setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [fetchData]);

    const agentNameById = useMemo(() => {
        return new Map((filters?.agents || []).map((a) => [a.id, a.name]));
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

    const chartData = useMemo(() => {
        return timeseries.map((b) => ({
            ...b,
            label: formatChartTime(b.time, timeRange),
            successRate: b.runs > 0 ? Math.round((b.completed / b.runs) * 100) : 0
        }));
    }, [timeseries, timeRange]);

    const isDark = resolvedTheme === "dark";
    const tickStyle = { fontSize: 10, fill: isDark ? "#a1a1aa" : "#71717a" };
    const axisStroke = isDark ? "#3f3f46" : "#d4d4d8";
    const gridStroke = isDark ? "#27272a" : "#e4e4e7";
    const legendStyle: React.CSSProperties = {
        fontSize: 11,
        color: isDark ? "#d4d4d8" : "#3f3f46"
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-24" />
                    ))}
                </div>
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    const summary = metrics?.summary;

    return (
        <div className="space-y-6">
            {/* Controls */}
            <div className="flex items-center gap-3">
                <Select value={timeRange} onValueChange={(v) => v && setTimeRange(v)}>
                    <SelectTrigger className="w-[140px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1h">Last 1 hour</SelectItem>
                        <SelectItem value="6h">Last 6 hours</SelectItem>
                        <SelectItem value="24h">Last 24 hours</SelectItem>
                        <SelectItem value="7d">Last 7 days</SelectItem>
                        <SelectItem value="30d">Last 30 days</SelectItem>
                        <SelectItem value="all">All time</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={runTypeFilter} onValueChange={(v) => v && setRunTypeFilter(v)}>
                    <SelectTrigger className="w-[120px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="PROD">Prod</SelectItem>
                        <SelectItem value="DEV">Dev</SelectItem>
                        <SelectItem value="all">All</SelectItem>
                    </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => fetchData()}>
                    <HugeiconsIcon icon={icons.refresh!} className="mr-2 size-4" />
                    Refresh
                </Button>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Runs</CardDescription>
                        <CardTitle className="text-2xl">{summary?.totalRuns ?? 0}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Success Rate</CardDescription>
                        <CardTitle className="text-2xl">{summary?.successRate ?? 0}%</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Failed</CardDescription>
                        <CardTitle className="text-2xl text-red-500">
                            {summary?.failedRuns ?? 0}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Avg Latency</CardDescription>
                        <CardTitle className="text-2xl">
                            {formatLatency(summary?.avgLatencyMs ?? 0)}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Tokens</CardDescription>
                        <CardTitle className="text-2xl">
                            {formatTokens(summary?.totalTokens ?? 0)}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Cost</CardDescription>
                        <CardTitle className="text-2xl">
                            {formatCost(summary?.totalCostUsd ?? 0)}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Row 1: Run Volume + Success Rate */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Run Volume</CardTitle>
                        <CardDescription>Completed vs failed runs over time</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={240}>
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                                <XAxis dataKey="label" tick={tickStyle} stroke={axisStroke} />
                                <YAxis tick={tickStyle} stroke={axisStroke} allowDecimals={false} />
                                <Tooltip content={<ChartTooltip isDark={isDark} />} />
                                <Line
                                    type="monotone"
                                    dataKey="completed"
                                    name="Completed"
                                    stroke="#22c55e"
                                    strokeWidth={2}
                                    dot={false}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="failed"
                                    name="Failed"
                                    stroke="#ef4444"
                                    strokeWidth={2}
                                    dot={false}
                                />
                                <Legend iconType="circle" wrapperStyle={legendStyle} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Latency Trend</CardTitle>
                        <CardDescription>Average response time per bucket</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={240}>
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                                <XAxis dataKey="label" tick={tickStyle} stroke={axisStroke} />
                                <YAxis
                                    tick={tickStyle}
                                    stroke={axisStroke}
                                    tickFormatter={(v) => `${(v / 1000).toFixed(1)}s`}
                                />
                                <Tooltip content={<ChartTooltip isDark={isDark} />} />
                                <Line
                                    type="monotone"
                                    dataKey="avgLatencyMs"
                                    name="Avg Latency (ms)"
                                    stroke="#f59e0b"
                                    strokeWidth={2}
                                    dot={false}
                                />
                                <Legend iconType="circle" wrapperStyle={legendStyle} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Row 2: Cost + Tokens */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Cost per Period</CardTitle>
                        <CardDescription>Spend per time bucket</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={240}>
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                                <XAxis dataKey="label" tick={tickStyle} stroke={axisStroke} />
                                <YAxis
                                    tick={tickStyle}
                                    stroke={axisStroke}
                                    tickFormatter={(v) => `$${v.toFixed(2)}`}
                                />
                                <Tooltip content={<ChartTooltip isDark={isDark} />} />
                                <Line
                                    type="monotone"
                                    dataKey="totalCost"
                                    name="Cost"
                                    stroke="#8b5cf6"
                                    strokeWidth={2}
                                    dot={false}
                                />
                                <Legend iconType="circle" wrapperStyle={legendStyle} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Token Usage</CardTitle>
                        <CardDescription>Tokens consumed per time bucket</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                                <XAxis dataKey="label" tick={tickStyle} stroke={axisStroke} />
                                <YAxis
                                    tick={tickStyle}
                                    stroke={axisStroke}
                                    tickFormatter={(v) =>
                                        v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                                    }
                                />
                                <Tooltip content={<ChartTooltip isDark={isDark} />} />
                                <Bar
                                    dataKey="totalTokens"
                                    name="Tokens"
                                    fill="#3b82f6"
                                    radius={[4, 4, 0, 0]}
                                />
                                <Legend iconType="circle" wrapperStyle={legendStyle} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Row 3: Agent Breakdown + Model Usage + Slowest/Expensive */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Agent Breakdown</CardTitle>
                        <CardDescription>Runs and cost by agent</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {agentBreakdown.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No agent data.</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart data={agentBreakdown.slice(0, 8)} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                                    <XAxis
                                        type="number"
                                        tick={tickStyle}
                                        stroke={axisStroke}
                                        allowDecimals={false}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        tick={tickStyle}
                                        stroke={axisStroke}
                                        width={100}
                                    />
                                    <Tooltip content={<ChartTooltip isDark={isDark} />} />
                                    <Bar
                                        dataKey="runs"
                                        name="Runs"
                                        fill="#6366f1"
                                        radius={[0, 4, 4, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
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
                            <p className="text-muted-foreground text-sm">No model usage data.</p>
                        ) : (
                            modelUsageSorted.slice(0, 8).map((model) => {
                                const maxRuns = modelUsageSorted[0].runs;
                                const pct = maxRuns > 0 ? (model.runs / maxRuns) * 100 : 0;
                                return (
                                    <div
                                        key={`${model.modelProvider}-${model.modelName}`}
                                        className="space-y-1"
                                    >
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-medium">
                                                {formatModelLabel(
                                                    model.modelName,
                                                    model.modelProvider
                                                )}
                                            </span>
                                            <span className="text-muted-foreground">
                                                {model.runs}
                                            </span>
                                        </div>
                                        <div className="bg-muted h-2 overflow-hidden rounded-full">
                                            <div
                                                className="h-full rounded-full bg-blue-500"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Latency by Agent</CardTitle>
                        <CardDescription>Average response time per agent</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {perAgentSorted.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No agent data.</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart
                                    data={perAgentSorted.slice(0, 8).map((a) => ({
                                        name: a.agentName,
                                        avgLatencyMs: Math.round(a.avgLatencyMs)
                                    }))}
                                    layout="vertical"
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                                    <XAxis
                                        type="number"
                                        tick={tickStyle}
                                        stroke={axisStroke}
                                        tickFormatter={(v) =>
                                            v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v}ms`
                                        }
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        tick={tickStyle}
                                        stroke={axisStroke}
                                        width={100}
                                    />
                                    <Tooltip content={<ChartTooltip isDark={isDark} />} />
                                    <Bar
                                        dataKey="avgLatencyMs"
                                        name="Avg Latency (ms)"
                                        fill="#f59e0b"
                                        radius={[0, 4, 4, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Row 4: Agent Performance + Version Comparison tables */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Agent Performance</CardTitle>
                        <CardDescription>Avg latency, tools, and failures</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {perAgentSorted.length === 0 ? (
                            <p className="text-muted-foreground text-sm">
                                No agent performance data.
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
                                                onClick={() =>
                                                    router.push(
                                                        `/agents/${agent.agentSlug}/overview`
                                                    )
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
                            <p className="text-muted-foreground text-sm">No version metrics.</p>
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

export default function LiveDashboardPage() {
    if (typeof window !== "undefined") {
        window.location.replace("/observe");
    }
    return null;
}
