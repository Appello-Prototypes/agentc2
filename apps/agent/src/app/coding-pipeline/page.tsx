"use client";

import { useCallback, useEffect, useState } from "react";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Separator,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface PipelineRun {
    id: string;
    sourceType: string;
    sourceId: string;
    repository: string;
    baseBranch: string;
    targetBranch: string | null;
    cursorAgentId: string | null;
    prNumber: number | null;
    prUrl: string | null;
    riskLevel: string | null;
    variant: string;
    totalCostUsd: number | null;
    status: string;
    createdAt: string;
    updatedAt: string;
}

interface PipelineStats {
    total: number;
    running: number;
    completed: number;
    failed: number;
    avgDurationMinutes: number | null;
}

const STATUS_COLORS: Record<string, string> = {
    running: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    awaiting_plan_approval: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    coding: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    verifying: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    awaiting_pr_review: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    merged: "bg-green-500/10 text-green-400 border-green-500/20",
    deployed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    failed: "bg-red-500/10 text-red-400 border-red-500/20"
};

const RISK_COLORS: Record<string, string> = {
    trivial: "bg-gray-500/10 text-gray-400",
    low: "bg-green-500/10 text-green-400",
    medium: "bg-amber-500/10 text-amber-400",
    high: "bg-orange-500/10 text-orange-400",
    critical: "bg-red-500/10 text-red-400"
};

function formatStatus(s: string) {
    return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}

export default function CodingPipelinePage() {
    const [runs, setRuns] = useState<PipelineRun[]>([]);
    const [stats, setStats] = useState<PipelineStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>("all");

    const fetchRuns = useCallback(async () => {
        try {
            const base = getApiBase();
            const params = new URLSearchParams();
            if (filter !== "all") params.set("status", filter);

            const res = await fetch(`${base}/api/coding-pipeline/runs?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setRuns(data.runs || []);
                setStats(data.stats || null);
            }
        } catch (err) {
            console.error("Failed to fetch pipeline runs:", err);
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        fetchRuns();
        const interval = setInterval(fetchRuns, 10_000);
        return () => clearInterval(interval);
    }, [fetchRuns]);

    const activeRuns = runs.filter((r) =>
        ["running", "awaiting_plan_approval", "coding", "verifying", "awaiting_pr_review"].includes(
            r.status
        )
    );

    return (
        <div className="mx-auto max-w-7xl space-y-6 p-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Coding Pipeline</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    Autonomous SDLC pipeline — ticket to deployment
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-muted-foreground text-xs font-medium">
                            Total Runs
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-8 w-16" />
                        ) : (
                            <div className="text-2xl font-bold">{stats?.total ?? 0}</div>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-muted-foreground text-xs font-medium">
                            Active
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-8 w-16" />
                        ) : (
                            <div className="text-2xl font-bold text-blue-500">
                                {stats?.running ?? 0}
                            </div>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-muted-foreground text-xs font-medium">
                            Completed
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-8 w-16" />
                        ) : (
                            <div className="text-2xl font-bold text-green-500">
                                {stats?.completed ?? 0}
                            </div>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-muted-foreground text-xs font-medium">
                            Failed
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-8 w-16" />
                        ) : (
                            <div className="text-2xl font-bold text-red-500">
                                {stats?.failed ?? 0}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Active Runs */}
            {activeRuns.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Active Runs</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {activeRuns.map((run) => (
                            <div
                                key={run.id}
                                className="bg-muted/50 flex items-center justify-between rounded-lg p-3"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <Badge
                                            variant="outline"
                                            className={STATUS_COLORS[run.status] || ""}
                                        >
                                            {formatStatus(run.status)}
                                        </Badge>
                                        <span className="text-sm font-medium">
                                            {run.sourceType === "support_ticket"
                                                ? "Ticket"
                                                : run.sourceType === "backlog_task"
                                                  ? "Task"
                                                  : "Issue"}{" "}
                                            #{run.sourceId.slice(0, 8)}
                                        </span>
                                        <Badge variant="secondary" className="text-[10px]">
                                            {run.variant}
                                        </Badge>
                                    </div>
                                    <p className="text-muted-foreground mt-1 truncate text-xs">
                                        {run.repository}
                                    </p>
                                </div>
                                <span className="text-muted-foreground text-xs">
                                    {formatRelativeTime(run.createdAt)}
                                </span>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            <Separator />

            {/* Filter */}
            <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">Filter:</span>
                {["all", "running", "merged", "deployed", "failed"].map((f) => (
                    <Button
                        key={f}
                        variant={filter === f ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilter(f)}
                    >
                        {f === "all" ? "All" : formatStatus(f)}
                    </Button>
                ))}
            </div>

            {/* Runs Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Status</TableHead>
                                <TableHead>Source</TableHead>
                                <TableHead>Repository</TableHead>
                                <TableHead>Branch</TableHead>
                                <TableHead>Risk</TableHead>
                                <TableHead>PR</TableHead>
                                <TableHead>Cost</TableHead>
                                <TableHead>Started</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 8 }).map((_, j) => (
                                            <TableCell key={j}>
                                                <Skeleton className="h-4 w-full" />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : runs.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={8}
                                        className="text-muted-foreground py-12 text-center"
                                    >
                                        No pipeline runs found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                runs.map((run) => (
                                    <TableRow key={run.id}>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={STATUS_COLORS[run.status] || ""}
                                            >
                                                {formatStatus(run.status)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-xs">
                                                <span className="font-medium">
                                                    {run.sourceType === "support_ticket"
                                                        ? "Ticket"
                                                        : run.sourceType === "backlog_task"
                                                          ? "Task"
                                                          : run.sourceType === "github_issue"
                                                            ? "Issue"
                                                            : "Manual"}
                                                </span>
                                                <br />
                                                <span className="text-muted-foreground font-mono">
                                                    {run.sourceId.slice(0, 12)}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate text-xs">
                                            {run.repository
                                                .replace(/^https?:\/\/github\.com\//, "")
                                                .replace(/\.git$/, "")}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">
                                            {run.targetBranch || "—"}
                                        </TableCell>
                                        <TableCell>
                                            {run.riskLevel ? (
                                                <Badge
                                                    variant="outline"
                                                    className={RISK_COLORS[run.riskLevel] || ""}
                                                >
                                                    {run.riskLevel}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">
                                                    —
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {run.prUrl ? (
                                                <a
                                                    href={run.prUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-blue-500 hover:underline"
                                                >
                                                    #{run.prNumber}
                                                </a>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">
                                                    —
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            {run.totalCostUsd != null
                                                ? `$${run.totalCostUsd.toFixed(2)}`
                                                : "—"}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-xs">
                                            {formatRelativeTime(run.createdAt)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
