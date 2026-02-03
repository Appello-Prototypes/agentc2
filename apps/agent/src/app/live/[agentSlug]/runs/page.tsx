"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Badge,
    Button,
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
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface Run {
    id: string;
    agentId: string;
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
    toolCalls?: ToolCall[];
}

interface ToolCall {
    id: string;
    toolKey: string;
    success: boolean;
    durationMs: number | null;
    error: string | null;
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

function formatRelativeTime(dateStr: string): string {
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

export default function LiveAgentRunsPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const agentSlug = params.agentSlug as string;
    const highlightRunId = searchParams.get("runId");

    const [loading, setLoading] = useState(true);
    const [runs, setRuns] = useState<Run[]>([]);
    const [counts, setCounts] = useState<RunCounts | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [sourceFilter, setSourceFilter] = useState<string>("all");
    const [selectedRun, setSelectedRun] = useState<Run | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);

    const fetchRuns = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            params.set("runType", "PROD");
            if (statusFilter !== "all") {
                params.set("status", statusFilter);
            }
            if (sourceFilter !== "all") {
                params.set("source", sourceFilter);
            }

            const res = await fetch(
                `${getApiBase()}/api/agents/${agentSlug}/runs?${params.toString()}`
            );
            const data = await res.json();

            if (data.success) {
                setRuns(data.runs);
                setCounts(data.counts);

                // Auto-select highlighted run
                if (highlightRunId) {
                    const run = data.runs.find((r: Run) => r.id === highlightRunId);
                    if (run) {
                        setSelectedRun(run);
                    }
                }
            }
        } catch (error) {
            console.error("Failed to fetch runs:", error);
        } finally {
            setLoading(false);
        }
    }, [agentSlug, statusFilter, sourceFilter, highlightRunId]);

    useEffect(() => {
        fetchRuns();
    }, [fetchRuns]);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(fetchRuns, 30000);
        return () => clearInterval(interval);
    }, [autoRefresh, fetchRuns]);

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-64" />
                <div className="grid grid-cols-6 gap-4">
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
                    <h1 className="text-2xl font-bold">Production Runs</h1>
                    <p className="text-muted-foreground">
                        Live runs from Slack, WhatsApp, Voice, Telegram, and ElevenLabs
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge
                        variant="outline"
                        className={
                            autoRefresh
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                : ""
                        }
                    >
                        {autoRefresh ? "Auto-refreshing" : "Paused"}
                    </Badge>
                    <Button
                        variant={autoRefresh ? "default" : "outline"}
                        size="sm"
                        onClick={() => setAutoRefresh(!autoRefresh)}
                    >
                        {autoRefresh ? "Pause" : "Resume"}
                    </Button>
                </div>
            </div>

            {/* Status Counts */}
            {counts && (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
                    <Card
                        className={`cursor-pointer ${statusFilter === "all" ? "ring-primary ring-2" : ""}`}
                        onClick={() => setStatusFilter("all")}
                    >
                        <CardHeader className="pb-2">
                            <CardDescription>Total</CardDescription>
                            <CardTitle className="text-xl">
                                {counts.total.toLocaleString()}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card
                        className={`cursor-pointer ${statusFilter === "completed" ? "ring-primary ring-2" : ""}`}
                        onClick={() => setStatusFilter("completed")}
                    >
                        <CardHeader className="pb-2">
                            <CardDescription>Completed</CardDescription>
                            <CardTitle className="text-xl text-green-600">
                                {counts.completed.toLocaleString()}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card
                        className={`cursor-pointer ${statusFilter === "failed" ? "ring-primary ring-2" : ""}`}
                        onClick={() => setStatusFilter("failed")}
                    >
                        <CardHeader className="pb-2">
                            <CardDescription>Failed</CardDescription>
                            <CardTitle className="text-xl text-red-600">
                                {counts.failed.toLocaleString()}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card
                        className={`cursor-pointer ${statusFilter === "running" ? "ring-primary ring-2" : ""}`}
                        onClick={() => setStatusFilter("running")}
                    >
                        <CardHeader className="pb-2">
                            <CardDescription>Running</CardDescription>
                            <CardTitle className="text-xl text-blue-600">
                                {counts.running.toLocaleString()}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card
                        className={`cursor-pointer ${statusFilter === "queued" ? "ring-primary ring-2" : ""}`}
                        onClick={() => setStatusFilter("queued")}
                    >
                        <CardHeader className="pb-2">
                            <CardDescription>Queued</CardDescription>
                            <CardTitle className="text-xl text-yellow-600">
                                {counts.queued.toLocaleString()}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card
                        className={`cursor-pointer ${statusFilter === "cancelled" ? "ring-primary ring-2" : ""}`}
                        onClick={() => setStatusFilter("cancelled")}
                    >
                        <CardHeader className="pb-2">
                            <CardDescription>Cancelled</CardDescription>
                            <CardTitle className="text-xl text-gray-600">
                                {counts.cancelled.toLocaleString()}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-4">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
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
                <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v ?? "all")}>
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
            {runs.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-muted-foreground text-lg">No production runs found</p>
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
                                <TableHead>Channel</TableHead>
                                <TableHead>Input</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Duration</TableHead>
                                <TableHead className="text-right">Tokens</TableHead>
                                <TableHead className="text-right">Cost</TableHead>
                                <TableHead>Tools</TableHead>
                                <TableHead>Time</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {runs.map((run) => (
                                <TableRow
                                    key={run.id}
                                    className={`cursor-pointer ${highlightRunId === run.id ? "bg-accent" : ""}`}
                                    onClick={() => setSelectedRun(run)}
                                >
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
                                        {run.durationMs ? formatLatency(run.durationMs) : "-"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {run.totalTokens?.toLocaleString() || "-"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {run.costUsd ? `$${run.costUsd.toFixed(4)}` : "-"}
                                    </TableCell>
                                    <TableCell>
                                        {(run.toolCalls?.length ?? 0) > 0 && (
                                            <Badge variant="outline" className="text-xs">
                                                {run.toolCalls?.length} tools
                                            </Badge>
                                        )}
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

            {/* Run Detail Dialog */}
            <Dialog open={!!selectedRun} onOpenChange={() => setSelectedRun(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            Run Details
                            {selectedRun && (
                                <Badge className={getSourceBadgeColor(selectedRun.source)}>
                                    {selectedRun.source || "unknown"}
                                </Badge>
                            )}
                        </DialogTitle>
                        <DialogDescription>{selectedRun?.id}</DialogDescription>
                    </DialogHeader>
                    {selectedRun && (
                        <div className="space-y-4">
                            {/* Status and Metrics */}
                            <div className="grid grid-cols-4 gap-4">
                                <div>
                                    <p className="text-muted-foreground text-sm">Status</p>
                                    <Badge variant={getStatusBadgeVariant(selectedRun.status)}>
                                        {selectedRun.status}
                                    </Badge>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-sm">Duration</p>
                                    <p className="font-medium">
                                        {selectedRun.durationMs
                                            ? formatLatency(selectedRun.durationMs)
                                            : "-"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-sm">Tokens</p>
                                    <p className="font-medium">
                                        {selectedRun.totalTokens?.toLocaleString() || "-"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-sm">Cost</p>
                                    <p className="font-medium">
                                        {selectedRun.costUsd
                                            ? `$${selectedRun.costUsd.toFixed(4)}`
                                            : "-"}
                                    </p>
                                </div>
                            </div>

                            {/* Session Info */}
                            {(selectedRun.sessionId || selectedRun.threadId) && (
                                <div className="grid grid-cols-2 gap-4">
                                    {selectedRun.sessionId && (
                                        <div>
                                            <p className="text-muted-foreground text-sm">Session</p>
                                            <p className="truncate font-mono text-xs">
                                                {selectedRun.sessionId}
                                            </p>
                                        </div>
                                    )}
                                    {selectedRun.threadId && (
                                        <div>
                                            <p className="text-muted-foreground text-sm">Thread</p>
                                            <p className="truncate font-mono text-xs">
                                                {selectedRun.threadId}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Input */}
                            <div>
                                <p className="text-muted-foreground mb-1 text-sm">Input</p>
                                <div className="bg-muted h-24 overflow-auto rounded-md p-3">
                                    <pre className="text-sm whitespace-pre-wrap">
                                        {selectedRun.inputText}
                                    </pre>
                                </div>
                            </div>

                            {/* Output */}
                            <div>
                                <p className="text-muted-foreground mb-1 text-sm">Output</p>
                                <div className="bg-muted h-32 overflow-auto rounded-md p-3">
                                    <pre className="text-sm whitespace-pre-wrap">
                                        {selectedRun.outputText || "No output"}
                                    </pre>
                                </div>
                            </div>

                            {/* Tool Calls */}
                            {(selectedRun.toolCalls?.length ?? 0) > 0 && (
                                <div>
                                    <p className="text-muted-foreground mb-2 text-sm">
                                        Tool Calls ({selectedRun.toolCalls?.length})
                                    </p>
                                    <div className="space-y-2">
                                        {selectedRun.toolCalls?.map((tc) => (
                                            <div
                                                key={tc.id}
                                                className="bg-muted flex items-center justify-between rounded-md p-2"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className={`size-2 rounded-full ${tc.success ? "bg-green-500" : "bg-red-500"}`}
                                                    />
                                                    <span className="font-mono text-sm">
                                                        {tc.toolKey}
                                                    </span>
                                                </div>
                                                <div className="text-muted-foreground text-sm">
                                                    {tc.durationMs
                                                        ? formatLatency(tc.durationMs)
                                                        : "-"}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Model Info */}
                            <div className="grid grid-cols-2 gap-4 border-t pt-4">
                                <div>
                                    <p className="text-muted-foreground text-sm">Model</p>
                                    <p className="font-mono text-sm">
                                        {selectedRun.modelProvider}/{selectedRun.modelName}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-sm">Token Breakdown</p>
                                    <p className="text-sm">
                                        {selectedRun.promptTokens?.toLocaleString() || 0} prompt /{" "}
                                        {selectedRun.completionTokens?.toLocaleString() || 0}{" "}
                                        completion
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
