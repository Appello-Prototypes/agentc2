"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, useMemo } from "react";
import { getApiBase } from "@/lib/utils";
import { calculateCost } from "@/lib/cost-calculator";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
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
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@repo/ui";

// --- Types ---

interface Run {
    id: string;
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
    evaluationTier?: string | null;
    overallGrade?: number | null;
    confidenceScore?: number | null;
    narrative?: string | null;
    feedbackJson?: Record<string, string> | null;
    aarJson?: Record<string, unknown> | null;
    reEvaluatedAt?: string | null;
    calibrationChecks?: {
        id: string;
        auditorGrade: number | null;
        humanRating: number | null;
        disagreement: number | null;
        aligned: boolean | null;
        direction: string | null;
    }[];
    recommendations?: {
        id: string;
        type: string;
        category: string;
        title: string;
        description: string;
        status: string;
        frequency: number;
    }[];
}

interface Feedback {
    id: string;
    thumbs: boolean | null;
    rating: number | null;
    comment: string | null;
    source?: string | null;
    createdAt: string;
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
    turnCount?: number;
    turns?: Array<{
        id: string;
        turnIndex: number;
        inputText: string;
        outputText: string | null;
        durationMs: number | null;
        stepsJson?: unknown;
    }>;
    evaluation: Evaluation | Evaluation[] | null;
    feedback: Feedback | Feedback[] | null;
    costEvent: {
        id: string;
        totalCostUsd: number;
        promptTokens: number;
        completionTokens: number;
    } | null;
    guardrailEvents: GuardrailEvent[] | null;
    version: VersionInfo | null;
}

// --- Helpers ---

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
        case "api":
            return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
        default:
            return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
    }
}

function resolveToolLabel(toolCall: ToolCall): string {
    if (toolCall.toolKey && toolCall.toolKey !== "unknown") return toolCall.toolKey;
    const input = toolCall.inputJson as Record<string, unknown> | null;
    const output = toolCall.outputJson as Record<string, unknown> | null;
    const candidates = [
        input?.toolName,
        input?.tool,
        input?.name,
        output?.toolName,
        output?.tool,
        output?.name
    ];
    const resolved = candidates.find(
        (v): v is string => typeof v === "string" && v.trim().length > 0
    );
    return resolved || "Tool Call";
}

// --- Component ---

export default function RunsPage() {
    const params = useParams();
    const searchParamsHook = useSearchParams();
    const agentSlug = params.agentSlug as string;
    const versionIdParam = searchParamsHook.get("versionId");

    const [loading, setLoading] = useState(true);
    const [runs, setRuns] = useState<Run[]>([]);
    const [selectedRun, setSelectedRun] = useState<Run | null>(null);
    const [runDetail, setRunDetail] = useState<RunDetail | null>(null);
    const [runDetailLoading, setRunDetailLoading] = useState(false);
    const [detailTab, setDetailTab] = useState("overview");
    const [autoRefresh, setAutoRefresh] = useState(false);

    // Filters
    const [statusFilter, setStatusFilter] = useState("all");
    const [sourceFilter, setSourceFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [sortKey, setSortKey] = useState("startedAt");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

    const fetchRuns = useCallback(async () => {
        try {
            const p = new URLSearchParams();
            p.set("source", sourceFilter === "all" ? "all" : sourceFilter);
            if (statusFilter !== "all") p.set("status", statusFilter.toUpperCase());
            if (searchQuery) p.set("search", searchQuery);
            if (versionIdParam) p.set("versionId", versionIdParam);
            p.set("limit", "50");
            const res = await fetch(`${getApiBase()}/api/agents/${agentSlug}/runs?${p.toString()}`);
            const data = await res.json();
            if (data.success) {
                const transformed: Run[] = data.runs.map(
                    (run: {
                        id: string;
                        status: string;
                        inputText: string;
                        outputText?: string;
                        durationMs?: number;
                        startedAt: string;
                        completedAt?: string;
                        modelProvider?: string;
                        modelName?: string;
                        promptTokens?: number;
                        completionTokens?: number;
                        totalTokens?: number;
                        costUsd?: number;
                        source?: string;
                        sessionId?: string;
                        threadId?: string;
                        versionId?: string;
                        traceStepsCount?: number;
                        traceToolCallsCount?: number;
                        toolCallsCount?: number;
                    }) => ({
                        id: run.id,
                        status: run.status,
                        source: run.source || null,
                        sessionId: run.sessionId || null,
                        threadId: run.threadId || null,
                        inputText: run.inputText,
                        outputText: run.outputText || null,
                        durationMs: run.durationMs || null,
                        startedAt: run.startedAt,
                        completedAt: run.completedAt || null,
                        modelProvider: run.modelProvider || null,
                        modelName: run.modelName || null,
                        promptTokens: run.promptTokens || null,
                        completionTokens: run.completionTokens || null,
                        totalTokens: run.totalTokens || null,
                        costUsd:
                            run.costUsd ??
                            calculateCost(
                                run.modelName || "gpt-4o",
                                run.modelProvider,
                                run.promptTokens,
                                run.completionTokens
                            ),
                        toolCallCount: run.traceToolCallsCount ?? run.toolCallsCount ?? 0,
                        uniqueToolCount: run.traceToolCallsCount ?? run.toolCallsCount ?? 0,
                        stepCount: run.traceStepsCount ?? 0,
                        versionId: run.versionId || null
                    })
                );
                setRuns(transformed);
            }
        } catch (error) {
            console.error("Error fetching runs:", error);
        } finally {
            setLoading(false);
        }
    }, [agentSlug, statusFilter, sourceFilter, searchQuery, versionIdParam]);

    const fetchRunDetail = useCallback(
        async (run: Run) => {
            setRunDetailLoading(true);
            setDetailTab("overview");
            setRunDetail(null);
            try {
                const res = await fetch(`${getApiBase()}/api/agents/${agentSlug}/runs/${run.id}`);
                const data = await res.json();
                if (data.success) {
                    setRunDetail(data.run);
                }
            } catch (error) {
                console.error("Failed to fetch run detail:", error);
            } finally {
                setRunDetailLoading(false);
            }
        },
        [agentSlug]
    );

    useEffect(() => {
        fetchRuns();
    }, [fetchRuns]);

    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(fetchRuns, 30000);
        return () => clearInterval(interval);
    }, [autoRefresh, fetchRuns]);

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

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDirection("desc");
        }
    };

    const SortIcon = ({ column }: { column: string }) => {
        if (sortKey !== column) return null;
        return <span className="ml-1 text-xs">{sortDirection === "asc" ? "▲" : "▼"}</span>;
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-[400px] w-full" />
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Run History</h1>
                    <p className="text-muted-foreground">
                        All executions for this agent ({runs.length} total)
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant={autoRefresh ? "default" : "outline"}
                        size="sm"
                        onClick={() => setAutoRefresh(!autoRefresh)}
                    >
                        {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={fetchRuns}>
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <Input
                    placeholder="Search runs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-xs"
                />
                <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
                    <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="running">Running</SelectItem>
                        <SelectItem value="queued">Queued</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={sourceFilter} onValueChange={(v) => v && setSourceFilter(v)}>
                    <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Source" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Sources</SelectItem>
                        <SelectItem value="production">Production</SelectItem>
                        <SelectItem value="simulation">Simulation</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Main Layout: Table + Detail */}
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-5">
                {/* Runs Table */}
                <Card className="flex flex-col overflow-hidden lg:col-span-3">
                    <CardContent className="flex-1 overflow-auto p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Source</TableHead>
                                    <TableHead>Model</TableHead>
                                    <TableHead>Input</TableHead>
                                    <TableHead
                                        className="cursor-pointer text-right"
                                        onClick={() => handleSort("durationMs")}
                                    >
                                        Duration <SortIcon column="durationMs" />
                                    </TableHead>
                                    <TableHead
                                        className="cursor-pointer text-right"
                                        onClick={() => handleSort("toolCallCount")}
                                    >
                                        Tools <SortIcon column="toolCallCount" />
                                    </TableHead>
                                    <TableHead
                                        className="cursor-pointer text-right"
                                        onClick={() => handleSort("totalTokens")}
                                    >
                                        Tokens <SortIcon column="totalTokens" />
                                    </TableHead>
                                    <TableHead
                                        className="cursor-pointer text-right"
                                        onClick={() => handleSort("costUsd")}
                                    >
                                        Cost <SortIcon column="costUsd" />
                                    </TableHead>
                                    <TableHead
                                        className="cursor-pointer text-right"
                                        onClick={() => handleSort("startedAt")}
                                    >
                                        Time <SortIcon column="startedAt" />
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedRuns.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="py-12 text-center">
                                            <p className="text-muted-foreground text-sm">
                                                No runs found
                                            </p>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    sortedRuns.map((run) => (
                                        <TableRow
                                            key={run.id}
                                            onClick={() => handleRunClick(run)}
                                            className={`cursor-pointer transition-colors ${
                                                selectedRun?.id === run.id
                                                    ? "bg-primary/5"
                                                    : "hover:bg-muted/50"
                                            }`}
                                        >
                                            <TableCell>
                                                <Badge variant={getStatusBadgeVariant(run.status)}>
                                                    {run.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {run.source ? (
                                                    <span
                                                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getSourceBadgeColor(run.source)}`}
                                                    >
                                                        {run.source}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">
                                                        -
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="max-w-[120px] truncate text-xs">
                                                {formatModelLabel(run.modelName, run.modelProvider)}
                                            </TableCell>
                                            <TableCell className="max-w-[200px] truncate">
                                                <span className="text-sm">{run.inputText}</span>
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-xs">
                                                {run.durationMs
                                                    ? formatLatency(run.durationMs)
                                                    : "-"}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-xs">
                                                {run.toolCallCount || "-"}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-xs">
                                                {formatTokens(run.totalTokens)}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-xs">
                                                {formatCost(run.costUsd)}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-right text-xs">
                                                {formatRelativeTime(run.startedAt)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Run Detail Panel */}
                <Card className="flex flex-col overflow-hidden lg:col-span-2">
                    <CardHeader className="shrink-0 pb-3">
                        <CardTitle className="text-base">Run Detail</CardTitle>
                        {selectedRun && (
                            <CardDescription className="font-mono text-xs">
                                {selectedRun.id}
                            </CardDescription>
                        )}
                        {selectedRun && (
                            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                                <div className="bg-muted/50 rounded-lg p-2">
                                    <p className="text-muted-foreground text-xs">Status</p>
                                    <Badge
                                        variant={getStatusBadgeVariant(selectedRun.status)}
                                        className="mt-1"
                                    >
                                        {selectedRun.status}
                                    </Badge>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-2">
                                    <p className="text-muted-foreground text-xs">Duration</p>
                                    <p className="mt-1 text-sm font-semibold">
                                        {selectedRun.durationMs
                                            ? formatLatency(selectedRun.durationMs)
                                            : "-"}
                                    </p>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-2">
                                    <p className="text-muted-foreground text-xs">Cost</p>
                                    <p className="mt-1 text-sm font-semibold">
                                        {formatCost(selectedRun.costUsd)}
                                    </p>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-2">
                                    <p className="text-muted-foreground text-xs">Tool Calls</p>
                                    <p className="mt-1 text-sm font-semibold">
                                        {selectedRun.toolCallCount}
                                    </p>
                                </div>
                            </div>
                        )}
                    </CardHeader>
                    <CardContent className="flex-1 overflow-hidden">
                        {!selectedRun ? (
                            <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 py-12 text-center">
                                <p className="text-sm">
                                    Select a run to view its trace, tools, and latency breakdown.
                                </p>
                            </div>
                        ) : (
                            <Tabs
                                defaultValue="overview"
                                value={detailTab}
                                onValueChange={(v) => setDetailTab(v ?? "overview")}
                                className="flex h-full flex-col"
                            >
                                <TabsList className="flex w-full flex-nowrap justify-start gap-2 overflow-x-auto">
                                    <TabsTrigger value="overview" className="shrink-0">
                                        Overview
                                    </TabsTrigger>
                                    <TabsTrigger value="trace" className="shrink-0">
                                        Trace
                                    </TabsTrigger>
                                    <TabsTrigger value="tools" className="shrink-0">
                                        Tools
                                    </TabsTrigger>
                                    <TabsTrigger value="errors" className="shrink-0">
                                        Errors
                                    </TabsTrigger>
                                    <TabsTrigger value="latency" className="shrink-0">
                                        Latency
                                    </TabsTrigger>
                                    <TabsTrigger value="reportcard" className="shrink-0">
                                        Report Card
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
                                            {/* Overview Tab */}
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

                                                {runDetail?.version && (
                                                    <div>
                                                        <h3 className="text-muted-foreground mb-2 text-xs font-medium uppercase">
                                                            System Context
                                                        </h3>
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
                                                        </div>
                                                    </div>
                                                )}

                                                {evaluationScores &&
                                                    Object.keys(evaluationScores).length > 0 && (
                                                        <div>
                                                            <h3 className="text-muted-foreground mb-2 text-xs font-medium uppercase">
                                                                Evaluation Scores
                                                            </h3>
                                                            <div className="flex flex-wrap gap-3">
                                                                {Object.entries(
                                                                    evaluationScores
                                                                ).map(([key, value]) => (
                                                                    <div
                                                                        key={key}
                                                                        className="bg-muted/50 rounded-lg px-3 py-2 text-center"
                                                                    >
                                                                        <p className="text-muted-foreground text-xs">
                                                                            {key}
                                                                        </p>
                                                                        <p className="text-lg font-bold">
                                                                            {typeof value ===
                                                                            "number"
                                                                                ? value <= 1
                                                                                    ? `${Math.round(value * 100)}%`
                                                                                    : String(value)
                                                                                : String(value)}
                                                                        </p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                {feedbackList.length > 0 && (
                                                    <div>
                                                        <h3 className="text-muted-foreground mb-2 text-xs font-medium uppercase">
                                                            User Feedback
                                                        </h3>
                                                        <div className="flex flex-wrap gap-3">
                                                            {feedbackList.map((fb) => (
                                                                <div
                                                                    key={fb.id}
                                                                    className="bg-muted/50 flex items-center gap-2 rounded-lg px-3 py-2"
                                                                >
                                                                    {fb.thumbs !== null && (
                                                                        <span className="text-xl">
                                                                            {fb.thumbs
                                                                                ? "👍"
                                                                                : "👎"}
                                                                        </span>
                                                                    )}
                                                                    {fb.rating !== null && (
                                                                        <span className="font-semibold">
                                                                            {fb.rating}/5
                                                                        </span>
                                                                    )}
                                                                    {fb.comment && (
                                                                        <span className="text-muted-foreground text-sm">
                                                                            {fb.comment}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </TabsContent>

                                            {/* Trace Tab */}
                                            <TabsContent value="trace" className="mt-0 space-y-4">
                                                {(() => {
                                                    const steps = runDetail?.trace?.steps ?? [];
                                                    const stepsJson = runDetail?.trace
                                                        ?.stepsJson as unknown[] | null;
                                                    const hasSteps = steps.length > 0;
                                                    const hasStepsJson =
                                                        Array.isArray(stepsJson) &&
                                                        stepsJson.length > 0;

                                                    // Fallback: aggregate stepsJson from turns when trace-level steps are empty
                                                    const turnSteps: unknown[] = [];
                                                    if (
                                                        !hasSteps &&
                                                        !hasStepsJson &&
                                                        Array.isArray(runDetail?.turns)
                                                    ) {
                                                        for (const turn of runDetail.turns as Array<{
                                                            stepsJson?: unknown;
                                                        }>) {
                                                            if (Array.isArray(turn.stepsJson)) {
                                                                turnSteps.push(...turn.stepsJson);
                                                            }
                                                        }
                                                    }
                                                    const hasTurnSteps = turnSteps.length > 0;

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

                                                    if (hasTurnSteps) {
                                                        return (
                                                            <div className="space-y-3">
                                                                {turnSteps.map(
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

                                            {/* Tools Tab */}
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
                                                                                <pre className="max-h-32 overflow-auto rounded border border-red-500/20 bg-red-50 p-3 text-xs text-red-700 dark:bg-red-900/10 dark:text-red-400">
                                                                                    {toolCall.error ||
                                                                                        "Unknown error"}
                                                                                </pre>
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
                                                            No tool calls recorded for this run.
                                                        </p>
                                                    </div>
                                                )}
                                            </TabsContent>

                                            {/* Errors Tab */}
                                            <TabsContent value="errors" className="mt-0 space-y-4">
                                                {selectedRun.status.toUpperCase() === "FAILED" && (
                                                    <div className="rounded-lg border border-red-500/20 bg-red-50 p-4 dark:bg-red-900/10">
                                                        <h3 className="mb-2 text-sm font-semibold text-red-700 dark:text-red-400">
                                                            Run Failed
                                                        </h3>
                                                        <pre className="text-xs whitespace-pre-wrap text-red-600 dark:text-red-300">
                                                            {runDetail?.outputText ||
                                                                "No error details available"}
                                                        </pre>
                                                    </div>
                                                )}

                                                {runDetail?.guardrailEvents &&
                                                runDetail.guardrailEvents.length > 0 ? (
                                                    <div className="space-y-3">
                                                        <h3 className="text-sm font-semibold">
                                                            Guardrail Events
                                                        </h3>
                                                        {runDetail.guardrailEvents.map((event) => (
                                                            <div
                                                                key={event.id}
                                                                className="rounded-lg border border-yellow-500/20 bg-yellow-50 p-4 dark:bg-yellow-900/10"
                                                            >
                                                                <div className="mb-2 flex items-center gap-2">
                                                                    <Badge variant="outline">
                                                                        {event.type}
                                                                    </Badge>
                                                                    <span className="font-mono text-xs">
                                                                        {event.guardrailKey}
                                                                    </span>
                                                                </div>
                                                                <p className="text-sm">
                                                                    {event.reason}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : selectedRun.status.toUpperCase() !==
                                                  "FAILED" ? (
                                                    <div className="py-8 text-center">
                                                        <p className="text-muted-foreground text-sm">
                                                            No errors or guardrail events for this
                                                            run.
                                                        </p>
                                                    </div>
                                                ) : null}
                                            </TabsContent>

                                            {/* Latency Tab */}
                                            <TabsContent value="latency" className="mt-0 space-y-4">
                                                {runDetail?.trace?.steps &&
                                                runDetail.trace.steps.length > 0 ? (
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>#</TableHead>
                                                                <TableHead>Type</TableHead>
                                                                <TableHead className="text-right">
                                                                    Duration
                                                                </TableHead>
                                                                <TableHead className="text-right">
                                                                    % of Total
                                                                </TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {runDetail.trace.steps.map(
                                                                (step, idx) => {
                                                                    const totalMs =
                                                                        selectedRun.durationMs || 1;
                                                                    const pct = step.durationMs
                                                                        ? (
                                                                              (step.durationMs /
                                                                                  totalMs) *
                                                                              100
                                                                          ).toFixed(1)
                                                                        : "-";
                                                                    return (
                                                                        <TableRow key={step.id}>
                                                                            <TableCell>
                                                                                {idx + 1}
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <Badge variant="outline">
                                                                                    {step.type}
                                                                                </Badge>
                                                                            </TableCell>
                                                                            <TableCell className="text-right font-mono text-xs">
                                                                                {step.durationMs
                                                                                    ? formatLatency(
                                                                                          step.durationMs
                                                                                      )
                                                                                    : "-"}
                                                                            </TableCell>
                                                                            <TableCell className="text-right font-mono text-xs">
                                                                                {pct !== "-"
                                                                                    ? `${pct}%`
                                                                                    : "-"}
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    );
                                                                }
                                                            )}
                                                        </TableBody>
                                                    </Table>
                                                ) : (
                                                    <div className="py-8 text-center">
                                                        <p className="text-muted-foreground text-sm">
                                                            No step-level latency data available.
                                                        </p>
                                                    </div>
                                                )}
                                            </TabsContent>

                                            {/* Report Card Tab */}
                                            <TabsContent
                                                value="reportcard"
                                                className="mt-0 space-y-6"
                                            >
                                                {(() => {
                                                    // Resolve evaluation to a single object
                                                    const eval_ = Array.isArray(
                                                        runDetail?.evaluation
                                                    )
                                                        ? runDetail?.evaluation[0]
                                                        : runDetail?.evaluation;
                                                    // Resolve feedback to an array
                                                    const feedbackList = Array.isArray(
                                                        runDetail?.feedback
                                                    )
                                                        ? runDetail?.feedback
                                                        : runDetail?.feedback
                                                          ? [runDetail.feedback]
                                                          : [];
                                                    return (
                                                        <>
                                                            {/* Evaluation Summary */}
                                                            <div>
                                                                <h3 className="mb-3 text-sm font-semibold">
                                                                    Evaluation Summary
                                                                </h3>
                                                                {eval_ ? (
                                                                    <div className="space-y-3">
                                                                        <div className="flex items-center gap-3">
                                                                            <Badge
                                                                                variant={
                                                                                    eval_.evaluationTier ===
                                                                                    "tier2_auditor"
                                                                                        ? "default"
                                                                                        : "secondary"
                                                                                }
                                                                            >
                                                                                {eval_.evaluationTier ===
                                                                                "tier2_auditor"
                                                                                    ? "Tier 2 - AI Auditor"
                                                                                    : "Tier 1 - Heuristic"}
                                                                            </Badge>
                                                                            {eval_.reEvaluatedAt && (
                                                                                <Badge variant="outline">
                                                                                    Re-evaluated
                                                                                </Badge>
                                                                            )}
                                                                            {eval_.overallGrade !==
                                                                                null &&
                                                                                eval_.overallGrade !==
                                                                                    undefined && (
                                                                                    <span className="text-2xl font-bold">
                                                                                        {Math.round(
                                                                                            eval_.overallGrade *
                                                                                                100
                                                                                        )}
                                                                                        %
                                                                                    </span>
                                                                                )}
                                                                            {eval_.confidenceScore !==
                                                                                null &&
                                                                                eval_.confidenceScore !==
                                                                                    undefined && (
                                                                                    <span className="text-muted-foreground text-xs">
                                                                                        Confidence:{" "}
                                                                                        {Math.round(
                                                                                            eval_.confidenceScore *
                                                                                                100
                                                                                        )}
                                                                                        %
                                                                                    </span>
                                                                                )}
                                                                        </div>
                                                                        {evaluationScores &&
                                                                            Object.keys(
                                                                                evaluationScores
                                                                            ).length > 0 && (
                                                                                <div className="flex flex-wrap gap-3">
                                                                                    {Object.entries(
                                                                                        evaluationScores
                                                                                    ).map(
                                                                                        ([
                                                                                            key,
                                                                                            value
                                                                                        ]) => {
                                                                                            const numValue =
                                                                                                typeof value ===
                                                                                                "number"
                                                                                                    ? value
                                                                                                    : 0;
                                                                                            return (
                                                                                                <div
                                                                                                    key={
                                                                                                        key
                                                                                                    }
                                                                                                    className="bg-muted/50 rounded-lg px-3 py-2 text-center"
                                                                                                >
                                                                                                    <div className="text-muted-foreground text-xs">
                                                                                                        {key
                                                                                                            .replace(
                                                                                                                /_/g,
                                                                                                                " "
                                                                                                            )
                                                                                                            .replace(
                                                                                                                /\b\w/g,
                                                                                                                (
                                                                                                                    c
                                                                                                                ) =>
                                                                                                                    c.toUpperCase()
                                                                                                            )}
                                                                                                    </div>
                                                                                                    <div className="text-lg font-bold">
                                                                                                        {numValue <=
                                                                                                        1
                                                                                                            ? `${Math.round(numValue * 100)}%`
                                                                                                            : numValue}
                                                                                                    </div>
                                                                                                </div>
                                                                                            );
                                                                                        }
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        {eval_.narrative && (
                                                                            <div className="bg-muted/20 rounded-lg border p-3">
                                                                                <p className="text-sm">
                                                                                    {
                                                                                        eval_.narrative
                                                                                    }
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                        {eval_.feedbackJson &&
                                                                            typeof eval_.feedbackJson ===
                                                                                "object" && (
                                                                                <div className="space-y-2">
                                                                                    <h4 className="text-xs font-semibold">
                                                                                        Per-Criterion
                                                                                        Feedback
                                                                                    </h4>
                                                                                    {Object.entries(
                                                                                        eval_.feedbackJson as Record<
                                                                                            string,
                                                                                            string
                                                                                        >
                                                                                    ).map(
                                                                                        ([
                                                                                            key,
                                                                                            fb
                                                                                        ]) => (
                                                                                            <div
                                                                                                key={
                                                                                                    key
                                                                                                }
                                                                                                className="bg-muted/10 rounded border p-2"
                                                                                            >
                                                                                                <span className="text-xs font-medium">
                                                                                                    {key
                                                                                                        .replace(
                                                                                                            /_/g,
                                                                                                            " "
                                                                                                        )
                                                                                                        .replace(
                                                                                                            /\b\w/g,
                                                                                                            (
                                                                                                                c
                                                                                                            ) =>
                                                                                                                c.toUpperCase()
                                                                                                        )}

                                                                                                    :
                                                                                                </span>
                                                                                                <p className="text-muted-foreground mt-1 text-xs">
                                                                                                    {
                                                                                                        fb
                                                                                                    }
                                                                                                </p>
                                                                                            </div>
                                                                                        )
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-muted-foreground text-sm">
                                                                        No evaluation available for
                                                                        this run.
                                                                    </p>
                                                                )}
                                                            </div>

                                                            {/* After Action Review */}
                                                            {eval_?.aarJson && (
                                                                <div>
                                                                    <h3 className="mb-3 text-sm font-semibold">
                                                                        After Action Review
                                                                    </h3>
                                                                    {(() => {
                                                                        const aar =
                                                                            eval_.aarJson as Record<
                                                                                string,
                                                                                unknown
                                                                            >;
                                                                        return (
                                                                            <div className="space-y-3">
                                                                                {aar.what_should_have_happened ? (
                                                                                    <div className="bg-muted/20 rounded-lg border p-3">
                                                                                        <h4 className="mb-1 text-xs font-semibold">
                                                                                            What
                                                                                            Should
                                                                                            Have
                                                                                            Happened
                                                                                        </h4>
                                                                                        <p className="text-xs">
                                                                                            {String(
                                                                                                aar.what_should_have_happened
                                                                                            )}
                                                                                        </p>
                                                                                    </div>
                                                                                ) : null}
                                                                                {aar.what_actually_happened ? (
                                                                                    <div className="bg-muted/20 rounded-lg border p-3">
                                                                                        <h4 className="mb-1 text-xs font-semibold">
                                                                                            What
                                                                                            Actually
                                                                                            Happened
                                                                                        </h4>
                                                                                        <p className="text-xs">
                                                                                            {String(
                                                                                                aar.what_actually_happened
                                                                                            )}
                                                                                        </p>
                                                                                    </div>
                                                                                ) : null}
                                                                                {aar.why_difference ? (
                                                                                    <div className="bg-muted/20 rounded-lg border p-3">
                                                                                        <h4 className="mb-1 text-xs font-semibold">
                                                                                            Why the
                                                                                            Difference
                                                                                        </h4>
                                                                                        <p className="text-xs">
                                                                                            {String(
                                                                                                aar.why_difference
                                                                                            )}
                                                                                        </p>
                                                                                    </div>
                                                                                ) : null}
                                                                                {Array.isArray(
                                                                                    aar.sustain
                                                                                ) &&
                                                                                    aar.sustain
                                                                                        .length >
                                                                                        0 && (
                                                                                        <div>
                                                                                            <h4 className="mb-1 text-xs font-semibold text-green-600">
                                                                                                Sustain
                                                                                            </h4>
                                                                                            <ul className="list-inside list-disc space-y-1">
                                                                                                {(
                                                                                                    aar.sustain as {
                                                                                                        pattern: string;
                                                                                                    }[]
                                                                                                ).map(
                                                                                                    (
                                                                                                        s,
                                                                                                        i
                                                                                                    ) => (
                                                                                                        <li
                                                                                                            key={
                                                                                                                i
                                                                                                            }
                                                                                                            className="text-xs"
                                                                                                        >
                                                                                                            {
                                                                                                                s.pattern
                                                                                                            }
                                                                                                        </li>
                                                                                                    )
                                                                                                )}
                                                                                            </ul>
                                                                                        </div>
                                                                                    )}
                                                                                {Array.isArray(
                                                                                    aar.improve
                                                                                ) &&
                                                                                    aar.improve
                                                                                        .length >
                                                                                        0 && (
                                                                                        <div>
                                                                                            <h4 className="mb-1 text-xs font-semibold text-orange-600">
                                                                                                Improve
                                                                                            </h4>
                                                                                            <ul className="list-inside list-disc space-y-1">
                                                                                                {(
                                                                                                    aar.improve as {
                                                                                                        pattern: string;
                                                                                                        recommendation: string;
                                                                                                    }[]
                                                                                                ).map(
                                                                                                    (
                                                                                                        imp,
                                                                                                        i
                                                                                                    ) => (
                                                                                                        <li
                                                                                                            key={
                                                                                                                i
                                                                                                            }
                                                                                                            className="text-xs"
                                                                                                        >
                                                                                                            <span className="font-medium">
                                                                                                                {
                                                                                                                    imp.pattern
                                                                                                                }
                                                                                                            </span>

                                                                                                            :{" "}
                                                                                                            {
                                                                                                                imp.recommendation
                                                                                                            }
                                                                                                        </li>
                                                                                                    )
                                                                                                )}
                                                                                            </ul>
                                                                                        </div>
                                                                                    )}
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            )}

                                                            {/* User Feedback */}
                                                            <div>
                                                                <h3 className="mb-3 text-sm font-semibold">
                                                                    User Feedback
                                                                </h3>
                                                                {feedbackList.length > 0 ? (
                                                                    <div className="space-y-2">
                                                                        {feedbackList.map(
                                                                            (fb: {
                                                                                id: string;
                                                                                thumbs?:
                                                                                    | boolean
                                                                                    | null;
                                                                                rating?:
                                                                                    | number
                                                                                    | null;
                                                                                comment?:
                                                                                    | string
                                                                                    | null;
                                                                                source?:
                                                                                    | string
                                                                                    | null;
                                                                                createdAt: string;
                                                                            }) => (
                                                                                <div
                                                                                    key={fb.id}
                                                                                    className="bg-muted/20 flex items-start gap-3 rounded-lg border p-3"
                                                                                >
                                                                                    <span className="text-lg">
                                                                                        {fb.thumbs ===
                                                                                        true
                                                                                            ? "\u{1F44D}"
                                                                                            : fb.thumbs ===
                                                                                                false
                                                                                              ? "\u{1F44E}"
                                                                                              : "\u{1F4AC}"}
                                                                                    </span>
                                                                                    <div className="flex-1">
                                                                                        {fb.rating !==
                                                                                            null &&
                                                                                            fb.rating !==
                                                                                                undefined && (
                                                                                                <span className="text-xs font-medium">
                                                                                                    Rating:{" "}
                                                                                                    {
                                                                                                        fb.rating
                                                                                                    }
                                                                                                    /5
                                                                                                </span>
                                                                                            )}
                                                                                        {fb.comment && (
                                                                                            <p className="text-muted-foreground text-xs">
                                                                                                {
                                                                                                    fb.comment
                                                                                                }
                                                                                            </p>
                                                                                        )}
                                                                                        <span className="text-muted-foreground text-[10px]">
                                                                                            {fb.source &&
                                                                                                `via ${fb.source} \u00B7 `}
                                                                                            {new Date(
                                                                                                fb.createdAt
                                                                                            ).toLocaleString()}
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-muted-foreground text-sm">
                                                                        No feedback submitted for
                                                                        this run.
                                                                    </p>
                                                                )}
                                                            </div>

                                                            {/* Calibration */}
                                                            {eval_?.calibrationChecks &&
                                                                (
                                                                    eval_.calibrationChecks as {
                                                                        id: string;
                                                                        auditorGrade: number | null;
                                                                        humanRating: number | null;
                                                                        disagreement: number | null;
                                                                        aligned: boolean | null;
                                                                        direction: string | null;
                                                                    }[]
                                                                ).length > 0 && (
                                                                    <div>
                                                                        <h3 className="mb-3 text-sm font-semibold">
                                                                            Calibration (AI vs
                                                                            Human)
                                                                        </h3>
                                                                        {(
                                                                            eval_.calibrationChecks as {
                                                                                id: string;
                                                                                auditorGrade:
                                                                                    | number
                                                                                    | null;
                                                                                humanRating:
                                                                                    | number
                                                                                    | null;
                                                                                disagreement:
                                                                                    | number
                                                                                    | null;
                                                                                aligned:
                                                                                    | boolean
                                                                                    | null;
                                                                                direction:
                                                                                    | string
                                                                                    | null;
                                                                            }[]
                                                                        ).map((cal) => (
                                                                            <div
                                                                                key={cal.id}
                                                                                className="bg-muted/20 flex items-center gap-4 rounded-lg border p-3"
                                                                            >
                                                                                <Badge
                                                                                    variant={
                                                                                        cal.aligned
                                                                                            ? "default"
                                                                                            : "destructive"
                                                                                    }
                                                                                >
                                                                                    {cal.aligned
                                                                                        ? "Aligned"
                                                                                        : "Misaligned"}
                                                                                </Badge>
                                                                                <div className="text-xs">
                                                                                    AI:{" "}
                                                                                    {cal.auditorGrade !==
                                                                                    null
                                                                                        ? `${Math.round(cal.auditorGrade * 100)}%`
                                                                                        : "N/A"}
                                                                                    {" \u00B7 "}
                                                                                    Human:{" "}
                                                                                    {cal.humanRating !==
                                                                                    null
                                                                                        ? `${Math.round(cal.humanRating * 100)}%`
                                                                                        : "N/A"}
                                                                                    {cal.direction &&
                                                                                        ` \u00B7 ${cal.direction.replace(/_/g, " ")}`}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                            {/* Recommendations Generated */}
                                                            {eval_?.recommendations &&
                                                                (
                                                                    eval_.recommendations as {
                                                                        id: string;
                                                                        type: string;
                                                                        category: string;
                                                                        title: string;
                                                                        description: string;
                                                                        status: string;
                                                                        frequency: number;
                                                                    }[]
                                                                ).length > 0 && (
                                                                    <div>
                                                                        <h3 className="mb-3 text-sm font-semibold">
                                                                            Recommendations
                                                                            Generated
                                                                        </h3>
                                                                        <div className="space-y-2">
                                                                            {(
                                                                                eval_.recommendations as {
                                                                                    id: string;
                                                                                    type: string;
                                                                                    category: string;
                                                                                    title: string;
                                                                                    description: string;
                                                                                    status: string;
                                                                                    frequency: number;
                                                                                }[]
                                                                            ).map((rec) => (
                                                                                <div
                                                                                    key={rec.id}
                                                                                    className="bg-muted/20 rounded-lg border p-3"
                                                                                >
                                                                                    <div className="flex items-center gap-2">
                                                                                        <Badge
                                                                                            variant={
                                                                                                rec.type ===
                                                                                                "improve"
                                                                                                    ? "destructive"
                                                                                                    : "default"
                                                                                            }
                                                                                        >
                                                                                            {
                                                                                                rec.type
                                                                                            }
                                                                                        </Badge>
                                                                                        <Badge variant="outline">
                                                                                            {
                                                                                                rec.category
                                                                                            }
                                                                                        </Badge>
                                                                                        <Badge variant="outline">
                                                                                            {
                                                                                                rec.status
                                                                                            }
                                                                                        </Badge>
                                                                                        {rec.frequency >
                                                                                            1 && (
                                                                                            <span className="text-muted-foreground text-[10px]">
                                                                                                x
                                                                                                {
                                                                                                    rec.frequency
                                                                                                }
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    <p className="mt-1 text-xs font-medium">
                                                                                        {rec.title}
                                                                                    </p>
                                                                                    <p className="text-muted-foreground mt-1 text-xs">
                                                                                        {
                                                                                            rec.description
                                                                                        }
                                                                                    </p>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                        </>
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
        </div>
    );
}
