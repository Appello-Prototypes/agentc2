"use client";

import { Fragment, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
}

interface TriggerMetrics {
    summary: {
        total: number;
        statuses: Array<{ status: string; count: number }>;
        sources: Array<{ sourceType: string; count: number }>;
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

function formatStatusLabel(value: string | null): string {
    if (!value) return "-";
    return value
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatLatency(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
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
        default:
            return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
    }
}

function TriggerMonitoringClient() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialTriggerId = searchParams.get("triggerId") || "all";

    const [loading, setLoading] = useState(true);
    const [eventsLoading, setEventsLoading] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [metrics, setMetrics] = useState<TriggerMetrics | null>(null);
    const [filters, setFilters] = useState<TriggerFilters | null>(null);
    const [events, setEvents] = useState<TriggerEventRow[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<TriggerEventRow | null>(null);
    const [eventDetail, setEventDetail] = useState<TriggerEventDetail | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

    const [statusFilter, setStatusFilter] = useState("all");
    const [sourceFilter, setSourceFilter] = useState("all");
    const [integrationFilter, setIntegrationFilter] = useState("all");
    const [triggerFilter, setTriggerFilter] = useState(initialTriggerId);
    const [agentFilter, setAgentFilter] = useState("all");
    const [eventNameFilter, setEventNameFilter] = useState("all");
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
        timeRange !== "24h";

    const fetchFilters = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (rangeFrom) {
                params.set("from", rangeFrom.toISOString());
            }
            if (rangeTo) {
                params.set("to", rangeTo.toISOString());
            }
            const res = await fetch(
                `${getApiBase()}/api/live/triggers/filters?${params.toString()}`
            );
            const data = await res.json();
            if (data.success) {
                setFilters(data.filters);
            } else {
                setError(data.error || "Failed to load filters");
            }
        } catch (fetchError) {
            setError(fetchError instanceof Error ? fetchError.message : "Failed to load filters");
        }
    }, [rangeFrom, rangeTo]);

    const fetchMetrics = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (rangeFrom) {
                params.set("from", rangeFrom.toISOString());
            }
            if (rangeTo) {
                params.set("to", rangeTo.toISOString());
            }
            const res = await fetch(
                `${getApiBase()}/api/live/triggers/metrics?${params.toString()}`
            );
            const data = await res.json();
            if (data.success) {
                setMetrics(data);
            } else {
                setError(data.error || "Failed to load metrics");
            }
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
        searchQuery,
        rangeFrom,
        rangeTo
    ]);

    const fetchEventDetail = useCallback(async (eventId: string) => {
        setDetailLoading(true);
        setDetailTab("overview");
        setEventDetail(null);
        try {
            const res = await fetch(`${getApiBase()}/api/live/triggers/${eventId}`);
            const data = await res.json();
            if (data.success) {
                setEventDetail(data.event);
            } else {
                setError(data.error || "Failed to load trigger event");
            }
        } catch (fetchError) {
            setError(
                fetchError instanceof Error ? fetchError.message : "Failed to load trigger event"
            );
        } finally {
            setDetailLoading(false);
        }
    }, []);

    useEffect(() => {
        Promise.all([fetchFilters(), fetchMetrics(), fetchEvents()]).finally(() => {
            setLoading(false);
        });
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
        const updated = events.find((eventRow) => eventRow.id === selectedEvent.id);
        if (updated) {
            setSelectedEvent(updated);
        }
    }, [events, selectedEvent]);

    useEffect(() => {
        if (!selectedEvent) return;
        fetchEventDetail(selectedEvent.id);
    }, [fetchEventDetail, selectedEvent]);

    const handleRowClick = (eventRow: TriggerEventRow) => {
        setSelectedEvent(eventRow);
    };

    const handleAgentClick = (agentSlug?: string | null) => {
        if (!agentSlug) return;
        router.push(`/agents/${agentSlug}/overview`);
    };

    if (loading) {
        return (
            <div className="container mx-auto space-y-6 py-6">
                <Skeleton className="h-10 w-64" />
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
        <div className="container mx-auto space-y-6 py-6">
            {/* Header - matches Live Runs pattern */}
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold">Trigger Monitoring</h1>
                        <Badge
                            variant="outline"
                            className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                        >
                            {autoRefresh ? "Auto-refreshing" : "Paused"}
                        </Badge>
                    </div>
                    <p className="text-muted-foreground">
                        Track every trigger event and verify execution outcomes.
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
                        {autoRefresh ? "Pause Auto-refresh" : "Resume Auto-refresh"}
                    </Button>
                </div>
            </div>

            {error && (
                <Card>
                    <CardContent className="py-4 text-sm text-red-500">{error}</CardContent>
                </Card>
            )}

            {/* Metrics cards - matches Live Runs CardHeader pattern */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Events</CardDescription>
                        <CardTitle className="text-2xl">{metrics?.summary.total ?? 0}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Queued</CardDescription>
                        <CardTitle className="text-2xl text-blue-600">
                            {statusCounts.get("QUEUED") || 0}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Filtered</CardDescription>
                        <CardTitle className="text-2xl">
                            {statusCounts.get("FILTERED") || 0}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Skipped</CardDescription>
                        <CardTitle className="text-2xl text-yellow-600">
                            {statusCounts.get("SKIPPED") || 0}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Rejected</CardDescription>
                        <CardTitle className="text-2xl text-red-600">
                            {statusCounts.get("REJECTED") || 0}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>No Match</CardDescription>
                        <CardTitle className="text-2xl">
                            {statusCounts.get("NO_MATCH") || 0}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Filters bar - matches Live Runs sticky inline pattern */}
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
                            value={statusFilter}
                            onValueChange={(value) => setStatusFilter(value ?? "all")}
                        >
                            <SelectTrigger className="w-40">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                {filters?.statuses.map((status) => (
                                    <SelectItem key={status.status} value={status.status}>
                                        {formatStatusLabel(status.status)}
                                    </SelectItem>
                                ))}
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
                                {filters?.sources.map((source) => (
                                    <SelectItem key={source.sourceType} value={source.sourceType}>
                                        {formatStatusLabel(source.sourceType)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={integrationFilter}
                            onValueChange={(value) => setIntegrationFilter(value ?? "all")}
                        >
                            <SelectTrigger className="w-44">
                                <SelectValue placeholder="Integration" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Integrations</SelectItem>
                                {filters?.integrations.map((integration) => (
                                    <SelectItem
                                        key={integration.integrationKey || "unknown"}
                                        value={integration.integrationKey || "unknown"}
                                    >
                                        {integration.integrationKey || "Unknown"}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={triggerFilter}
                            onValueChange={(value) => setTriggerFilter(value ?? "all")}
                        >
                            <SelectTrigger className="w-48">
                                <SelectValue placeholder="Trigger" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Triggers</SelectItem>
                                {filters?.triggers.map((trigger) => (
                                    <SelectItem key={trigger.id} value={trigger.id}>
                                        {trigger.name}
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
                        <Select
                            value={eventNameFilter}
                            onValueChange={(value) => setEventNameFilter(value ?? "all")}
                        >
                            <SelectTrigger className="w-44">
                                <SelectValue placeholder="Event Name" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Events</SelectItem>
                                {filters?.eventNames.map((eventName) => (
                                    <SelectItem
                                        key={eventName.eventName || "unknown"}
                                        value={eventName.eventName || "unknown"}
                                    >
                                        {eventName.eventName || "Unknown"}
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
                                    setTimeRange("24h");
                                }}
                            >
                                Clear Filters
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Status badge row - matches Live Runs runCounts badges */}
            <div className="flex flex-wrap gap-2">
                <Badge
                    variant={statusFilter === "all" ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setStatusFilter("all")}
                >
                    Total {metrics?.summary.total ?? 0}
                </Badge>
                {[
                    { label: "Queued", key: "QUEUED", filterValue: "QUEUED" },
                    { label: "Received", key: "RECEIVED", filterValue: "RECEIVED" },
                    { label: "Filtered", key: "FILTERED", filterValue: "FILTERED" },
                    { label: "Skipped", key: "SKIPPED", filterValue: "SKIPPED" },
                    {
                        label: "Rejected",
                        key: "REJECTED",
                        filterValue: "REJECTED",
                        destructive: true
                    },
                    { label: "No Match", key: "NO_MATCH", filterValue: "NO_MATCH" },
                    { label: "Error", key: "ERROR", filterValue: "ERROR", destructive: true }
                ]
                    .filter((item) => (statusCounts.get(item.key) || 0) > 0)
                    .map((item) => (
                        <Badge
                            key={item.key}
                            variant={
                                statusFilter === item.filterValue
                                    ? item.destructive
                                        ? "destructive"
                                        : "default"
                                    : "outline"
                            }
                            className="cursor-pointer"
                            onClick={() => setStatusFilter(item.filterValue)}
                        >
                            {item.label} {statusCounts.get(item.key) || 0}
                        </Badge>
                    ))}
            </div>

            {/* Main content - matches Live Runs 2:1 grid layout */}
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
                                <p className="text-muted-foreground mt-2 text-sm">
                                    Adjust filters or broaden the time range to see more events
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
                                            <TableHead>Agent</TableHead>
                                            <TableHead>Run</TableHead>
                                            <TableHead>Error</TableHead>
                                            <TableHead className="text-right">Time</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {events.map((eventRow) => {
                                            const isSelected = selectedEvent?.id === eventRow.id;
                                            return (
                                                <TableRow
                                                    key={eventRow.id}
                                                    className={`cursor-pointer ${
                                                        isSelected ? "bg-muted/50" : ""
                                                    }`}
                                                    onClick={() => handleRowClick(eventRow)}
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
                                                        {eventRow.integrationKey && (
                                                            <p className="text-muted-foreground mt-1 text-xs">
                                                                {eventRow.integrationKey}
                                                            </p>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col gap-1">
                                                            {eventRow.run ? (
                                                                <Badge
                                                                    variant={getRunStatusBadgeVariant(
                                                                        eventRow.run.status
                                                                    )}
                                                                >
                                                                    {formatStatusLabel(
                                                                        eventRow.run.status
                                                                    )}
                                                                </Badge>
                                                            ) : (
                                                                <Badge
                                                                    variant={getEventStatusBadgeVariant(
                                                                        eventRow.status
                                                                    )}
                                                                >
                                                                    {formatStatusLabel(
                                                                        eventRow.status
                                                                    )}
                                                                </Badge>
                                                            )}
                                                            {eventRow.run && (
                                                                <Badge variant="outline">
                                                                    {formatStatusLabel(
                                                                        eventRow.status
                                                                    )}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                handleAgentClick(
                                                                    eventRow.agent?.slug
                                                                );
                                                            }}
                                                            className="hover:text-primary text-sm font-medium"
                                                        >
                                                            {eventRow.agent?.name || "—"}
                                                        </button>
                                                    </TableCell>
                                                    <TableCell className="text-xs">
                                                        {eventRow.run?.id
                                                            ? eventRow.run.id.slice(0, 8)
                                                            : "—"}
                                                    </TableCell>
                                                    <TableCell className="text-xs">
                                                        {eventRow.errorMessage ? (
                                                            <span className="text-red-500">
                                                                {eventRow.errorMessage}
                                                            </span>
                                                        ) : (
                                                            "—"
                                                        )}
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

                {/* Detail panel - matches Live Runs detail panel pattern */}
                <Card className="flex flex-col">
                    <CardHeader className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <CardTitle className="text-lg">
                                    {selectedEvent
                                        ? selectedEvent.trigger?.name ||
                                          selectedEvent.eventName ||
                                          "Event Detail"
                                        : "Event Detail"}
                                </CardTitle>
                                <CardDescription>
                                    {selectedEvent
                                        ? `Event ID: ${selectedEvent.id}`
                                        : "Select an event to inspect payload and outcome."}
                                </CardDescription>
                            </div>
                            {selectedEvent?.run && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        router.push(`/live?runId=${selectedEvent.run?.id}`)
                                    }
                                >
                                    Open Run
                                </Button>
                            )}
                        </div>
                        {selectedEvent && (
                            <div className="flex flex-wrap items-center gap-2">
                                {selectedEvent.run ? (
                                    <Badge
                                        variant={getRunStatusBadgeVariant(selectedEvent.run.status)}
                                    >
                                        {formatStatusLabel(selectedEvent.run.status)}
                                    </Badge>
                                ) : (
                                    <Badge
                                        variant={getEventStatusBadgeVariant(selectedEvent.status)}
                                    >
                                        {formatStatusLabel(selectedEvent.status)}
                                    </Badge>
                                )}
                                <Badge className={getSourceBadgeColor(selectedEvent.sourceType)}>
                                    {formatStatusLabel(selectedEvent.sourceType)}
                                </Badge>
                                {selectedEvent.integrationKey && (
                                    <Badge variant="outline">{selectedEvent.integrationKey}</Badge>
                                )}
                                {selectedEvent.agent && (
                                    <Badge variant="outline">{selectedEvent.agent.name}</Badge>
                                )}
                            </div>
                        )}
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
                                        {selectedEvent.run?.durationMs
                                            ? formatLatency(selectedEvent.run.durationMs)
                                            : "—"}
                                    </p>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-3">
                                    <p className="text-muted-foreground text-xs">Agent</p>
                                    <p className="text-base font-semibold">
                                        {selectedEvent.agent?.name || "—"}
                                    </p>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-3">
                                    <p className="text-muted-foreground text-xs">Run ID</p>
                                    <p className="truncate text-base font-semibold">
                                        {selectedEvent.run?.id
                                            ? selectedEvent.run.id.slice(0, 12)
                                            : "—"}
                                    </p>
                                </div>
                            </div>
                        )}
                    </CardHeader>
                    <CardContent className="flex-1 overflow-hidden">
                        {!selectedEvent ? (
                            <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 py-12 text-center">
                                <HugeiconsIcon icon={icons.activity!} className="size-10" />
                                <p className="text-sm">
                                    Select an event to view its payload, trigger config, and run
                                    outcome.
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
                                    <TabsTrigger value="payload" className="shrink-0 gap-2">
                                        <HugeiconsIcon icon={icons.settings!} className="size-4" />
                                        Payload
                                    </TabsTrigger>
                                    <TabsTrigger value="run" className="shrink-0 gap-2">
                                        <HugeiconsIcon icon={icons.activity!} className="size-4" />
                                        Run Output
                                    </TabsTrigger>
                                </TabsList>

                                <div className="mt-4 flex-1 overflow-y-auto">
                                    {detailLoading ? (
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
                                                {eventDetail && (
                                                    <div className="space-y-3 text-sm">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-muted-foreground">
                                                                Event Status
                                                            </span>
                                                            <Badge
                                                                variant={getEventStatusBadgeVariant(
                                                                    eventDetail.status
                                                                )}
                                                            >
                                                                {formatStatusLabel(
                                                                    eventDetail.status
                                                                )}
                                                            </Badge>
                                                        </div>
                                                        {eventDetail.run && (
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-muted-foreground">
                                                                    Run Status
                                                                </span>
                                                                <Badge
                                                                    variant={getRunStatusBadgeVariant(
                                                                        eventDetail.run.status
                                                                    )}
                                                                >
                                                                    {formatStatusLabel(
                                                                        eventDetail.run.status
                                                                    )}
                                                                </Badge>
                                                            </div>
                                                        )}
                                                        <Separator />
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-muted-foreground">
                                                                Trigger
                                                            </span>
                                                            <span>
                                                                {eventDetail.trigger?.name || "—"}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-muted-foreground">
                                                                Event
                                                            </span>
                                                            <span>
                                                                {eventDetail.eventName || "—"}
                                                            </span>
                                                        </div>
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
                                                                Agent
                                                            </span>
                                                            <span>
                                                                {eventDetail.agent?.name || "—"}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-muted-foreground">
                                                                Run
                                                            </span>
                                                            <span>
                                                                {eventDetail.run?.id || "—"}
                                                            </span>
                                                        </div>
                                                        {eventDetail.errorMessage && (
                                                            <Fragment>
                                                                <Separator />
                                                                <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-900/30 dark:bg-red-900/10">
                                                                    {eventDetail.errorMessage}
                                                                </div>
                                                            </Fragment>
                                                        )}
                                                        <Separator />
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-muted-foreground">
                                                                Received
                                                            </span>
                                                            <span>
                                                                {new Date(
                                                                    eventDetail.createdAt
                                                                ).toLocaleString()}
                                                            </span>
                                                        </div>
                                                        {eventDetail.run?.completedAt && (
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-muted-foreground">
                                                                    Completed
                                                                </span>
                                                                <span>
                                                                    {new Date(
                                                                        eventDetail.run.completedAt
                                                                    ).toLocaleString()}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </TabsContent>
                                            <TabsContent value="payload" className="mt-0 space-y-4">
                                                {eventDetail && (
                                                    <div className="space-y-3 text-sm">
                                                        <div className="flex items-center justify-between">
                                                            <h3 className="text-muted-foreground text-xs font-medium uppercase">
                                                                Payload
                                                            </h3>
                                                            {eventDetail.payloadTruncated && (
                                                                <Badge variant="outline">
                                                                    Truncated
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <pre className="bg-muted/20 max-h-64 overflow-auto rounded-lg border p-3 text-xs">
                                                            {JSON.stringify(
                                                                eventDetail.payloadJson ||
                                                                    eventDetail.payloadPreview ||
                                                                    {},
                                                                null,
                                                                2
                                                            )}
                                                        </pre>
                                                        {eventDetail.metadata !== null &&
                                                            eventDetail.metadata !== undefined && (
                                                                <>
                                                                    <h3 className="text-muted-foreground text-xs font-medium uppercase">
                                                                        Metadata
                                                                    </h3>
                                                                    <pre className="bg-muted/20 max-h-48 overflow-auto rounded-lg border p-3 text-xs">
                                                                        {JSON.stringify(
                                                                            eventDetail.metadata,
                                                                            null,
                                                                            2
                                                                        )}
                                                                    </pre>
                                                                </>
                                                            )}
                                                    </div>
                                                )}
                                            </TabsContent>
                                            <TabsContent value="run" className="mt-0 space-y-4">
                                                {eventDetail?.run ? (
                                                    <div className="space-y-4">
                                                        <div className="grid gap-4 lg:grid-cols-2">
                                                            <div className="flex flex-col">
                                                                <h3 className="mb-2 text-sm font-semibold">
                                                                    User Input
                                                                </h3>
                                                                <div className="bg-muted/20 flex-1 overflow-auto rounded-lg border p-3">
                                                                    <pre className="font-mono text-xs whitespace-pre-wrap">
                                                                        {eventDetail.run.inputText}
                                                                    </pre>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <h3 className="mb-2 text-sm font-semibold">
                                                                    Agent Response
                                                                </h3>
                                                                <div className="bg-muted/20 flex-1 overflow-auto rounded-lg border p-3">
                                                                    <pre className="font-mono text-xs whitespace-pre-wrap">
                                                                        {eventDetail.run
                                                                            .outputText ||
                                                                            "No output"}
                                                                    </pre>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="py-8 text-center">
                                                        <p className="text-muted-foreground text-sm">
                                                            No run associated with this trigger
                                                            event.
                                                        </p>
                                                    </div>
                                                )}
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

export default function TriggerMonitoringPage() {
    return (
        <Suspense fallback={<div className="text-muted-foreground p-6 text-sm">Loading...</div>}>
            <TriggerMonitoringClient />
        </Suspense>
    );
}
