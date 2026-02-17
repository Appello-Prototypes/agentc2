"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
    Badge,
    Button,
    Card,
    CardContent,
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
    icons,
} from "@repo/ui"
import { getApiBase } from "@/lib/utils"
import {
    formatRelativeTime,
    formatCost,
    formatLatency,
} from "@/components/run-detail-utils"

interface ActivityEvent {
    id: string
    type: string
    timestamp: string
    agentId: string | null
    agentSlug: string | null
    agentName: string | null
    userId: string | null
    summary: string
    detail: string | null
    status: string | null
    source: string | null
    runId: string | null
    taskId: string | null
    networkRunId: string | null
    campaignId: string | null
    costUsd: number | null
    durationMs: number | null
    tokenCount: number | null
    tags: string[]
}

interface ActivityMetrics {
    totalEvents: number
    byType: Record<string, number>
    byAgent: Array<{ agentSlug: string; agentName: string; count: number }>
    totalCost: number
    avgDuration: number
}

const EVENT_TYPE_LABELS: Record<string, string> = {
    RUN_COMPLETED: "Run Completed",
    RUN_FAILED: "Run Failed",
    RUN_STARTED: "Run Started",
    HEARTBEAT_RAN: "Heartbeat",
    HEARTBEAT_ALERT: "Heartbeat Alert",
    TASK_CREATED: "Task Created",
    TASK_COMPLETED: "Task Completed",
    TASK_FAILED: "Task Failed",
    TASK_DEFERRED: "Task Deferred",
    NETWORK_ROUTED: "Network Routed",
    NETWORK_COMPLETED: "Network Completed",
    CAMPAIGN_STARTED: "Campaign Started",
    CAMPAIGN_COMPLETED: "Campaign Completed",
    CAMPAIGN_FAILED: "Campaign Failed",
    MISSION_COMPLETED: "Mission Completed",
    TRIGGER_FIRED: "Trigger Fired",
    SCHEDULE_EXECUTED: "Schedule Executed",
    SLACK_MESSAGE_HANDLED: "Slack Message",
    EMAIL_PROCESSED: "Email Processed",
    AGENT_CREATED: "Agent Created",
    AGENT_UPDATED: "Agent Updated",
    SKILL_CREATED: "Skill Created",
    INTEGRATION_EVENT: "Integration",
    GUARDRAIL_TRIGGERED: "Guardrail",
    ALERT_RAISED: "Alert",
    SYSTEM_EVENT: "System",
}

const STATUS_COLORS: Record<string, string> = {
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    failure: "bg-red-500/10 text-red-400 border-red-500/20",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
}

const TYPE_CATEGORIES: Record<string, string[]> = {
    Runs: ["RUN_COMPLETED", "RUN_FAILED", "RUN_STARTED"],
    Heartbeats: ["HEARTBEAT_RAN", "HEARTBEAT_ALERT"],
    Tasks: ["TASK_CREATED", "TASK_COMPLETED", "TASK_FAILED", "TASK_DEFERRED"],
    Networks: ["NETWORK_ROUTED", "NETWORK_COMPLETED"],
    Campaigns: [
        "CAMPAIGN_STARTED",
        "CAMPAIGN_COMPLETED",
        "CAMPAIGN_FAILED",
        "MISSION_COMPLETED",
    ],
    Triggers: ["TRIGGER_FIRED", "SCHEDULE_EXECUTED"],
    Communications: ["SLACK_MESSAGE_HANDLED", "EMAIL_PROCESSED"],
    Platform: [
        "AGENT_CREATED",
        "AGENT_UPDATED",
        "SKILL_CREATED",
        "INTEGRATION_EVENT",
        "GUARDRAIL_TRIGGERED",
        "ALERT_RAISED",
        "SYSTEM_EVENT",
    ],
}

const TIME_RANGES = [
    { label: "Last Hour", value: "1h" },
    { label: "Today", value: "24h" },
    { label: "7 Days", value: "7d" },
    { label: "30 Days", value: "30d" },
    { label: "All Time", value: "all" },
]

function getDateRange(timeRange: string): { from?: string; to?: string } {
    if (timeRange === "all") return {}
    const now = new Date()
    const ms: Record<string, number> = {
        "1h": 60 * 60 * 1000,
        "24h": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000,
    }
    const from = new Date(now.getTime() - (ms[timeRange] || ms["24h"]))
    return { from: from.toISOString() }
}

export default function ActivityFeedPage() {
    const [events, setEvents] = useState<ActivityEvent[]>([])
    const [metrics, setMetrics] = useState<ActivityMetrics | null>(null)
    const [loading, setLoading] = useState(true)
    const [autoRefresh, setAutoRefresh] = useState(true)
    const [timeRange, setTimeRange] = useState("24h")
    const [typeFilter, setTypeFilter] = useState("all")
    const [sourceFilter, setSourceFilter] = useState("all")
    const [statusFilter, setStatusFilter] = useState("all")
    const [searchQuery, setSearchQuery] = useState("")
    const [expandedEvent, setExpandedEvent] = useState<string | null>(null)
    const [hasMore, setHasMore] = useState(false)
    const [nextCursor, setNextCursor] = useState<string | null>(null)
    const [loadingMore, setLoadingMore] = useState(false)

    const fetchEvents = useCallback(
        async (cursor?: string) => {
            try {
                if (!cursor) setLoading(true)
                else setLoadingMore(true)

                const params = new URLSearchParams()
                const dateRange = getDateRange(timeRange)
                if (dateRange.from) params.set("from", dateRange.from)
                if (typeFilter !== "all") {
                    const types = TYPE_CATEGORIES[typeFilter]
                    if (types) params.set("type", types.join(","))
                }
                if (sourceFilter !== "all") params.set("source", sourceFilter)
                if (statusFilter !== "all") params.set("status", statusFilter)
                if (searchQuery) params.set("search", searchQuery)
                if (cursor) params.set("cursor", cursor)
                params.set("limit", "50")

                const res = await fetch(`${getApiBase()}/api/activity?${params}`)
                const data = await res.json()

                if (data.success) {
                    if (cursor) {
                        setEvents((prev) => [...prev, ...data.events])
                    } else {
                        setEvents(data.events)
                        setMetrics(data.metrics)
                    }
                    setHasMore(data.hasMore)
                    setNextCursor(data.nextCursor)
                }
            } catch (err) {
                console.error("Failed to fetch activity:", err)
            } finally {
                setLoading(false)
                setLoadingMore(false)
            }
        },
        [timeRange, typeFilter, sourceFilter, statusFilter, searchQuery]
    )

    useEffect(() => {
        fetchEvents()
    }, [fetchEvents])

    useEffect(() => {
        if (!autoRefresh) return
        const interval = setInterval(() => fetchEvents(), 15000)
        return () => clearInterval(interval)
    }, [autoRefresh, fetchEvents])

    const uniqueSources = useMemo(() => {
        const sources = new Set<string>()
        events.forEach((e) => {
            if (e.source) sources.add(e.source)
        })
        return Array.from(sources).sort()
    }, [events])

    return (
        <div className="flex h-full flex-col overflow-auto">
            {/* Header */}
            <div className="border-b px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">Activity Feed</h1>
                        <p className="text-muted-foreground text-sm">
                            Real-time view of everything your agents are doing
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
                        <Button variant="outline" size="sm" onClick={() => fetchEvents()}>
                            Refresh
                        </Button>
                    </div>
                </div>
            </div>

            {/* Metrics Strip */}
            {metrics && (
                <div className="border-b px-6 py-3">
                    <div className="flex items-center gap-6 text-sm">
                        <div>
                            <span className="text-muted-foreground">Events: </span>
                            <span className="font-medium">
                                {metrics.totalEvents.toLocaleString()}
                            </span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Cost: </span>
                            <span className="font-medium">
                                {formatCost(metrics.totalCost)}
                            </span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Avg Duration: </span>
                            <span className="font-medium">
                                {formatLatency(metrics.avgDuration)}
                            </span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Agents: </span>
                            <span className="font-medium">{metrics.byAgent.length}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="border-b px-6 py-3">
                <div className="flex flex-wrap items-center gap-3">
                    <Select value={timeRange} onValueChange={setTimeRange}>
                        <SelectTrigger className="w-[130px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {TIME_RANGES.map((r) => (
                                <SelectItem key={r.value} value={r.value}>
                                    {r.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            {Object.keys(TYPE_CATEGORIES).map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                    {cat}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={sourceFilter} onValueChange={setSourceFilter}>
                        <SelectTrigger className="w-[130px]">
                            <SelectValue placeholder="Source" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Sources</SelectItem>
                            {uniqueSources.map((s) => (
                                <SelectItem key={s} value={s}>
                                    {s}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="success">Success</SelectItem>
                            <SelectItem value="failure">Failure</SelectItem>
                            <SelectItem value="warning">Warning</SelectItem>
                            <SelectItem value="info">Info</SelectItem>
                        </SelectContent>
                    </Select>

                    <Input
                        placeholder="Search events..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-[200px]"
                    />
                </div>
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-auto px-6 py-4">
                {loading ? (
                    <div className="space-y-4">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <Skeleton key={i} className="h-24 w-full rounded-lg" />
                        ))}
                    </div>
                ) : events.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <HugeiconsIcon
                            icon={icons.ActivityIcon}
                            className="text-muted-foreground mb-4 h-12 w-12"
                        />
                        <h3 className="text-lg font-medium">No activity yet</h3>
                        <p className="text-muted-foreground mt-1 text-sm">
                            Events will appear here as your agents work.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {events.map((event) => (
                            <Card
                                key={event.id}
                                className="cursor-pointer transition-colors hover:bg-accent/50"
                                onClick={() =>
                                    setExpandedEvent(
                                        expandedEvent === event.id ? null : event.id
                                    )
                                }
                            >
                                <CardContent className="px-4 py-3">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        STATUS_COLORS[event.status || "info"] ||
                                                        STATUS_COLORS.info
                                                    }
                                                >
                                                    {EVENT_TYPE_LABELS[event.type] || event.type}
                                                </Badge>
                                                {event.agentName && (
                                                    <span className="text-muted-foreground text-xs">
                                                        {event.agentName}
                                                    </span>
                                                )}
                                                {event.source && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        {event.source}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="mt-1 text-sm leading-relaxed">
                                                {event.summary}
                                            </p>
                                            {expandedEvent === event.id && event.detail && (
                                                <pre className="bg-muted mt-2 max-h-60 overflow-auto rounded p-3 text-xs whitespace-pre-wrap">
                                                    {event.detail}
                                                </pre>
                                            )}
                                        </div>
                                        <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                                            <span className="text-muted-foreground">
                                                {formatRelativeTime(event.timestamp)}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                {event.costUsd != null && event.costUsd > 0 && (
                                                    <span className="text-muted-foreground">
                                                        {formatCost(event.costUsd)}
                                                    </span>
                                                )}
                                                {event.durationMs != null &&
                                                    event.durationMs > 0 && (
                                                        <span className="text-muted-foreground">
                                                            {formatLatency(event.durationMs)}
                                                        </span>
                                                    )}
                                            </div>
                                            {event.runId && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 px-2 text-xs"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        window.open(
                                                            `/live?search=${event.runId}`,
                                                            "_blank"
                                                        )
                                                    }}
                                                >
                                                    View Run
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}

                        {hasMore && (
                            <div className="py-4 text-center">
                                <Button
                                    variant="outline"
                                    onClick={() => nextCursor && fetchEvents(nextCursor)}
                                    disabled={loadingMore}
                                >
                                    {loadingMore ? "Loading..." : "Load more"}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
