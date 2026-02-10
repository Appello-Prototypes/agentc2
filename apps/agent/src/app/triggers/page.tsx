"use client";

import { Fragment, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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
    Switch,
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
import RunDetailPanel from "@/components/RunDetailPanel";
import type { RunDetail } from "@/components/run-detail-utils";
import {
    formatLatency as fmtLatency,
    formatRelativeTime as fmtRelTime,
    formatCost,
    formatTokens,
    formatModelLabel,
    getStatusBadgeVariant,
    getSourceBadgeColor as getRunSourceBadgeColor,
    getDateRange as getDateRangeUtil
} from "@/components/run-detail-utils";

// ═══════════════════════════════════════════════════════════════════════════════
// Shared helpers
// ═══════════════════════════════════════════════════════════════════════════════

function formatRelativeTime(dateStr: string | null | undefined): string {
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

function formatStatusLabel(value: string | null): string {
    if (!value) return "—";
    return value
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatLatency(ms: number | null | undefined): string {
    if (!ms) return "—";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

function getTypeBadgeColor(type: string): string {
    switch (type) {
        case "scheduled":
            return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
        case "event":
            return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
        case "webhook":
            return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
        case "slack_listener":
            return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300";
        case "mcp":
            return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300";
        case "api":
            return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
        default:
            return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
    }
}

function getTypeLabel(type: string): string {
    switch (type) {
        case "scheduled":
            return "Schedule";
        case "event":
            return "Event";
        case "webhook":
            return "Webhook";
        case "slack_listener":
            return "Slack";
        case "mcp":
            return "MCP";
        case "api":
            return "API";
        default:
            return formatStatusLabel(type);
    }
}

function getSuccessRateColor(rate: number): string {
    if (rate >= 95) return "text-green-600 dark:text-green-400";
    if (rate >= 80) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
}

// ═══════════════════════════════════════════════════════════════════════════════
// Types for Automation Registry
// ═══════════════════════════════════════════════════════════════════════════════

interface Automation {
    id: string;
    sourceType: "schedule" | "trigger" | "implicit";
    type: string;
    name: string;
    description: string | null;
    isActive: boolean;
    agent: { id: string; slug: string; name: string } | null;
    config: {
        cronExpr?: string;
        timezone?: string;
        eventName?: string | null;
        webhookPath?: string | null;
    };
    stats: {
        totalRuns: number;
        successRuns: number;
        failedRuns: number;
        successRate: number;
        avgDurationMs: number | null;
        lastRunAt: string | null;
        nextRunAt: string | null;
    };
    lastRun: {
        id: string;
        status: string;
        startedAt: string;
        completedAt: string | null;
        durationMs: number | null;
    } | null;
    createdAt: string;
}

interface AutomationSummary {
    total: number;
    active: number;
    schedules: number;
    triggers: number;
    implicit: number;
    overallSuccessRate: number;
}

/** Enriched run shape matching Live Runs schema. */
interface AutomationRunEnriched {
    id: string;
    agentId: string | null;
    agentSlug: string | null;
    agentName: string | null;
    runType: string | null;
    status: string;
    source: string | null;
    sessionId: string | null;
    threadId: string | null;
    inputText: string | null;
    outputText: string | null;
    durationMs: number | null;
    startedAt: string | null;
    completedAt: string | null;
    modelProvider: string | null;
    modelName: string | null;
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    costUsd: number | null;
    toolCallCount: number;
    uniqueToolCount: number;
    versionId: string | null;
    versionNumber: number | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Automation Registry Tab (Accordion + Runs Table + RunDetailPanel)
// ═══════════════════════════════════════════════════════════════════════════════

/** Number of columns in the parent automation table. */
const PARENT_COL_COUNT = 9;

function AutomationRegistryTab() {
    const router = useRouter();
    const apiBase = getApiBase();

    // ── Automations list state ───────────────────────────────────────
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [automations, setAutomations] = useState<Automation[]>([]);
    const [summary, setSummary] = useState<AutomationSummary | null>(null);
    const [toggling, setToggling] = useState<string | null>(null);

    // ── Accordion expansion state ────────────────────────────────────
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [automationRuns, setAutomationRuns] = useState<Map<string, AutomationRunEnriched[]>>(
        new Map()
    );
    const [runsLoading, setRunsLoading] = useState<string | null>(null);
    const [runStatusFilter, setRunStatusFilter] = useState("all");
    const [runTimeFilter, setRunTimeFilter] = useState("all");

    // ── Run inspector (right panel) state ────────────────────────────
    const [selectedRun, setSelectedRun] = useState<AutomationRunEnriched | null>(null);
    const [selectedRunAutomation, setSelectedRunAutomation] = useState<Automation | null>(null);
    const [runDetail, setRunDetail] = useState<RunDetail | null>(null);
    const [runDetailLoading, setRunDetailLoading] = useState(false);

    // ── Fetch automations list ───────────────────────────────────────
    const fetchAutomations = useCallback(async () => {
        try {
            const res = await fetch(`${apiBase}/api/live/automations`);
            const data = await res.json();
            if (data.success) {
                setAutomations(data.automations || []);
                setSummary(data.summary || null);
            } else {
                setError(data.error || "Failed to load automations");
            }
        } catch (fetchError) {
            setError(
                fetchError instanceof Error ? fetchError.message : "Failed to load automations"
            );
        } finally {
            setLoading(false);
        }
    }, [apiBase]);

    // ── Fetch enriched runs for an automation ────────────────────────
    const fetchAutomationRuns = useCallback(
        async (automationId: string, status?: string, timeRange?: string) => {
            setRunsLoading(automationId);
            try {
                const params = new URLSearchParams({ limit: "20" });
                if (status && status !== "all") params.set("status", status);
                if (timeRange && timeRange !== "all") {
                    const { from } = getDateRangeUtil(timeRange);
                    if (from) params.set("from", from.toISOString());
                }
                const res = await fetch(
                    `${apiBase}/api/live/automations/${encodeURIComponent(automationId)}?${params.toString()}`
                );
                const data = await res.json();
                if (data.success) {
                    setAutomationRuns((prev) => {
                        const next = new Map(prev);
                        next.set(automationId, data.runs || []);
                        return next;
                    });
                }
            } catch {
                // Silently handle
            } finally {
                setRunsLoading(null);
            }
        },
        [apiBase]
    );

    // ── Fetch full run detail for right panel ────────────────────────
    const fetchRunDetail = useCallback(
        async (run: AutomationRunEnriched) => {
            if (!run.agentSlug) return;
            setRunDetailLoading(true);
            setRunDetail(null);
            try {
                const res = await fetch(`${apiBase}/api/agents/${run.agentSlug}/runs/${run.id}`);
                const data = await res.json();
                if (data.success) {
                    setRunDetail(data.run);
                }
            } catch (err) {
                console.error("Failed to fetch run detail:", err);
            } finally {
                setRunDetailLoading(false);
            }
        },
        [apiBase]
    );

    // ── Toggle automation active/paused ──────────────────────────────
    const toggleAutomation = useCallback(
        async (automation: Automation) => {
            if (automation.sourceType === "implicit") return;
            setToggling(automation.id);
            try {
                const res = await fetch(
                    `${apiBase}/api/live/automations/${encodeURIComponent(automation.id)}`,
                    {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ isActive: !automation.isActive })
                    }
                );
                const data = await res.json();
                if (data.success) {
                    setAutomations((prev) =>
                        prev.map((a) =>
                            a.id === automation.id ? { ...a, isActive: !a.isActive } : a
                        )
                    );
                }
            } catch {
                // Silently handle
            } finally {
                setToggling(null);
            }
        },
        [apiBase]
    );

    // ── Row click: toggle accordion ──────────────────────────────────
    const handleAutomationRowClick = useCallback(
        (automation: Automation) => {
            if (expandedId === automation.id) {
                // Collapse
                setExpandedId(null);
            } else {
                // Expand + fetch runs
                setExpandedId(automation.id);
                setRunStatusFilter("all");
                setRunTimeFilter("all");
                fetchAutomationRuns(automation.id);
            }
        },
        [expandedId, fetchAutomationRuns]
    );

    // ── Run row click: select for right panel ────────────────────────
    const handleRunClick = useCallback(
        (run: AutomationRunEnriched, automation: Automation) => {
            setSelectedRun(run);
            setSelectedRunAutomation(automation);
            fetchRunDetail(run);
        },
        [fetchRunDetail]
    );

    // ── Effects ──────────────────────────────────────────────────────
    useEffect(() => {
        fetchAutomations();
    }, [fetchAutomations]);

    // Auto-refresh every 30s
    useEffect(() => {
        const interval = setInterval(fetchAutomations, 30000);
        return () => clearInterval(interval);
    }, [fetchAutomations]);

    // Re-fetch runs when inline filters change
    useEffect(() => {
        if (expandedId) {
            fetchAutomationRuns(expandedId, runStatusFilter, runTimeFilter);
        }
    }, [runStatusFilter, runTimeFilter, expandedId, fetchAutomationRuns]);

    // Auto-expand: pick the automation with the most recent failure or most recent lastRunAt
    useEffect(() => {
        if (!loading && automations.length > 0 && expandedId === null) {
            // Prefer automation with failures and lowest success rate
            const withFailures = automations
                .filter((a) => a.stats.failedRuns > 0)
                .sort((a, b) => a.stats.successRate - b.stats.successRate);
            if (withFailures.length > 0) {
                setExpandedId(withFailures[0]!.id);
                fetchAutomationRuns(withFailures[0]!.id);
                return;
            }
            // Otherwise pick the most recently run automation
            const sorted = [...automations]
                .filter((a) => a.stats.lastRunAt)
                .sort(
                    (a, b) =>
                        new Date(b.stats.lastRunAt!).getTime() -
                        new Date(a.stats.lastRunAt!).getTime()
                );
            if (sorted.length > 0) {
                setExpandedId(sorted[0]!.id);
                fetchAutomationRuns(sorted[0]!.id);
            }
        }
        // Only run on first load
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading]);

    // ── Render ───────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-24" />
                    ))}
                </div>
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                    <Skeleton className="h-[400px]" />
                    <Skeleton className="h-[400px]" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {error && (
                <Card>
                    <CardContent className="py-4 text-sm text-red-500">{error}</CardContent>
                </Card>
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Automations</CardDescription>
                        <CardTitle className="text-2xl">{summary?.total ?? 0}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Active</CardDescription>
                        <CardTitle className="text-2xl text-green-600">
                            {summary?.active ?? 0}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Schedules</CardDescription>
                        <CardTitle className="text-2xl text-blue-600">
                            {summary?.schedules ?? 0}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Event Triggers</CardDescription>
                        <CardTitle className="text-2xl">
                            {(summary?.triggers ?? 0) + (summary?.implicit ?? 0)}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Success Rate</CardDescription>
                        <CardTitle
                            className={`text-2xl ${getSuccessRateColor(summary?.overallSuccessRate ?? 0)}`}
                        >
                            {summary?.overallSuccessRate ?? 0}%
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Main content: Accordion table (left) + Run Inspector (right) */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                {/* Automation table with inline expansion */}
                <Card>
                    <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <CardTitle>Configured Automations</CardTitle>
                                <CardDescription>
                                    {automations.length} automation
                                    {automations.length !== 1 ? "s" : ""} across all agents
                                </CardDescription>
                            </div>
                            <Button variant="outline" size="sm" onClick={fetchAutomations}>
                                <HugeiconsIcon icon={icons.refresh!} className="mr-2 size-4" />
                                Refresh
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {automations.length === 0 ? (
                            <div className="py-12 text-center">
                                <p className="text-muted-foreground text-lg">
                                    No automations configured
                                </p>
                                <p className="text-muted-foreground mt-2 text-sm">
                                    Create schedules or triggers on individual agent pages
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-6" />
                                            <TableHead>Name</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Agent</TableHead>
                                            <TableHead>Schedule / Event</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Health</TableHead>
                                            <TableHead>Runs</TableHead>
                                            <TableHead>Last Run</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {automations.map((automation) => {
                                            const isExpanded = expandedId === automation.id;
                                            const runs = automationRuns.get(automation.id) || [];
                                            const isLoadingRuns = runsLoading === automation.id;

                                            return (
                                                <Fragment key={automation.id}>
                                                    {/* Parent automation row */}
                                                    <TableRow
                                                        className={`cursor-pointer ${isExpanded ? "bg-muted/50 border-b-0" : ""}`}
                                                        onClick={() =>
                                                            handleAutomationRowClick(automation)
                                                        }
                                                    >
                                                        <TableCell className="w-6 px-2">
                                                            <span
                                                                className={`inline-block text-xs transition-transform ${isExpanded ? "rotate-90" : ""}`}
                                                            >
                                                                ▶
                                                            </span>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div>
                                                                <p className="font-medium">
                                                                    {automation.name}
                                                                </p>
                                                                {automation.description && (
                                                                    <p className="text-muted-foreground max-w-[200px] truncate text-xs">
                                                                        {automation.description}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge
                                                                className={getTypeBadgeColor(
                                                                    automation.type
                                                                )}
                                                            >
                                                                {getTypeLabel(automation.type)}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            {automation.agent ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        router.push(
                                                                            `/agents/${automation.agent!.slug}/overview`
                                                                        );
                                                                    }}
                                                                    className="hover:text-primary text-sm font-medium"
                                                                >
                                                                    {automation.agent.name}
                                                                </button>
                                                            ) : (
                                                                <span className="text-muted-foreground">
                                                                    —
                                                                </span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <span className="font-mono text-xs">
                                                                {automation.config.cronExpr ||
                                                                    automation.config.eventName ||
                                                                    automation.config.webhookPath ||
                                                                    "—"}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell>
                                                            {automation.sourceType ===
                                                            "implicit" ? (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-muted-foreground"
                                                                >
                                                                    Always On
                                                                </Badge>
                                                            ) : (
                                                                <div
                                                                    className="flex items-center gap-2"
                                                                    onClick={(e) =>
                                                                        e.stopPropagation()
                                                                    }
                                                                >
                                                                    <Switch
                                                                        checked={
                                                                            automation.isActive
                                                                        }
                                                                        onCheckedChange={() =>
                                                                            toggleAutomation(
                                                                                automation
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            toggling ===
                                                                            automation.id
                                                                        }
                                                                    />
                                                                    <span className="text-xs">
                                                                        {automation.isActive
                                                                            ? "Active"
                                                                            : "Paused"}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {automation.stats.totalRuns > 0 ? (
                                                                <span
                                                                    className={`text-sm font-semibold ${getSuccessRateColor(automation.stats.successRate)}`}
                                                                >
                                                                    {automation.stats.successRate}%
                                                                </span>
                                                            ) : (
                                                                <span className="text-muted-foreground text-sm">
                                                                    —
                                                                </span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <span className="text-sm">
                                                                {automation.stats.totalRuns}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell>
                                                            <span
                                                                className="text-muted-foreground text-sm"
                                                                title={
                                                                    automation.stats.lastRunAt
                                                                        ? new Date(
                                                                              automation.stats
                                                                                  .lastRunAt
                                                                          ).toLocaleString()
                                                                        : undefined
                                                                }
                                                            >
                                                                {formatRelativeTime(
                                                                    automation.stats.lastRunAt
                                                                )}
                                                            </span>
                                                        </TableCell>
                                                    </TableRow>

                                                    {/* Expanded inline runs table */}
                                                    {isExpanded && (
                                                        <TableRow className="hover:bg-transparent">
                                                            <TableCell
                                                                colSpan={PARENT_COL_COUNT}
                                                                className="bg-muted/20 px-4 py-3"
                                                            >
                                                                {/* Inline filter bar */}
                                                                <div className="mb-3 flex items-center gap-2">
                                                                    <span className="text-muted-foreground text-xs font-medium">
                                                                        Runs
                                                                    </span>
                                                                    <div className="flex items-center gap-1">
                                                                        <Badge
                                                                            variant={
                                                                                runStatusFilter ===
                                                                                "all"
                                                                                    ? "default"
                                                                                    : "outline"
                                                                            }
                                                                            className="cursor-pointer text-xs"
                                                                            onClick={() =>
                                                                                setRunStatusFilter(
                                                                                    "all"
                                                                                )
                                                                            }
                                                                        >
                                                                            All
                                                                        </Badge>
                                                                        <Badge
                                                                            variant={
                                                                                runStatusFilter ===
                                                                                "failed"
                                                                                    ? "destructive"
                                                                                    : "outline"
                                                                            }
                                                                            className="cursor-pointer text-xs"
                                                                            onClick={() =>
                                                                                setRunStatusFilter(
                                                                                    "failed"
                                                                                )
                                                                            }
                                                                        >
                                                                            Failed
                                                                        </Badge>
                                                                        <Badge
                                                                            variant={
                                                                                runStatusFilter ===
                                                                                "completed"
                                                                                    ? "default"
                                                                                    : "outline"
                                                                            }
                                                                            className="cursor-pointer text-xs"
                                                                            onClick={() =>
                                                                                setRunStatusFilter(
                                                                                    "completed"
                                                                                )
                                                                            }
                                                                        >
                                                                            Completed
                                                                        </Badge>
                                                                        <Badge
                                                                            variant={
                                                                                runStatusFilter ===
                                                                                "running"
                                                                                    ? "secondary"
                                                                                    : "outline"
                                                                            }
                                                                            className="cursor-pointer text-xs"
                                                                            onClick={() =>
                                                                                setRunStatusFilter(
                                                                                    "running"
                                                                                )
                                                                            }
                                                                        >
                                                                            Running
                                                                        </Badge>
                                                                    </div>
                                                                    <Separator
                                                                        orientation="vertical"
                                                                        className="mx-1 h-4"
                                                                    />
                                                                    <Select
                                                                        value={runTimeFilter}
                                                                        onValueChange={(v) =>
                                                                            setRunTimeFilter(
                                                                                v ?? "all"
                                                                            )
                                                                        }
                                                                    >
                                                                        <SelectTrigger className="h-7 w-24 text-xs">
                                                                            <SelectValue placeholder="Time" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="all">
                                                                                All Time
                                                                            </SelectItem>
                                                                            <SelectItem value="24h">
                                                                                Last 24h
                                                                            </SelectItem>
                                                                            <SelectItem value="7d">
                                                                                Last 7d
                                                                            </SelectItem>
                                                                            <SelectItem value="30d">
                                                                                Last 30d
                                                                            </SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>

                                                                {/* Runs table */}
                                                                {isLoadingRuns ? (
                                                                    <div className="space-y-2">
                                                                        {Array.from({
                                                                            length: 4
                                                                        }).map((_, i) => (
                                                                            <Skeleton
                                                                                key={i}
                                                                                className="h-10 w-full"
                                                                            />
                                                                        ))}
                                                                    </div>
                                                                ) : runs.length === 0 ? (
                                                                    <p className="text-muted-foreground py-6 text-center text-sm">
                                                                        No runs recorded
                                                                        {runStatusFilter !== "all"
                                                                            ? " matching this filter"
                                                                            : ""}
                                                                    </p>
                                                                ) : (
                                                                    <div className="overflow-auto rounded-md border">
                                                                        <Table>
                                                                            <TableHeader>
                                                                                <TableRow>
                                                                                    <TableHead>
                                                                                        Run ID
                                                                                    </TableHead>
                                                                                    <TableHead>
                                                                                        Status
                                                                                    </TableHead>
                                                                                    <TableHead>
                                                                                        Source
                                                                                    </TableHead>
                                                                                    <TableHead>
                                                                                        Model
                                                                                    </TableHead>
                                                                                    <TableHead className="text-right">
                                                                                        Duration
                                                                                    </TableHead>
                                                                                    <TableHead className="text-right">
                                                                                        Tokens
                                                                                    </TableHead>
                                                                                    <TableHead className="text-right">
                                                                                        Cost
                                                                                    </TableHead>
                                                                                    <TableHead className="text-right">
                                                                                        Time
                                                                                    </TableHead>
                                                                                </TableRow>
                                                                            </TableHeader>
                                                                            <TableBody>
                                                                                {runs.map((run) => {
                                                                                    const isRunSelected =
                                                                                        selectedRun?.id ===
                                                                                        run.id;
                                                                                    return (
                                                                                        <TableRow
                                                                                            key={
                                                                                                run.id
                                                                                            }
                                                                                            className={`cursor-pointer ${isRunSelected ? "bg-muted/50" : ""}`}
                                                                                            onClick={(
                                                                                                e
                                                                                            ) => {
                                                                                                e.stopPropagation();
                                                                                                handleRunClick(
                                                                                                    run,
                                                                                                    automation
                                                                                                );
                                                                                            }}
                                                                                        >
                                                                                            <TableCell className="font-mono text-xs">
                                                                                                {run.id.slice(
                                                                                                    0,
                                                                                                    8
                                                                                                )}
                                                                                            </TableCell>
                                                                                            <TableCell>
                                                                                                <Badge
                                                                                                    variant={getStatusBadgeVariant(
                                                                                                        run.status
                                                                                                    )}
                                                                                                >
                                                                                                    {
                                                                                                        run.status
                                                                                                    }
                                                                                                </Badge>
                                                                                            </TableCell>
                                                                                            <TableCell>
                                                                                                {run.source ? (
                                                                                                    <Badge
                                                                                                        className={getRunSourceBadgeColor(
                                                                                                            run.source
                                                                                                        )}
                                                                                                    >
                                                                                                        {
                                                                                                            run.source
                                                                                                        }
                                                                                                    </Badge>
                                                                                                ) : (
                                                                                                    "—"
                                                                                                )}
                                                                                            </TableCell>
                                                                                            <TableCell className="text-xs">
                                                                                                {formatModelLabel(
                                                                                                    run.modelName,
                                                                                                    run.modelProvider
                                                                                                )}
                                                                                            </TableCell>
                                                                                            <TableCell className="text-right">
                                                                                                {run.durationMs
                                                                                                    ? fmtLatency(
                                                                                                          run.durationMs
                                                                                                      )
                                                                                                    : "—"}
                                                                                            </TableCell>
                                                                                            <TableCell className="text-right">
                                                                                                {formatTokens(
                                                                                                    run.totalTokens
                                                                                                )}
                                                                                            </TableCell>
                                                                                            <TableCell className="text-right">
                                                                                                {formatCost(
                                                                                                    run.costUsd
                                                                                                )}
                                                                                            </TableCell>
                                                                                            <TableCell className="text-muted-foreground text-right">
                                                                                                <span
                                                                                                    title={
                                                                                                        run.startedAt
                                                                                                            ? new Date(
                                                                                                                  run.startedAt
                                                                                                              ).toLocaleString()
                                                                                                            : undefined
                                                                                                    }
                                                                                                >
                                                                                                    {fmtRelTime(
                                                                                                        run.startedAt
                                                                                                    )}
                                                                                                </span>
                                                                                            </TableCell>
                                                                                        </TableRow>
                                                                                    );
                                                                                })}
                                                                            </TableBody>
                                                                        </Table>
                                                                    </div>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </Fragment>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Right panel: Unified Run Inspector */}
                <Card className="flex flex-col">
                    <CardHeader className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <CardTitle className="text-lg">
                                    {selectedRun && selectedRunAutomation
                                        ? selectedRunAutomation.name
                                        : "Run Detail"}
                                </CardTitle>
                                <CardDescription>
                                    {selectedRun
                                        ? `Run ID: ${selectedRun.id}`
                                        : "Click a run to inspect trace, tools, and context."}
                                </CardDescription>
                            </div>
                            {selectedRun && (
                                <div className="flex items-center gap-2">
                                    <Link href={`/live?search=${selectedRun.id}`}>
                                        <Button variant="outline" size="sm">
                                            Open in Live Runs
                                        </Button>
                                    </Link>
                                </div>
                            )}
                        </div>

                        {selectedRun && (
                            <>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant={getStatusBadgeVariant(selectedRun.status)}>
                                        {selectedRun.status}
                                    </Badge>
                                    {selectedRun.source && (
                                        <Badge
                                            className={getRunSourceBadgeColor(selectedRun.source)}
                                        >
                                            {selectedRun.source}
                                        </Badge>
                                    )}
                                    {selectedRun.versionNumber && (
                                        <Badge variant="outline">
                                            v{selectedRun.versionNumber}
                                        </Badge>
                                    )}
                                    <Badge variant="outline">
                                        {formatModelLabel(
                                            selectedRun.modelName,
                                            selectedRun.modelProvider
                                        )}
                                    </Badge>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-muted/50 rounded-lg p-3">
                                        <p className="text-muted-foreground text-xs">Duration</p>
                                        <p className="text-base font-semibold">
                                            {selectedRun.durationMs
                                                ? fmtLatency(selectedRun.durationMs)
                                                : "—"}
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
                            </>
                        )}
                    </CardHeader>
                    <CardContent className="flex-1 overflow-hidden">
                        {!selectedRun ? (
                            <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 py-12 text-center">
                                <HugeiconsIcon icon={icons.activity!} className="size-10" />
                                <p className="text-sm">
                                    Expand an automation and click a run to view its trace, tools,
                                    and latency breakdown.
                                </p>
                            </div>
                        ) : (
                            <RunDetailPanel
                                runDetail={runDetail}
                                loading={runDetailLoading}
                                inputText={selectedRun.inputText ?? undefined}
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
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Activity Log Tab (existing TriggerMonitoringClient, preserved as-is)
// ═══════════════════════════════════════════════════════════════════════════════

interface TriggerFilters {
    agents: Array<{ id: string; slug: string; name: string }>;
    triggers: Array<{
        id: string;
        name: string;
        triggerType: string;
        eventName: string | null;
        webhookPath: string | null;
    }>;
    statuses: Array<{ status: string; count: number }>;
    sources: Array<{ sourceType: string; count: number }>;
    integrations: Array<{ integrationKey: string | null; count: number }>;
    eventNames: Array<{ eventName: string | null; count: number }>;
    workflows: Array<{ id: string; slug: string; name: string }>;
    networks: Array<{ id: string; slug: string; name: string }>;
    entityTypes: Array<{ entityType: string | null; count: number }>;
}

interface TriggerMetrics {
    summary: {
        total: number;
        statuses: Array<{ status: string; count: number }>;
        sources: Array<{ sourceType: string; count: number }>;
        entityTypes: Array<{ entityType: string | null; count: number }>;
    };
    dateRange: {
        from: string | null;
        to: string | null;
    };
}

interface TriggerEventRow {
    id: string;
    status: string;
    sourceType: string;
    triggerType: string | null;
    integrationKey: string | null;
    integrationId: string | null;
    eventName: string | null;
    webhookPath: string | null;
    errorMessage: string | null;
    payloadPreview: string | null;
    payloadTruncated: boolean;
    entityType: string | null;
    createdAt: string;
    updatedAt: string;
    trigger: {
        id: string;
        name: string;
        triggerType: string;
        eventName: string | null;
        webhookPath: string | null;
    } | null;
    agent: {
        id: string;
        slug: string;
        name: string;
    } | null;
    run: {
        id: string;
        status: string;
        startedAt: string;
        completedAt: string | null;
        durationMs: number | null;
    } | null;
    workflow: {
        id: string;
        slug: string;
        name: string;
    } | null;
    workflowRun: {
        id: string;
        status: string;
        startedAt: string;
        completedAt: string | null;
        durationMs: number | null;
    } | null;
    network: {
        id: string;
        slug: string;
        name: string;
    } | null;
    networkRun: {
        id: string;
        status: string;
        startedAt: string;
        completedAt: string | null;
        durationMs: number | null;
    } | null;
}

interface TriggerEventDetail extends TriggerEventRow {
    payloadJson: unknown;
    metadata: unknown;
    run: {
        id: string;
        status: string;
        startedAt: string;
        completedAt: string | null;
        durationMs: number | null;
        inputText: string;
        outputText: string | null;
    } | null;
    trigger:
        | (TriggerEventRow["trigger"] & {
              filterJson?: unknown;
              inputMapping?: unknown;
          })
        | null;
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

function getEventStatusBadgeVariant(
    status: string
): "default" | "secondary" | "destructive" | "outline" {
    switch (status.toUpperCase()) {
        case "QUEUED":
        case "RECEIVED":
            return "secondary";
        case "FILTERED":
        case "NO_MATCH":
            return "outline";
        case "SKIPPED":
            return "outline";
        case "REJECTED":
        case "ERROR":
            return "destructive";
        default:
            return "outline";
    }
}

function getRunStatusBadgeVariant(
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
        case "webhook":
            return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
        case "schedule":
        case "cron":
            return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
        case "manual":
            return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
        case "event":
            return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
        case "slack":
            return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300";
        case "api":
            return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
        case "chat":
            return "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300";
        case "mcp":
            return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300";
        case "simulation":
            return "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300";
        case "integration":
            return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
        default:
            return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
    }
}

function ActivityLogTab() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [eventsLoading, setEventsLoading] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [metrics, setMetrics] = useState<TriggerMetrics | null>(null);
    const [filters, setFilters] = useState<TriggerFilters | null>(null);
    const [events, setEvents] = useState<TriggerEventRow[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<TriggerEventRow | null>(null);
    const [eventDetail, setEventDetail] = useState<TriggerEventDetail | null>(null);
    const [runDetail, setRunDetail] = useState<RunDetail | null>(null);
    const [runDetailLoading, setRunDetailLoading] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

    const [statusFilter, setStatusFilter] = useState("all");
    const [sourceFilter, setSourceFilter] = useState("all");
    const [integrationFilter, setIntegrationFilter] = useState("all");
    const [triggerFilter, setTriggerFilter] = useState("all");
    const [agentFilter, setAgentFilter] = useState("all");
    const [eventNameFilter, setEventNameFilter] = useState("all");
    const [entityTypeFilter, setEntityTypeFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [timeRange, setTimeRange] = useState("24h");
    const [detailTab, setDetailTab] = useState("overview");

    const { from: rangeFrom, to: rangeTo } = useMemo(() => {
        return getDateRange(timeRange);
    }, [timeRange]);

    const statusCounts = useMemo(() => {
        const counts = new Map<string, number>();
        metrics?.summary.statuses.forEach((row) => {
            counts.set(row.status, row.count);
        });
        return counts;
    }, [metrics]);

    const hasActiveFilters =
        searchQuery.length > 0 ||
        statusFilter !== "all" ||
        sourceFilter !== "all" ||
        integrationFilter !== "all" ||
        triggerFilter !== "all" ||
        agentFilter !== "all" ||
        eventNameFilter !== "all" ||
        entityTypeFilter !== "all" ||
        timeRange !== "24h";

    const fetchFilters = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (rangeFrom) params.set("from", rangeFrom.toISOString());
            if (rangeTo) params.set("to", rangeTo.toISOString());
            const res = await fetch(
                `${getApiBase()}/api/live/triggers/filters?${params.toString()}`
            );
            const data = await res.json();
            if (data.success) setFilters(data.filters);
            else setError(data.error || "Failed to load filters");
        } catch (fetchError) {
            setError(fetchError instanceof Error ? fetchError.message : "Failed to load filters");
        }
    }, [rangeFrom, rangeTo]);

    const fetchMetrics = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (rangeFrom) params.set("from", rangeFrom.toISOString());
            if (rangeTo) params.set("to", rangeTo.toISOString());
            const res = await fetch(
                `${getApiBase()}/api/live/triggers/metrics?${params.toString()}`
            );
            const data = await res.json();
            if (data.success) setMetrics(data);
            else setError(data.error || "Failed to load metrics");
        } catch (fetchError) {
            setError(fetchError instanceof Error ? fetchError.message : "Failed to load metrics");
        }
    }, [rangeFrom, rangeTo]);

    const fetchEvents = useCallback(async () => {
        setEventsLoading(true);
        try {
            const params = new URLSearchParams();
            if (statusFilter !== "all") params.set("status", statusFilter);
            if (sourceFilter !== "all") params.set("sourceType", sourceFilter);
            if (integrationFilter !== "all") params.set("integrationKey", integrationFilter);
            if (triggerFilter !== "all") params.set("triggerId", triggerFilter);
            if (agentFilter !== "all") params.set("agentId", agentFilter);
            if (eventNameFilter !== "all") params.set("eventName", eventNameFilter);
            if (entityTypeFilter !== "all") params.set("entityType", entityTypeFilter);
            if (searchQuery) params.set("search", searchQuery);
            if (rangeFrom) params.set("from", rangeFrom.toISOString());
            if (rangeTo) params.set("to", rangeTo.toISOString());
            const res = await fetch(`${getApiBase()}/api/live/triggers?${params.toString()}`);
            const data = await res.json();
            if (data.success) {
                setEvents(data.events || []);
                setLastUpdatedAt(new Date());
            } else {
                setError(data.error || "Failed to load trigger events");
            }
        } catch (fetchError) {
            setError(
                fetchError instanceof Error ? fetchError.message : "Failed to load trigger events"
            );
        } finally {
            setEventsLoading(false);
        }
    }, [
        statusFilter,
        sourceFilter,
        integrationFilter,
        triggerFilter,
        agentFilter,
        eventNameFilter,
        entityTypeFilter,
        searchQuery,
        rangeFrom,
        rangeTo
    ]);

    const fetchEventDetail = useCallback(async (eventId: string) => {
        setDetailLoading(true);
        setDetailTab("overview");
        setEventDetail(null);
        setRunDetail(null);
        try {
            const res = await fetch(`${getApiBase()}/api/live/triggers/${eventId}`);
            const data = await res.json();
            if (data.success) setEventDetail(data.event);
            else setError(data.error || "Failed to load trigger event");
        } catch (fetchError) {
            setError(
                fetchError instanceof Error ? fetchError.message : "Failed to load trigger event"
            );
        } finally {
            setDetailLoading(false);
        }
    }, []);

    const fetchRunDetail = useCallback(async (agentSlug: string, runId: string) => {
        setRunDetailLoading(true);
        setRunDetail(null);
        try {
            const res = await fetch(`${getApiBase()}/api/agents/${agentSlug}/runs/${runId}`);
            const data = await res.json();
            if (data.success) setRunDetail(data.run);
        } catch (err) {
            console.error("Failed to fetch run detail:", err);
        } finally {
            setRunDetailLoading(false);
        }
    }, []);

    useEffect(() => {
        Promise.all([fetchFilters(), fetchMetrics(), fetchEvents()]).finally(() =>
            setLoading(false)
        );
    }, [fetchFilters, fetchMetrics, fetchEvents]);

    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(() => {
            fetchMetrics();
            fetchEvents();
        }, 30000);
        return () => clearInterval(interval);
    }, [autoRefresh, fetchMetrics, fetchEvents]);

    useEffect(() => {
        if (loading) return;
        fetchEvents();
    }, [fetchEvents, loading]);

    useEffect(() => {
        if (loading) return;
        fetchFilters();
        fetchMetrics();
    }, [fetchFilters, fetchMetrics, loading]);

    useEffect(() => {
        if (!selectedEvent) return;
        const updated = events.find((e) => e.id === selectedEvent.id);
        if (updated) setSelectedEvent(updated);
    }, [events, selectedEvent]);

    useEffect(() => {
        if (!selectedEvent) return;
        fetchEventDetail(selectedEvent.id);
    }, [fetchEventDetail, selectedEvent]);

    useEffect(() => {
        if (!eventDetail?.run?.id || !eventDetail?.agent?.slug) return;
        fetchRunDetail(eventDetail.agent.slug, eventDetail.run.id);
    }, [eventDetail, fetchRunDetail]);

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
                    {Array.from({ length: 6 }).map((_, i) => (
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
        <div className="space-y-6">
            {/* Header controls */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Badge
                        variant="outline"
                        className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                    >
                        {autoRefresh ? "Auto-refreshing" : "Paused"}
                    </Badge>
                    {lastUpdatedAt && (
                        <span className="text-muted-foreground text-xs">
                            Updated {lastUpdatedAt.toLocaleTimeString()}
                        </span>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            fetchMetrics();
                            fetchEvents();
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
                        {autoRefresh ? "Pause" : "Resume"}
                    </Button>
                </div>
            </div>

            {error && (
                <Card>
                    <CardContent className="py-4 text-sm text-red-500">{error}</CardContent>
                </Card>
            )}

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Events</CardDescription>
                        <CardTitle className="text-2xl">{metrics?.summary.total ?? 0}</CardTitle>
                    </CardHeader>
                </Card>
                {["QUEUED", "RECEIVED", "FILTERED", "SKIPPED", "REJECTED"].map((key) => (
                    <Card key={key}>
                        <CardHeader className="pb-2">
                            <CardDescription>{formatStatusLabel(key)}</CardDescription>
                            <CardTitle className="text-2xl">{statusCounts.get(key) || 0}</CardTitle>
                        </CardHeader>
                    </Card>
                ))}
            </div>

            {/* Filters */}
            <Card className="sticky top-4 z-10">
                <CardContent className="flex flex-col gap-4 py-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <Input
                            placeholder="Search trigger events..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="min-w-[240px] flex-1"
                        />
                        <Select
                            value={sourceFilter}
                            onValueChange={(v) => setSourceFilter(v ?? "all")}
                        >
                            <SelectTrigger className="w-40">
                                <SelectValue placeholder="Source" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Sources</SelectItem>
                                {filters?.sources.map((source) => (
                                    <SelectItem key={source.sourceType} value={source.sourceType}>
                                        {formatStatusLabel(source.sourceType)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={agentFilter}
                            onValueChange={(v) => setAgentFilter(v ?? "all")}
                        >
                            <SelectTrigger className="w-48">
                                <SelectValue placeholder="Agent" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Agents</SelectItem>
                                {filters?.agents
                                    .slice()
                                    .sort((a, b) => a.name.localeCompare(b.name))
                                    .map((agent) => (
                                        <SelectItem key={agent.id} value={agent.id}>
                                            {agent.name}
                                        </SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>
                        <Select value={timeRange} onValueChange={(v) => setTimeRange(v ?? "24h")}>
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
                        {hasActiveFilters && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setSearchQuery("");
                                    setStatusFilter("all");
                                    setSourceFilter("all");
                                    setIntegrationFilter("all");
                                    setTriggerFilter("all");
                                    setAgentFilter("all");
                                    setEventNameFilter("all");
                                    setEntityTypeFilter("all");
                                    setTimeRange("24h");
                                }}
                            >
                                Clear Filters
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Event table + detail panel */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Card>
                    <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <CardTitle>Trigger Events</CardTitle>
                                <CardDescription>
                                    {events.length} shown
                                    {metrics ? ` of ${metrics.summary.total} total events` : ""}
                                </CardDescription>
                            </div>
                            {eventsLoading && (
                                <p className="text-muted-foreground text-xs">Refreshing...</p>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {eventsLoading && events.length === 0 ? (
                            <div className="space-y-3">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <Skeleton key={i} className="h-14 w-full" />
                                ))}
                            </div>
                        ) : events.length === 0 ? (
                            <div className="py-12 text-center">
                                <p className="text-muted-foreground text-lg">
                                    No trigger events match the current filters
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Trigger</TableHead>
                                            <TableHead>Source</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Target</TableHead>
                                            <TableHead>Run</TableHead>
                                            <TableHead className="text-right">Time</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {events.map((eventRow) => {
                                            const isSelected = selectedEvent?.id === eventRow.id;
                                            return (
                                                <TableRow
                                                    key={eventRow.id}
                                                    className={`cursor-pointer ${isSelected ? "bg-muted/50" : ""}`}
                                                    onClick={() => setSelectedEvent(eventRow)}
                                                >
                                                    <TableCell>
                                                        <div>
                                                            <p className="font-medium">
                                                                {eventRow.trigger?.name ||
                                                                    eventRow.eventName ||
                                                                    "Unknown trigger"}
                                                            </p>
                                                            <p className="text-muted-foreground text-xs">
                                                                {eventRow.eventName || "—"}
                                                            </p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            className={getSourceBadgeColor(
                                                                eventRow.sourceType
                                                            )}
                                                        >
                                                            {formatStatusLabel(eventRow.sourceType)}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {eventRow.run ||
                                                        eventRow.workflowRun ||
                                                        eventRow.networkRun ? (
                                                            <Badge
                                                                variant={getRunStatusBadgeVariant(
                                                                    (eventRow.run ||
                                                                        eventRow.workflowRun ||
                                                                        eventRow.networkRun)!.status
                                                                )}
                                                            >
                                                                {formatStatusLabel(
                                                                    (eventRow.run ||
                                                                        eventRow.workflowRun ||
                                                                        eventRow.networkRun)!.status
                                                                )}
                                                            </Badge>
                                                        ) : (
                                                            <Badge
                                                                variant={getEventStatusBadgeVariant(
                                                                    eventRow.status
                                                                )}
                                                            >
                                                                {formatStatusLabel(eventRow.status)}
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {eventRow.agent ? (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    router.push(
                                                                        `/agents/${eventRow.agent!.slug}/overview`
                                                                    );
                                                                }}
                                                                className="hover:text-primary text-sm font-medium"
                                                            >
                                                                {eventRow.agent.name}
                                                            </button>
                                                        ) : (
                                                            <span className="text-muted-foreground">
                                                                —
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-xs">
                                                        {(
                                                            eventRow.run?.id ||
                                                            eventRow.workflowRun?.id ||
                                                            eventRow.networkRun?.id ||
                                                            ""
                                                        ).slice(0, 8) || "—"}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-right">
                                                        <span
                                                            title={new Date(
                                                                eventRow.createdAt
                                                            ).toLocaleString()}
                                                        >
                                                            {formatRelativeTime(eventRow.createdAt)}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Detail panel */}
                <div className="flex flex-col gap-4">
                    {/* Trigger event info card */}
                    <Card>
                        <CardHeader className="space-y-3">
                            <CardTitle className="text-lg">
                                {selectedEvent
                                    ? selectedEvent.trigger?.name ||
                                      selectedEvent.eventName ||
                                      "Event Detail"
                                    : "Event Detail"}
                            </CardTitle>
                            <CardDescription>
                                {selectedEvent
                                    ? `ID: ${selectedEvent.id}`
                                    : "Select an event to inspect."}
                            </CardDescription>
                            {selectedEvent && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-muted/50 rounded-lg p-3">
                                        <p className="text-muted-foreground text-xs">Received</p>
                                        <p className="text-base font-semibold">
                                            {formatRelativeTime(selectedEvent.createdAt)}
                                        </p>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-3">
                                        <p className="text-muted-foreground text-xs">Duration</p>
                                        <p className="text-base font-semibold">
                                            {formatLatency(
                                                selectedEvent.run?.durationMs ||
                                                    selectedEvent.workflowRun?.durationMs ||
                                                    selectedEvent.networkRun?.durationMs
                                            )}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </CardHeader>
                        <CardContent>
                            {!selectedEvent ? (
                                <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 py-12 text-center">
                                    <HugeiconsIcon icon={icons.activity!} className="size-10" />
                                    <p className="text-sm">
                                        Select an event to view its payload and run details.
                                    </p>
                                </div>
                            ) : detailLoading ? (
                                <div className="space-y-4">
                                    <Skeleton className="h-16 w-full" />
                                    <Skeleton className="h-16 w-full" />
                                </div>
                            ) : (
                                <Tabs
                                    defaultValue="overview"
                                    value={detailTab}
                                    onValueChange={(v) => setDetailTab(v ?? "overview")}
                                >
                                    <TabsList className="flex w-full flex-nowrap justify-start gap-2 overflow-x-auto">
                                        <TabsTrigger value="overview" className="shrink-0">
                                            Overview
                                        </TabsTrigger>
                                        <TabsTrigger value="payload" className="shrink-0">
                                            Payload
                                        </TabsTrigger>
                                    </TabsList>
                                    <div className="mt-4">
                                        <TabsContent
                                            value="overview"
                                            className="mt-0 space-y-3 text-sm"
                                        >
                                            {eventDetail && (
                                                <>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-muted-foreground">
                                                            Source
                                                        </span>
                                                        <Badge
                                                            className={getSourceBadgeColor(
                                                                eventDetail.sourceType
                                                            )}
                                                        >
                                                            {formatStatusLabel(
                                                                eventDetail.sourceType
                                                            )}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-muted-foreground">
                                                            Target
                                                        </span>
                                                        <span>
                                                            {eventDetail.agent?.name ||
                                                                eventDetail.workflow?.name ||
                                                                "—"}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-muted-foreground">
                                                            Event
                                                        </span>
                                                        <span>{eventDetail.eventName || "—"}</span>
                                                    </div>
                                                    {eventDetail.run && (
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-muted-foreground">
                                                                Run
                                                            </span>
                                                            <Badge
                                                                variant={getRunStatusBadgeVariant(
                                                                    eventDetail.run.status
                                                                )}
                                                            >
                                                                {eventDetail.run.status}
                                                            </Badge>
                                                        </div>
                                                    )}
                                                    {eventDetail.errorMessage && (
                                                        <>
                                                            <Separator />
                                                            <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-900/30 dark:bg-red-900/10">
                                                                {eventDetail.errorMessage}
                                                            </div>
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </TabsContent>
                                        <TabsContent value="payload" className="mt-0 space-y-4">
                                            {eventDetail && (
                                                <pre className="bg-muted/20 max-h-64 overflow-auto rounded-lg border p-3 text-xs">
                                                    {JSON.stringify(
                                                        eventDetail.payloadJson ||
                                                            eventDetail.payloadPreview ||
                                                            {},
                                                        null,
                                                        2
                                                    )}
                                                </pre>
                                            )}
                                        </TabsContent>
                                    </div>
                                </Tabs>
                            )}
                        </CardContent>
                    </Card>

                    {/* Run detail card - shown when event has an associated run */}
                    {selectedEvent && eventDetail?.run && (
                        <Card className="flex flex-col">
                            <CardHeader className="space-y-2 pb-3">
                                <CardTitle className="text-base">Run Detail</CardTitle>
                                <CardDescription>Run ID: {eventDetail.run.id}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-hidden">
                                <RunDetailPanel
                                    runDetail={runDetail}
                                    loading={runDetailLoading}
                                    inputText={eventDetail.run.inputText}
                                    outputText={eventDetail.run.outputText}
                                    status={eventDetail.run.status}
                                />
                            </CardContent>
                        </Card>
                    )}

                    {/* No run state */}
                    {selectedEvent && !detailLoading && !eventDetail?.run && eventDetail && (
                        <Card>
                            <CardContent className="py-8">
                                <p className="text-muted-foreground text-center text-sm">
                                    No run associated with this event.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Page - Tabs wrapping both views
// ═══════════════════════════════════════════════════════════════════════════════

function AutomationsPageClient() {
    const searchParams = useSearchParams();
    const initialTab = searchParams.get("tab") || "automations";

    return (
        <div className="h-full overflow-y-auto">
            <div className="container mx-auto space-y-6 py-6">
                <div>
                    <h1 className="text-3xl font-bold">Automations</h1>
                    <p className="text-muted-foreground">
                        Manage scheduled jobs, event triggers, and monitor all execution activity.
                    </p>
                </div>

                <Tabs defaultValue={initialTab} className="space-y-6">
                    <TabsList>
                        <TabsTrigger value="automations">Automations</TabsTrigger>
                        <TabsTrigger value="activity">Activity Log</TabsTrigger>
                    </TabsList>

                    <TabsContent value="automations" className="mt-0">
                        <AutomationRegistryTab />
                    </TabsContent>

                    <TabsContent value="activity" className="mt-0">
                        <ActivityLogTab />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

export default function AutomationsPage() {
    return (
        <Suspense fallback={<div className="text-muted-foreground p-6 text-sm">Loading...</div>}>
            <AutomationsPageClient />
        </Suspense>
    );
}
