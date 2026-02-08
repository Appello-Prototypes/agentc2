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
                <Card>
                    <CardHeader>
                        <CardTitle>Trigger Monitoring</CardTitle>
                        <CardDescription>Loading trigger events...</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-64 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto space-y-6 py-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Trigger Monitoring</h1>
                    <p className="text-muted-foreground">
                        Track every trigger event and verify execution outcomes.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm">
                        <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                        <span className="text-muted-foreground">Auto refresh</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchEvents}>
                        Refresh
                    </Button>
                </div>
            </div>

            {error && (
                <Card>
                    <CardContent className="py-4 text-sm text-red-500">{error}</CardContent>
                </Card>
            )}

            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                <Card>
                    <CardContent className="space-y-1 p-4">
                        <p className="text-muted-foreground text-xs">Total</p>
                        <p className="text-lg font-semibold">{metrics?.summary.total ?? 0}</p>
                    </CardContent>
                </Card>
                {[
                    { label: "Queued", key: "QUEUED" },
                    { label: "Filtered", key: "FILTERED" },
                    { label: "Skipped", key: "SKIPPED" },
                    { label: "Rejected", key: "REJECTED" },
                    { label: "No Match", key: "NO_MATCH" }
                ].map((item) => (
                    <Card key={item.key}>
                        <CardContent className="space-y-1 p-4">
                            <p className="text-muted-foreground text-xs">{item.label}</p>
                            <p className="text-lg font-semibold">
                                {statusCounts.get(item.key) || 0}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                    <CardDescription>
                        Slice trigger events across sources and agents.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Status</label>
                            <Select
                                value={statusFilter}
                                onValueChange={(value) => setStatusFilter(value || "all")}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All statuses</SelectItem>
                                    {filters?.statuses.map((status) => (
                                        <SelectItem key={status.status} value={status.status}>
                                            {formatStatusLabel(status.status)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Source</label>
                            <Select
                                value={sourceFilter}
                                onValueChange={(value) => setSourceFilter(value || "all")}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All sources</SelectItem>
                                    {filters?.sources.map((source) => (
                                        <SelectItem
                                            key={source.sourceType}
                                            value={source.sourceType}
                                        >
                                            {formatStatusLabel(source.sourceType)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Integration</label>
                            <Select
                                value={integrationFilter}
                                onValueChange={(value) => setIntegrationFilter(value || "all")}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All integrations</SelectItem>
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
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Trigger</label>
                            <Select
                                value={triggerFilter}
                                onValueChange={(value) => setTriggerFilter(value || "all")}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All triggers</SelectItem>
                                    {filters?.triggers.map((trigger) => (
                                        <SelectItem key={trigger.id} value={trigger.id}>
                                            {trigger.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Agent</label>
                            <Select
                                value={agentFilter}
                                onValueChange={(value) => setAgentFilter(value || "all")}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All agents</SelectItem>
                                    {filters?.agents.map((agent) => (
                                        <SelectItem key={agent.id} value={agent.id}>
                                            {agent.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Event Name</label>
                            <Select
                                value={eventNameFilter}
                                onValueChange={(value) => setEventNameFilter(value || "all")}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All events</SelectItem>
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
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Time Range</label>
                            <Select
                                value={timeRange}
                                onValueChange={(value) => setTimeRange(value || "24h")}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="24h">Last 24 hours</SelectItem>
                                    <SelectItem value="7d">Last 7 days</SelectItem>
                                    <SelectItem value="30d">Last 30 days</SelectItem>
                                    <SelectItem value="90d">Last 90 days</SelectItem>
                                    <SelectItem value="all">All time</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Search</label>
                            <Input
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Search trigger events..."
                            />
                        </div>
                    </div>

                    <div className="text-muted-foreground flex items-center gap-2 text-xs">
                        <HugeiconsIcon icon={icons.clock!} className="size-3" strokeWidth={1.5} />
                        <span>
                            Last updated {lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString() : "—"}
                        </span>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Card className="overflow-hidden">
                    <CardHeader>
                        <CardTitle>Trigger Events</CardTitle>
                        <CardDescription>
                            {eventsLoading ? "Refreshing events..." : "Latest trigger activity."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {eventsLoading && events.length === 0 ? (
                            <div className="p-6">
                                <Skeleton className="h-6 w-full" />
                                <Skeleton className="mt-3 h-6 w-full" />
                                <Skeleton className="mt-3 h-6 w-full" />
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Time</TableHead>
                                        <TableHead>Trigger</TableHead>
                                        <TableHead>Source</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Agent</TableHead>
                                        <TableHead>Run</TableHead>
                                        <TableHead>Error</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {events.length === 0 && (
                                        <TableRow>
                                            <TableCell
                                                colSpan={7}
                                                className="text-muted-foreground py-6 text-center text-sm"
                                            >
                                                No trigger events yet.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {events.map((eventRow) => (
                                        <TableRow
                                            key={eventRow.id}
                                            className="hover:bg-muted/40 cursor-pointer"
                                            onClick={() => handleRowClick(eventRow)}
                                        >
                                            <TableCell className="text-xs">
                                                {formatRelativeTime(eventRow.createdAt)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <div className="text-sm font-medium">
                                                        {eventRow.trigger?.name ||
                                                            eventRow.eventName ||
                                                            "Unknown trigger"}
                                                    </div>
                                                    <div className="text-muted-foreground text-xs">
                                                        {eventRow.eventName || "—"}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">
                                                    {formatStatusLabel(eventRow.sourceType)}
                                                </Badge>
                                                {eventRow.integrationKey && (
                                                    <div className="text-muted-foreground mt-1 text-xs">
                                                        {eventRow.integrationKey}
                                                    </div>
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
                                                            {formatStatusLabel(eventRow.run.status)}
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
                                                    {eventRow.run && (
                                                        <Badge variant="outline">
                                                            {formatStatusLabel(eventRow.status)}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        handleAgentClick(eventRow.agent?.slug);
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
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                <Card className="flex h-full flex-col">
                    <CardHeader>
                        <CardTitle>Event Detail</CardTitle>
                        <CardDescription>
                            Inspect a trigger event payload and outcome.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                        {!selectedEvent && (
                            <div className="text-muted-foreground text-sm">
                                Select an event to view details.
                            </div>
                        )}
                        {selectedEvent && (
                            <Tabs defaultValue="overview" className="space-y-4">
                                <TabsList>
                                    <TabsTrigger value="overview">Overview</TabsTrigger>
                                    <TabsTrigger value="payload">Payload</TabsTrigger>
                                </TabsList>
                                <TabsContent value="overview" className="space-y-4">
                                    {detailLoading && (
                                        <div className="space-y-3">
                                            <Skeleton className="h-4 w-full" />
                                            <Skeleton className="h-4 w-full" />
                                            <Skeleton className="h-4 w-full" />
                                        </div>
                                    )}
                                    {!detailLoading && eventDetail && (
                                        <div className="space-y-3 text-sm">
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">
                                                    Status
                                                </span>
                                                <div className="flex flex-col items-end gap-1">
                                                    {eventDetail.run ? (
                                                        <Badge
                                                            variant={getRunStatusBadgeVariant(
                                                                eventDetail.run.status
                                                            )}
                                                        >
                                                            {formatStatusLabel(
                                                                eventDetail.run.status
                                                            )}
                                                        </Badge>
                                                    ) : (
                                                        <Badge
                                                            variant={getEventStatusBadgeVariant(
                                                                eventDetail.status
                                                            )}
                                                        >
                                                            {formatStatusLabel(eventDetail.status)}
                                                        </Badge>
                                                    )}
                                                    {eventDetail.run && (
                                                        <Badge variant="outline">
                                                            {formatStatusLabel(eventDetail.status)}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <Separator />
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">
                                                    Trigger
                                                </span>
                                                <span>{eventDetail.trigger?.name || "—"}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">Event</span>
                                                <span>{eventDetail.eventName || "—"}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">
                                                    Source
                                                </span>
                                                <span>
                                                    {formatStatusLabel(eventDetail.sourceType)}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">Agent</span>
                                                <span>{eventDetail.agent?.name || "—"}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">Run</span>
                                                <span>{eventDetail.run?.id || "—"}</span>
                                            </div>
                                            {eventDetail.errorMessage && (
                                                <Fragment>
                                                    <Separator />
                                                    <div className="space-y-1">
                                                        <span className="text-muted-foreground">
                                                            Error
                                                        </span>
                                                        <div className="text-red-500">
                                                            {eventDetail.errorMessage}
                                                        </div>
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
                                <TabsContent value="payload" className="space-y-4">
                                    {detailLoading && (
                                        <div className="space-y-3">
                                            <Skeleton className="h-24 w-full" />
                                        </div>
                                    )}
                                    {!detailLoading && eventDetail && (
                                        <div className="space-y-3 text-sm">
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">
                                                    Payload
                                                </span>
                                                {eventDetail.payloadTruncated && (
                                                    <Badge variant="outline">Truncated</Badge>
                                                )}
                                            </div>
                                            <pre className="bg-muted/40 max-h-64 overflow-auto rounded-md p-3 text-xs">
                                                {JSON.stringify(
                                                    eventDetail.payloadJson ||
                                                        eventDetail.payloadPreview ||
                                                        {},
                                                    null,
                                                    2
                                                )}
                                            </pre>
                                        </div>
                                    )}
                                </TabsContent>
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
