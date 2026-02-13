"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
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
    Skeleton
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";
import { getDateRange, type TimeRangeOption } from "@/lib/monitoring";

interface NetworkRunSummary {
    id: string;
    status: string;
    startedAt: string;
    environment?: string | null;
    triggerType?: string | null;
}

interface NetworkRunStep {
    id: string;
    stepNumber: number;
    stepType: string;
    primitiveType?: string | null;
    primitiveId?: string | null;
    routingDecision?: unknown;
    inputJson?: unknown;
    outputJson?: unknown;
    errorJson?: unknown;
    status: string;
    durationMs?: number | null;
    tokens?: number | null;
    costUsd?: number | null;
}

interface NetworkRunDetail {
    id: string;
    status: string;
    inputText: string;
    outputText?: string | null;
    outputJson?: unknown;
    environment?: string | null;
    triggerType?: string | null;
    steps: NetworkRunStep[];
}

const formatDuration = (durationMs?: number | null) => {
    if (!durationMs || durationMs <= 0) return "--";
    if (durationMs < 1000) return `${Math.round(durationMs)}ms`;
    const seconds = durationMs / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.round(seconds % 60);
    return `${minutes}m ${remainder}s`;
};

const formatLabel = (value?: string | null) => {
    if (!value) return "--";
    return value
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
};

const statusVariant = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized === "completed") return "default";
    if (normalized === "failed" || normalized === "cancelled") return "destructive";
    if (normalized === "running" || normalized === "queued") return "outline";
    return "secondary";
};

export default function NetworkTracesPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const networkSlug = params.networkSlug as string;
    const [runs, setRuns] = useState<NetworkRunSummary[]>([]);
    const [selectedRun, setSelectedRun] = useState<NetworkRunDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState("all");
    const [environmentFilter, setEnvironmentFilter] = useState("all");
    const [triggerFilter, setTriggerFilter] = useState("all");
    const [timeRange, setTimeRange] = useState<TimeRangeOption>("7d");
    const [searchQuery, setSearchQuery] = useState("");
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

    const { from: rangeFrom, to: rangeTo } = useMemo(() => {
        return getDateRange(timeRange);
    }, [timeRange]);

    const fetchRuns = useCallback(
        async (isPolling = false) => {
            try {
                if (!isPolling) {
                    setLoading(true);
                }
                const params = new URLSearchParams();
                params.set("limit", "100");
                if (statusFilter !== "all") {
                    params.set("status", statusFilter);
                }
                if (environmentFilter !== "all") {
                    params.set("environment", environmentFilter);
                }
                if (triggerFilter !== "all") {
                    params.set("triggerType", triggerFilter);
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
                const res = await fetch(
                    `${getApiBase()}/api/networks/${networkSlug}/runs?${params.toString()}`
                );
                const data = await res.json();
                setRuns(data.runs || []);
                setLastUpdatedAt(new Date());
            } catch (error) {
                console.error("Failed to load network runs:", error);
                setRuns([]);
            } finally {
                if (!isPolling) {
                    setLoading(false);
                }
            }
        },
        [
            networkSlug,
            statusFilter,
            environmentFilter,
            triggerFilter,
            searchQuery,
            rangeFrom,
            rangeTo
        ]
    );

    const loadRun = useCallback(
        async (runId: string, silent = false) => {
            try {
                if (!silent) {
                    setDetailLoading(true);
                }
                const res = await fetch(
                    `${getApiBase()}/api/networks/${networkSlug}/runs/${runId}`
                );
                const data = await res.json();
                setSelectedRun(data.run || null);
            } catch (error) {
                console.error("Failed to load network trace:", error);
                setSelectedRun(null);
            } finally {
                if (!silent) {
                    setDetailLoading(false);
                }
            }
        },
        [networkSlug]
    );

    useEffect(() => {
        fetchRuns();
    }, [fetchRuns]);

    useEffect(() => {
        const initialRunId = searchParams.get("runId");
        if (initialRunId) {
            loadRun(initialRunId);
        }
    }, [searchParams, loadRun]);

    useEffect(() => {
        if (runs.length === 0) {
            setSelectedRun(null);
            return;
        }
        const hasSelection = selectedRun && runs.some((run) => run.id === selectedRun.id);
        if (!hasSelection) {
            loadRun(runs[0].id, true);
        }
    }, [runs, selectedRun, loadRun]);

    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(() => {
            fetchRuns(true);
            if (selectedRun?.id) {
                loadRun(selectedRun.id, true);
            }
        }, 30000);
        return () => clearInterval(interval);
    }, [autoRefresh, fetchRuns, loadRun, selectedRun?.id]);

    const filteredRuns = useMemo(() => {
        return runs.filter((run) => {
            const normalizedStatus = run.status.toLowerCase();
            if (statusFilter !== "all" && normalizedStatus !== statusFilter) {
                return false;
            }
            if (
                environmentFilter !== "all" &&
                run.environment?.toLowerCase() !== environmentFilter
            ) {
                return false;
            }
            if (triggerFilter !== "all" && run.triggerType?.toLowerCase() !== triggerFilter) {
                return false;
            }
            if (!searchQuery) return true;
            return run.id.toLowerCase().includes(searchQuery.toLowerCase());
        });
    }, [runs, statusFilter, environmentFilter, triggerFilter, searchQuery]);

    const hasActiveFilters = useMemo(() => {
        return (
            searchQuery.length > 0 ||
            statusFilter !== "all" ||
            environmentFilter !== "all" ||
            triggerFilter !== "all" ||
            timeRange !== "7d"
        );
    }, [searchQuery, statusFilter, environmentFilter, triggerFilter, timeRange]);

    const clearFilters = () => {
        setSearchQuery("");
        setStatusFilter("all");
        setEnvironmentFilter("all");
        setTriggerFilter("all");
        setTimeRange("7d");
    };

    const handleRefresh = () => {
        fetchRuns();
        if (selectedRun?.id) {
            loadRun(selectedRun.id, true);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold">Traces</h1>
                    <p className="text-muted-foreground text-sm">
                        Inspect routing decisions and step-by-step outputs.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAutoRefresh((prev) => !prev)}
                    >
                        {autoRefresh ? "Pause refresh" : "Resume refresh"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleRefresh}>
                        Refresh
                    </Button>
                </div>
            </div>
            {lastUpdatedAt && (
                <div className="text-muted-foreground text-xs">
                    Last updated {lastUpdatedAt.toLocaleTimeString()}
                </div>
            )}

            <Card>
                <CardContent className="flex flex-wrap items-center gap-3 py-4">
                    <Input
                        placeholder="Search runs..."
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        className="min-w-0 flex-1 sm:min-w-[220px]"
                    />
                    <Select
                        value={statusFilter}
                        onValueChange={(value) => setStatusFilter(value ?? "all")}
                    >
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All statuses</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="running">Running</SelectItem>
                            <SelectItem value="queued">Queued</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select
                        value={environmentFilter}
                        onValueChange={(value) => setEnvironmentFilter(value ?? "all")}
                    >
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="Environment" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All environments</SelectItem>
                            <SelectItem value="development">Development</SelectItem>
                            <SelectItem value="staging">Staging</SelectItem>
                            <SelectItem value="production">Production</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select
                        value={triggerFilter}
                        onValueChange={(value) => setTriggerFilter(value ?? "all")}
                    >
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="Trigger" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All triggers</SelectItem>
                            <SelectItem value="manual">Manual</SelectItem>
                            <SelectItem value="api">API</SelectItem>
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                            <SelectItem value="webhook">Webhook</SelectItem>
                            <SelectItem value="tool">Tool</SelectItem>
                            <SelectItem value="test">Test</SelectItem>
                            <SelectItem value="retry">Retry</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select
                        value={timeRange}
                        onValueChange={(value) => setTimeRange((value as TimeRangeOption) ?? "7d")}
                    >
                        <SelectTrigger className="w-32">
                            <SelectValue placeholder="Range" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="24h">Last 24h</SelectItem>
                            <SelectItem value="7d">Last 7d</SelectItem>
                            <SelectItem value="30d">Last 30d</SelectItem>
                            <SelectItem value="90d">Last 90d</SelectItem>
                            <SelectItem value="all">All time</SelectItem>
                        </SelectContent>
                    </Select>
                    {hasActiveFilters && (
                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                            Clear filters
                        </Button>
                    )}
                </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                <Card>
                    <CardHeader>
                        <CardTitle>Runs</CardTitle>
                        <CardDescription>Select a run to review the trace.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {loading ? (
                            <div className="space-y-2">
                                {[1, 2, 3, 4].map((item) => (
                                    <Skeleton key={item} className="h-16 w-full" />
                                ))}
                            </div>
                        ) : filteredRuns.length === 0 ? (
                            <div className="text-muted-foreground text-sm">No runs yet.</div>
                        ) : (
                            <div className="space-y-2">
                                {filteredRuns.map((run) => {
                                    const isSelected = selectedRun?.id === run.id;
                                    return (
                                        <button
                                            key={run.id}
                                            className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                                                isSelected
                                                    ? "border-primary bg-muted/60"
                                                    : "hover:bg-muted"
                                            }`}
                                            onClick={() => loadRun(run.id)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="font-medium">
                                                    {run.id.slice(0, 8)}
                                                </div>
                                                <Badge variant={statusVariant(run.status)}>
                                                    {run.status.toLowerCase()}
                                                </Badge>
                                            </div>
                                            <div className="text-muted-foreground mt-1 text-xs">
                                                {new Date(run.startedAt).toLocaleString()}
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                                                {run.environment && (
                                                    <Badge variant="outline">
                                                        {formatLabel(run.environment)}
                                                    </Badge>
                                                )}
                                                {run.triggerType && (
                                                    <Badge variant="outline">
                                                        {formatLabel(run.triggerType)}
                                                    </Badge>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Trace detail</CardTitle>
                        <CardDescription>Inspect each routing step.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {detailLoading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-8 w-1/2" />
                                <Skeleton className="h-32 w-full" />
                                <Skeleton className="h-32 w-full" />
                            </div>
                        ) : !selectedRun ? (
                            <div className="text-muted-foreground text-sm">
                                Select a run to view steps.
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-wrap gap-2 text-xs">
                                    {selectedRun.environment && (
                                        <Badge variant="outline">
                                            {formatLabel(selectedRun.environment)}
                                        </Badge>
                                    )}
                                    {selectedRun.triggerType && (
                                        <Badge variant="outline">
                                            {formatLabel(selectedRun.triggerType)}
                                        </Badge>
                                    )}
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="rounded-md border p-3 text-sm">
                                        <div className="text-muted-foreground text-xs">Input</div>
                                        <pre className="mt-2 max-h-48 overflow-auto text-xs whitespace-pre-wrap">
                                            {selectedRun.inputText}
                                        </pre>
                                    </div>
                                    <div className="rounded-md border p-3 text-sm">
                                        <div className="text-muted-foreground text-xs">Output</div>
                                        <pre className="mt-2 max-h-48 overflow-auto text-xs whitespace-pre-wrap">
                                            {selectedRun.outputText ||
                                                JSON.stringify(selectedRun.outputJson, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                                <Accordion className="w-full">
                                    {selectedRun.steps.map((step) => (
                                        <AccordionItem key={step.id} value={step.id}>
                                            <AccordionTrigger className="text-sm">
                                                <div className="flex w-full flex-wrap items-center justify-between gap-2 text-left">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">
                                                            Step {step.stepNumber} · {step.stepType}
                                                        </span>
                                                        {step.primitiveType && (
                                                            <span className="text-muted-foreground text-xs">
                                                                {step.primitiveType}{" "}
                                                                {step.primitiveId
                                                                    ? `· ${step.primitiveId}`
                                                                    : ""}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Badge
                                                            variant={statusVariant(step.status)}
                                                            className="text-xs"
                                                        >
                                                            {step.status.toLowerCase()}
                                                        </Badge>
                                                        <span className="text-muted-foreground text-xs">
                                                            {formatDuration(step.durationMs)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <div className="grid gap-3 md:grid-cols-2">
                                                    <div className="rounded-md border p-3">
                                                        <div className="text-muted-foreground text-xs">
                                                            Input
                                                        </div>
                                                        <pre className="mt-2 max-h-56 overflow-auto text-xs whitespace-pre-wrap">
                                                            {JSON.stringify(
                                                                step.inputJson,
                                                                null,
                                                                2
                                                            )}
                                                        </pre>
                                                    </div>
                                                    <div className="rounded-md border p-3">
                                                        <div className="text-muted-foreground text-xs">
                                                            Output
                                                        </div>
                                                        <pre className="mt-2 max-h-56 overflow-auto text-xs whitespace-pre-wrap">
                                                            {JSON.stringify(
                                                                step.outputJson,
                                                                null,
                                                                2
                                                            )}
                                                        </pre>
                                                    </div>
                                                    {Boolean(step.routingDecision) && (
                                                        <div className="col-span-2 rounded-md border p-3">
                                                            <div className="text-muted-foreground text-xs">
                                                                Routing decision
                                                            </div>
                                                            <pre className="mt-2 max-h-56 overflow-auto text-xs whitespace-pre-wrap">
                                                                {JSON.stringify(
                                                                    step.routingDecision,
                                                                    null,
                                                                    2
                                                                )}
                                                            </pre>
                                                        </div>
                                                    )}
                                                    {Boolean(step.errorJson) && (
                                                        <div className="border-destructive/40 text-destructive col-span-2 rounded-md border p-3">
                                                            <div className="text-xs">Error</div>
                                                            <pre className="mt-2 max-h-56 overflow-auto text-xs whitespace-pre-wrap">
                                                                {JSON.stringify(
                                                                    step.errorJson,
                                                                    null,
                                                                    2
                                                                )}
                                                            </pre>
                                                        </div>
                                                    )}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
