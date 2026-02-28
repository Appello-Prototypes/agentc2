"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Badge,
    Button,
    Card,
    CardContent,
    HugeiconsIcon,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Skeleton,
    icons
} from "@repo/ui";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityEvent {
    id: string;
    type: string;
    timestamp: string;
    agentId: string | null;
    agentSlug: string | null;
    agentName: string | null;
    userId: string | null;
    summary: string;
    detail: string | null;
    status: string | null;
    source: string | null;
    runId: string | null;
    taskId: string | null;
    networkRunId: string | null;
    campaignId: string | null;
    costUsd: number | null;
    durationMs: number | null;
    tokenCount: number | null;
    metadata: Record<string, unknown> | null;
    tags: string[];
}

interface FeedMetrics {
    totalEvents: number;
    byType: Record<string, number>;
    byAgent: Array<{ agentSlug: string; agentName: string; count: number }>;
    totalCost: number;
    avgDuration: number;
}

type GodModeView = "feed" | "wiretap";

interface WiretapRun {
    runId: string;
    agentId: string;
    agentSlug: string;
    agentName: string;
    status: string;
    inputText: string;
    source: string | null;
    startedAt: string;
    elapsedMs?: number;
    steps: WiretapStep[];
    toolCalls: WiretapToolCall[];
}

interface WiretapStep {
    stepNumber: number;
    type: string;
    content: unknown;
    durationMs: number | null;
    timestamp: string;
}

interface WiretapToolCall {
    id: string;
    toolKey: string;
    mcpServerId: string | null;
    status: string;
    durationMs: number | null;
    createdAt: string;
}

interface CausalNode {
    id: string;
    type: string;
    label: string;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
    durationMs: number | null;
    metadata: Record<string, unknown>;
    children: CausalNode[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 3000;

const EVENT_TYPE_CONFIG: Record<
    string,
    { label: string; color: string; bgColor: string; icon: string }
> = {
    RUN_STARTED: {
        label: "Run Started",
        color: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-50 dark:bg-blue-950/30",
        icon: "play-circle"
    },
    RUN_COMPLETED: {
        label: "Run Completed",
        color: "text-emerald-600 dark:text-emerald-400",
        bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
        icon: "checkmark-circle-02"
    },
    RUN_FAILED: {
        label: "Run Failed",
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-950/30",
        icon: "cancel-circle"
    },
    NETWORK_ROUTED: {
        label: "Network Routed",
        color: "text-violet-600 dark:text-violet-400",
        bgColor: "bg-violet-50 dark:bg-violet-950/30",
        icon: "share-knowledge"
    },
    NETWORK_COMPLETED: {
        label: "Network Completed",
        color: "text-violet-600 dark:text-violet-400",
        bgColor: "bg-violet-50 dark:bg-violet-950/30",
        icon: "checkmark-circle-02"
    },
    TASK_CREATED: {
        label: "Task Created",
        color: "text-amber-600 dark:text-amber-400",
        bgColor: "bg-amber-50 dark:bg-amber-950/30",
        icon: "task-01"
    },
    TASK_COMPLETED: {
        label: "Task Completed",
        color: "text-emerald-600 dark:text-emerald-400",
        bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
        icon: "task-done-01"
    },
    TASK_FAILED: {
        label: "Task Failed",
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-950/30",
        icon: "task-remove-01"
    },
    SLACK_MESSAGE_HANDLED: {
        label: "Slack Message",
        color: "text-purple-600 dark:text-purple-400",
        bgColor: "bg-purple-50 dark:bg-purple-950/30",
        icon: "message-01"
    },
    EMAIL_PROCESSED: {
        label: "Email Processed",
        color: "text-sky-600 dark:text-sky-400",
        bgColor: "bg-sky-50 dark:bg-sky-950/30",
        icon: "mail-01"
    },
    CAMPAIGN_STARTED: {
        label: "Campaign Started",
        color: "text-orange-600 dark:text-orange-400",
        bgColor: "bg-orange-50 dark:bg-orange-950/30",
        icon: "megaphone-01"
    },
    CAMPAIGN_COMPLETED: {
        label: "Campaign Done",
        color: "text-emerald-600 dark:text-emerald-400",
        bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
        icon: "megaphone-01"
    },
    TRIGGER_FIRED: {
        label: "Trigger Fired",
        color: "text-yellow-600 dark:text-yellow-400",
        bgColor: "bg-yellow-50 dark:bg-yellow-950/30",
        icon: "flash"
    },
    SCHEDULE_EXECUTED: {
        label: "Scheduled Run",
        color: "text-teal-600 dark:text-teal-400",
        bgColor: "bg-teal-50 dark:bg-teal-950/30",
        icon: "clock-01"
    },
    HEARTBEAT_RAN: {
        label: "Heartbeat",
        color: "text-gray-500 dark:text-gray-400",
        bgColor: "bg-gray-50 dark:bg-gray-950/30",
        icon: "activity-01"
    },
    HEARTBEAT_ALERT: {
        label: "Alert",
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-950/30",
        icon: "alert-circle"
    },
    GUARDRAIL_TRIGGERED: {
        label: "Guardrail",
        color: "text-orange-600 dark:text-orange-400",
        bgColor: "bg-orange-50 dark:bg-orange-950/30",
        icon: "shield-01"
    }
};

const DEFAULT_EVENT_CONFIG = {
    label: "Event",
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-50 dark:bg-gray-950/30",
    icon: "information-circle"
};

const AGENT_COLORS = [
    "from-blue-500 to-cyan-500",
    "from-violet-500 to-purple-500",
    "from-emerald-500 to-teal-500",
    "from-rose-500 to-pink-500",
    "from-amber-500 to-orange-500",
    "from-indigo-500 to-blue-500",
    "from-fuchsia-500 to-pink-500",
    "from-lime-500 to-green-500"
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAgentColor(slug: string | null): string {
    if (!slug) return "from-gray-400 to-gray-500";
    let hash = 0;
    for (let i = 0; i < slug.length; i++) {
        hash = slug.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length]!;
}

function getAgentInitials(name: string | null, slug: string | null): string {
    const val = name || slug || "?";
    const parts = val.split(/[\s-_]+/);
    if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
    return val.slice(0, 2).toUpperCase();
}

function formatRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 5) return "just now";
    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

function formatDuration(ms: number | null): string {
    if (ms === null) return "";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60_000).toFixed(1)}m`;
}

function formatCost(value: number | null): string {
    if (value === null || value === 0) return "";
    return value < 1 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`;
}

function formatTokens(value: number | null): string {
    if (value === null || value === 0) return "";
    return `${value.toLocaleString()} tok`;
}

function getSourceLabel(source: string | null): string {
    if (!source) return "system";
    return source.toLowerCase();
}

function getSourceColor(source: string | null): string {
    switch (source?.toLowerCase()) {
        case "slack":
            return "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300";
        case "whatsapp":
            return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
        case "voice":
        case "elevenlabs":
            return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300";
        case "api":
            return "bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300";
        case "schedule":
        case "cron":
            return "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300";
        case "webhook":
            return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
        case "campaign":
            return "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300";
        case "heartbeat":
            return "bg-gray-100 text-gray-500 dark:bg-gray-900/40 dark:text-gray-400";
        default:
            return "bg-gray-100 text-gray-600 dark:bg-gray-900/40 dark:text-gray-400";
    }
}

// ─── Feed Card Component ──────────────────────────────────────────────────────

function FeedCard({
    event,
    isNew,
    onAgentClick,
    onRunClick,
    onChainClick
}: {
    event: ActivityEvent;
    isNew: boolean;
    onAgentClick: (slug: string) => void;
    onRunClick: (runId: string, agentSlug: string) => void;
    onChainClick?: (networkRunId: string) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const config = EVENT_TYPE_CONFIG[event.type] || DEFAULT_EVENT_CONFIG;
    const isRunning = event.type === "RUN_STARTED" && event.status !== "success";
    const isFailed = event.status === "failure" || event.type === "RUN_FAILED";

    const metadata = event.metadata as Record<string, unknown> | null;
    const inputPreview = metadata?.inputPreview as string | undefined;
    const outputPreview = metadata?.outputPreview as string | undefined;
    const toolsUsed = metadata?.toolsUsed as string[] | undefined;
    const routedFrom = metadata?.routedFrom as string | undefined;
    const routedTo = metadata?.routedTo as string | undefined;

    return (
        <div
            className={cn(
                "group relative transition-all duration-300",
                isNew && "animate-in slide-in-from-top-2 fade-in duration-500"
            )}
        >
            {/* Running pulse ring */}
            {isRunning && (
                <div className="absolute -inset-px animate-pulse rounded-xl bg-linear-to-r from-blue-500/20 via-cyan-500/20 to-blue-500/20" />
            )}

            <Card
                className={cn(
                    "relative overflow-hidden border transition-all duration-200",
                    "hover:border-foreground/10 hover:shadow-md",
                    isRunning && "border-blue-400/50 dark:border-blue-500/30",
                    isFailed && "border-red-300/50 dark:border-red-500/20"
                )}
            >
                {/* Type accent stripe */}
                <div
                    className={cn(
                        "absolute top-0 bottom-0 left-0 w-1",
                        event.status === "success"
                            ? "bg-emerald-500"
                            : event.status === "failure"
                              ? "bg-red-500"
                              : event.type === "RUN_STARTED"
                                ? "bg-blue-500"
                                : event.type.includes("NETWORK")
                                  ? "bg-violet-500"
                                  : event.type.includes("CAMPAIGN")
                                    ? "bg-orange-500"
                                    : "bg-gray-300 dark:bg-gray-600"
                    )}
                />

                <CardContent className="p-4 pl-5">
                    {/* Header: avatar + agent name + type + timestamp */}
                    <div className="flex items-start gap-3">
                        {/* Agent avatar */}
                        <button
                            onClick={() => event.agentSlug && onAgentClick(event.agentSlug)}
                            className="shrink-0 focus:outline-none"
                            disabled={!event.agentSlug}
                        >
                            <div
                                className={cn(
                                    "flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br text-xs font-bold text-white shadow-sm",
                                    getAgentColor(event.agentSlug),
                                    isRunning &&
                                        "ring-offset-background animate-pulse ring-2 ring-blue-400/50 ring-offset-2"
                                )}
                            >
                                {getAgentInitials(event.agentName, event.agentSlug)}
                            </div>
                        </button>

                        <div className="min-w-0 flex-1">
                            {/* Name + type badge + time */}
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={() => event.agentSlug && onAgentClick(event.agentSlug)}
                                    className="truncate text-sm font-semibold hover:underline"
                                    disabled={!event.agentSlug}
                                >
                                    {event.agentName || event.agentSlug || "System"}
                                </button>

                                <span
                                    className={cn(
                                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                                        config.bgColor,
                                        config.color
                                    )}
                                >
                                    {config.label}
                                </span>

                                {event.source && (
                                    <span
                                        className={cn(
                                            "rounded-full px-2 py-0.5 text-[11px] font-medium",
                                            getSourceColor(event.source)
                                        )}
                                    >
                                        {getSourceLabel(event.source)}
                                    </span>
                                )}

                                <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                                    {formatRelativeTime(event.timestamp)}
                                </span>
                            </div>

                            {/* Summary */}
                            <p className="text-foreground/80 mt-1 text-sm leading-relaxed">
                                {event.summary}
                            </p>

                            {/* Network routing indicator */}
                            {(routedFrom || routedTo) && (
                                <div className="mt-2 flex items-center gap-2 text-xs text-violet-600 dark:text-violet-400">
                                    <HugeiconsIcon
                                        icon={icons["arrow-right"]!}
                                        className="size-3.5"
                                    />
                                    {routedFrom && (
                                        <span className="font-medium">{routedFrom}</span>
                                    )}
                                    {routedFrom && routedTo && <span>&rarr;</span>}
                                    {routedTo && <span className="font-medium">{routedTo}</span>}
                                </div>
                            )}

                            {/* I/O preview */}
                            {(inputPreview || outputPreview) && (
                                <button
                                    onClick={() => setExpanded(!expanded)}
                                    className="mt-2 w-full text-left"
                                >
                                    <div
                                        className={cn(
                                            "bg-muted/30 rounded-lg border p-3 text-xs transition-all",
                                            expanded ? "max-h-96" : "max-h-24 overflow-hidden"
                                        )}
                                    >
                                        {inputPreview && (
                                            <div className="mb-2">
                                                <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                                                    Input
                                                </span>
                                                <p className="text-foreground/70 mt-0.5 whitespace-pre-wrap">
                                                    {inputPreview}
                                                </p>
                                            </div>
                                        )}
                                        {outputPreview && (
                                            <div>
                                                <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                                                    Output
                                                </span>
                                                <p className="text-foreground/70 mt-0.5 whitespace-pre-wrap">
                                                    {outputPreview}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    {!expanded && (inputPreview || outputPreview) && (
                                        <span className="text-muted-foreground mt-1 inline-block text-[11px]">
                                            Click to expand
                                        </span>
                                    )}
                                </button>
                            )}

                            {/* Tool badges */}
                            {toolsUsed && toolsUsed.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {toolsUsed.slice(0, 5).map((tool) => (
                                        <span
                                            key={tool}
                                            className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px]"
                                        >
                                            <HugeiconsIcon
                                                icon={icons["settings"]!}
                                                className="size-2.5"
                                            />
                                            {tool}
                                        </span>
                                    ))}
                                    {toolsUsed.length > 5 && (
                                        <span className="text-muted-foreground text-[10px]">
                                            +{toolsUsed.length - 5} more
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Footer metrics */}
                            <div className="text-muted-foreground mt-2 flex items-center gap-3 text-[11px]">
                                {event.durationMs !== null && event.durationMs > 0 && (
                                    <span className="flex items-center gap-1">
                                        <HugeiconsIcon icon={icons["clock"]!} className="size-3" />
                                        {formatDuration(event.durationMs)}
                                    </span>
                                )}
                                {event.tokenCount !== null && event.tokenCount > 0 && (
                                    <span>{formatTokens(event.tokenCount)}</span>
                                )}
                                {event.costUsd !== null && event.costUsd > 0 && (
                                    <span>{formatCost(event.costUsd)}</span>
                                )}
                                {event.tags.length > 0 && (
                                    <div className="ml-auto flex gap-1">
                                        {event.tags.slice(0, 3).map((tag) => (
                                            <Badge
                                                key={tag}
                                                variant="outline"
                                                className="px-1.5 py-0 text-[10px]"
                                            >
                                                {tag}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                                {event.runId && event.agentSlug && (
                                    <button
                                        onClick={() => onRunClick(event.runId!, event.agentSlug!)}
                                        className="text-primary ml-auto text-[11px] hover:underline"
                                    >
                                        View Run &rarr;
                                    </button>
                                )}
                                {event.networkRunId && onChainClick && (
                                    <button
                                        onClick={() => onChainClick(event.networkRunId!)}
                                        className="ml-auto text-[11px] text-violet-600 hover:underline dark:text-violet-400"
                                    >
                                        Trace Chain &rarr;
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar({ metrics }: { metrics: FeedMetrics | null }) {
    if (!metrics) return null;

    const runTypes = metrics.byType;
    const started = runTypes["RUN_STARTED"] || 0;
    const completed = runTypes["RUN_COMPLETED"] || 0;
    const failed = runTypes["RUN_FAILED"] || 0;
    const networkRouted = runTypes["NETWORK_ROUTED"] || 0;
    const activeRuns = Math.max(0, started - completed - failed);

    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            <StatCard label="Total Events" value={metrics.totalEvents.toLocaleString()} />
            <StatCard
                label="Active Runs"
                value={activeRuns.toString()}
                accent="text-blue-600 dark:text-blue-400"
                pulse={activeRuns > 0}
            />
            <StatCard
                label="Completed"
                value={completed.toString()}
                accent="text-emerald-600 dark:text-emerald-400"
            />
            <StatCard
                label="Failed"
                value={failed.toString()}
                accent={failed > 0 ? "text-red-600 dark:text-red-400" : undefined}
            />
            <StatCard
                label="Network Routes"
                value={networkRouted.toString()}
                accent="text-violet-600 dark:text-violet-400"
            />
            <StatCard
                label="Total Cost"
                value={
                    metrics.totalCost > 0
                        ? metrics.totalCost < 1
                            ? `$${metrics.totalCost.toFixed(4)}`
                            : `$${metrics.totalCost.toFixed(2)}`
                        : "$0.00"
                }
            />
        </div>
    );
}

function StatCard({
    label,
    value,
    accent,
    pulse
}: {
    label: string;
    value: string;
    accent?: string;
    pulse?: boolean;
}) {
    return (
        <Card className="relative overflow-hidden">
            <CardContent className="p-3">
                <p className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
                    {label}
                </p>
                <p className={cn("mt-0.5 text-xl font-bold", accent || "text-foreground")}>
                    {pulse && (
                        <span className="relative mr-1.5">
                            <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-blue-500 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                        </span>
                    )}
                    {value}
                </p>
            </CardContent>
        </Card>
    );
}

// ─── Active Agents Sidebar ────────────────────────────────────────────────────

function ActiveAgentsSidebar({
    agents,
    selectedAgent,
    onSelect
}: {
    agents: Array<{ agentSlug: string; agentName: string; count: number }>;
    selectedAgent: string | null;
    onSelect: (slug: string | null) => void;
}) {
    if (agents.length === 0) return null;

    return (
        <Card>
            <CardContent className="p-4">
                <h3 className="mb-3 text-sm font-semibold">Active Agents</h3>
                <div className="space-y-1.5">
                    <button
                        onClick={() => onSelect(null)}
                        className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                            !selectedAgent
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:bg-muted"
                        )}
                    >
                        <div className="bg-muted flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold">
                            All
                        </div>
                        <span className="truncate">All Agents</span>
                    </button>
                    {agents.map((agent) => (
                        <button
                            key={agent.agentSlug}
                            onClick={() =>
                                onSelect(selectedAgent === agent.agentSlug ? null : agent.agentSlug)
                            }
                            className={cn(
                                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                                selectedAgent === agent.agentSlug
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-muted-foreground hover:bg-muted"
                            )}
                        >
                            <div
                                className={cn(
                                    "flex h-6 w-6 items-center justify-center rounded-full bg-linear-to-br text-[9px] font-bold text-white",
                                    getAgentColor(agent.agentSlug)
                                )}
                            >
                                {getAgentInitials(agent.agentName, agent.agentSlug)}
                            </div>
                            <span className="flex-1 truncate text-left">
                                {agent.agentName || agent.agentSlug}
                            </span>
                            <span className="text-muted-foreground text-[10px] tabular-nums">
                                {agent.count}
                            </span>
                        </button>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function FeedSkeleton() {
    return (
        <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                    <CardContent className="p-4 pl-5">
                        <div className="flex items-start gap-3">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-4 w-16 rounded-full" />
                                </div>
                                <Skeleton className="h-3 w-full" />
                                <Skeleton className="h-3 w-2/3" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

// ─── Wiretap View ─────────────────────────────────────────────────────────────

function WiretapView() {
    const [runs, setRuns] = useState<WiretapRun[]>([]);
    const [connected, setConnected] = useState(false);
    const [activeCount, setActiveCount] = useState(0);
    const [expandedRun, setExpandedRun] = useState<string | null>(null);
    const eventSourceRef = useRef<EventSource | null>(null);

    useEffect(() => {
        const es = new EventSource("/api/godmode/wiretap");
        eventSourceRef.current = es;

        es.addEventListener("snapshot", (e) => {
            const data = JSON.parse(e.data);
            setRuns(data.runs ?? []);
            setActiveCount(data.runs?.length ?? 0);
            setConnected(true);
        });

        es.addEventListener("run_started", (e) => {
            const data = JSON.parse(e.data);
            setRuns((prev) => {
                if (prev.some((r) => r.runId === data.runId)) return prev;
                return [{ ...data, steps: [], toolCalls: [], elapsedMs: 0 }, ...prev];
            });
        });

        es.addEventListener("trace_step", (e) => {
            const data = JSON.parse(e.data);
            setRuns((prev) =>
                prev.map((r) =>
                    r.runId === data.runId
                        ? {
                              ...r,
                              steps: [
                                  ...r.steps,
                                  {
                                      stepNumber: data.stepNumber,
                                      type: data.type,
                                      content: data.content,
                                      durationMs: data.durationMs,
                                      timestamp: data.timestamp
                                  }
                              ]
                          }
                        : r
                )
            );
        });

        es.addEventListener("tool_call", (e) => {
            const data = JSON.parse(e.data);
            setRuns((prev) =>
                prev.map((r) =>
                    r.runId === data.runId
                        ? {
                              ...r,
                              toolCalls: [
                                  ...r.toolCalls,
                                  {
                                      id: data.id,
                                      toolKey: data.toolKey,
                                      mcpServerId: data.mcpServerId,
                                      status: data.status,
                                      durationMs: data.durationMs,
                                      createdAt: new Date().toISOString()
                                  }
                              ]
                          }
                        : r
                )
            );
        });

        es.addEventListener("run_completed", (e) => {
            const data = JSON.parse(e.data);
            setRuns((prev) =>
                prev.map((r) => (r.runId === data.runId ? { ...r, status: data.status } : r))
            );
            setTimeout(() => {
                setRuns((prev) => prev.filter((r) => r.runId !== data.runId));
            }, 5000);
        });

        es.addEventListener("heartbeat", (e) => {
            const data = JSON.parse(e.data);
            setActiveCount(data.activeRuns ?? 0);
        });

        es.onerror = () => {
            setConnected(false);
        };

        return () => {
            es.close();
        };
    }, []);

    // Tick elapsed time
    useEffect(() => {
        const timer = setInterval(() => {
            setRuns((prev) =>
                prev.map((r) => ({
                    ...r,
                    elapsedMs: Date.now() - new Date(r.startedAt).getTime()
                }))
            );
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="space-y-4">
            {/* Wiretap header */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                    <span
                        className={cn(
                            "relative flex h-2.5 w-2.5",
                            connected ? "text-emerald-500" : "text-red-500"
                        )}
                    >
                        {connected && (
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                        )}
                        <span
                            className={cn(
                                "relative inline-flex h-2.5 w-2.5 rounded-full",
                                connected ? "bg-emerald-500" : "bg-red-500"
                            )}
                        />
                    </span>
                    <span className="text-muted-foreground text-sm font-medium">
                        {connected ? "Connected" : "Reconnecting..."}
                    </span>
                </div>
                <Badge variant="outline" className="ml-auto">
                    {activeCount} active {activeCount === 1 ? "run" : "runs"}
                </Badge>
            </div>

            {/* Active runs */}
            {runs.length === 0 ? (
                <Card>
                    <CardContent className="py-16 text-center">
                        <div className="text-muted-foreground">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed">
                                <HugeiconsIcon
                                    icon={icons["activity"]!}
                                    className="size-8 opacity-30"
                                />
                            </div>
                            <p className="text-lg font-medium">No active executions</p>
                            <p className="mt-1 text-sm">
                                Agent runs will appear here in real-time with their full execution
                                trace as they happen.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                    {runs.map((run) => (
                        <WiretapRunCard
                            key={run.runId}
                            run={run}
                            isExpanded={expandedRun === run.runId}
                            onToggle={() =>
                                setExpandedRun(expandedRun === run.runId ? null : run.runId)
                            }
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function WiretapRunCard({
    run,
    isExpanded,
    onToggle
}: {
    run: WiretapRun;
    isExpanded: boolean;
    onToggle: () => void;
}) {
    const isFinished = run.status === "COMPLETED" || run.status === "FAILED";
    const stepsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isExpanded && stepsRef.current) {
            stepsRef.current.scrollTop = stepsRef.current.scrollHeight;
        }
    }, [run.steps.length, run.toolCalls.length, isExpanded]);

    const traceEntries = useMemo(() => {
        const entries: Array<{
            key: string;
            time: string;
            type: "step" | "tool";
            label: string;
            detail: string;
            status: string;
        }> = [];

        for (const step of run.steps) {
            entries.push({
                key: `step-${step.stepNumber}`,
                time: step.timestamp,
                type: "step",
                label: step.type,
                detail:
                    typeof step.content === "string"
                        ? step.content.slice(0, 200)
                        : JSON.stringify(step.content).slice(0, 200),
                status: "completed"
            });
        }

        for (const tc of run.toolCalls) {
            entries.push({
                key: `tc-${tc.id}`,
                time: tc.createdAt,
                type: "tool",
                label: tc.toolKey,
                detail: tc.mcpServerId ? `via ${tc.mcpServerId}` : "",
                status: tc.status
            });
        }

        entries.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        return entries;
    }, [run.steps, run.toolCalls]);

    return (
        <Card
            className={cn(
                "relative overflow-hidden transition-all duration-300",
                !isFinished && "border-blue-400/30 dark:border-blue-500/20",
                isFinished && run.status === "COMPLETED" && "opacity-60",
                isFinished && run.status === "FAILED" && "border-red-400/30 opacity-80"
            )}
        >
            {/* Running pulse */}
            {!isFinished && (
                <div className="absolute top-0 right-0 left-0 h-0.5 overflow-hidden">
                    <div className="animate-wiretap-progress h-full w-[200%] bg-linear-to-r from-blue-500 via-cyan-400 to-blue-500" />
                </div>
            )}

            <CardContent className="p-4">
                <button onClick={onToggle} className="flex w-full items-start gap-3 text-left">
                    {/* Agent avatar */}
                    <div
                        className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-xs font-bold text-white",
                            getAgentColor(run.agentSlug),
                            !isFinished && "animate-pulse"
                        )}
                    >
                        {getAgentInitials(run.agentName, run.agentSlug)}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold">
                                {run.agentName || run.agentSlug}
                            </span>
                            <span
                                className={cn(
                                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                                    !isFinished
                                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                        : run.status === "COMPLETED"
                                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                )}
                            >
                                {isFinished ? run.status : "RUNNING"}
                            </span>
                            <span className="text-muted-foreground ml-auto shrink-0 font-mono text-xs tabular-nums">
                                {formatDuration(run.elapsedMs ?? null)}
                            </span>
                        </div>
                        <p className="text-muted-foreground mt-0.5 truncate text-xs">
                            {run.inputText}
                        </p>
                    </div>
                </button>

                {/* Trace entries */}
                {isExpanded && (
                    <div
                        ref={stepsRef}
                        className="mt-3 max-h-64 space-y-1 overflow-y-auto border-t pt-3"
                    >
                        {traceEntries.length === 0 ? (
                            <div className="text-muted-foreground flex items-center gap-2 py-4 text-center text-xs">
                                <span className="mx-auto flex items-center gap-2">
                                    <span className="relative flex h-2 w-2">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75" />
                                        <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                                    </span>
                                    Waiting for trace data...
                                </span>
                            </div>
                        ) : (
                            traceEntries.map((entry, i) => (
                                <div
                                    key={entry.key}
                                    className={cn(
                                        "flex items-start gap-2 rounded px-2 py-1 text-xs",
                                        i === traceEntries.length - 1 &&
                                            !isFinished &&
                                            "animate-in fade-in slide-in-from-bottom-1 bg-muted/50 duration-300"
                                    )}
                                >
                                    <div className="mt-1 flex shrink-0 flex-col items-center">
                                        <div
                                            className={cn(
                                                "h-2 w-2 rounded-full",
                                                entry.type === "tool"
                                                    ? entry.status === "completed"
                                                        ? "bg-emerald-500"
                                                        : entry.status === "failed"
                                                          ? "bg-red-500"
                                                          : "bg-amber-500"
                                                    : "bg-blue-500"
                                            )}
                                        />
                                        {i < traceEntries.length - 1 && (
                                            <div className="bg-border mt-0.5 h-3 w-px" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <span
                                                className={cn(
                                                    "font-medium",
                                                    entry.type === "tool"
                                                        ? "text-amber-700 dark:text-amber-400"
                                                        : "text-foreground/80"
                                                )}
                                            >
                                                {entry.type === "tool" ? (
                                                    <span className="font-mono">{entry.label}</span>
                                                ) : (
                                                    entry.label
                                                )}
                                            </span>
                                            {entry.detail && (
                                                <span className="text-muted-foreground truncate text-[10px]">
                                                    {entry.detail}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}

                        {/* Live cursor */}
                        {!isFinished && (
                            <div className="flex items-center gap-2 px-2 py-1">
                                <span className="relative flex h-2 w-2">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75" />
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                                </span>
                                <span className="text-muted-foreground text-[10px] italic">
                                    Processing...
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* Step/tool count when collapsed */}
                {!isExpanded && traceEntries.length > 0 && (
                    <button
                        onClick={onToggle}
                        className="text-muted-foreground mt-2 flex items-center gap-2 text-[10px]"
                    >
                        <span>
                            {run.steps.length} step{run.steps.length !== 1 ? "s" : ""}
                        </span>
                        {run.toolCalls.length > 0 && (
                            <span>
                                {run.toolCalls.length} tool call
                                {run.toolCalls.length !== 1 ? "s" : ""}
                            </span>
                        )}
                        <span className="ml-auto">Click to expand</span>
                    </button>
                )}
            </CardContent>
        </Card>
    );
}

// ─── Trace Chain Drawer ───────────────────────────────────────────────────────

function TraceChainDrawer({
    networkRunId,
    onClose
}: {
    networkRunId: string;
    onClose: () => void;
}) {
    const [chain, setChain] = useState<CausalNode | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchChain = useCallback(async (id: string) => {
        try {
            const res = await fetch(`/api/godmode/trace-chain?networkRunId=${id}`);
            const data = await res.json();
            if (data.success) {
                setChain(data.chain);
            } else {
                setError(data.error || "Failed to load trace chain");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchChain(networkRunId);
    }, [networkRunId, fetchChain]);

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

            {/* Drawer */}
            <div className="animate-in slide-in-from-right fixed top-0 right-0 bottom-0 z-50 flex w-full max-w-lg flex-col border-l bg-white shadow-xl duration-200 dark:bg-gray-950">
                {/* Header */}
                <div className="flex items-center justify-between border-b px-5 py-4">
                    <div>
                        <h2 className="text-lg font-semibold">Causal Trace Chain</h2>
                        <p className="text-muted-foreground text-xs">
                            Full execution path across agent boundaries
                        </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        <HugeiconsIcon icon={icons["cancel"]!} className="size-4" />
                    </Button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5">
                    {loading ? (
                        <div className="space-y-3">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="flex gap-3">
                                    <Skeleton className="h-6 w-6 rounded-full" />
                                    <div className="flex-1 space-y-1">
                                        <Skeleton className="h-4 w-3/4" />
                                        <Skeleton className="h-3 w-1/2" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : error ? (
                        <div className="py-8 text-center">
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    ) : chain ? (
                        <CausalNodeTree node={chain} depth={0} />
                    ) : null}
                </div>
            </div>
        </>
    );
}

const NODE_TYPE_STYLES: Record<string, { color: string; bg: string; border: string }> = {
    trigger: {
        color: "text-yellow-700 dark:text-yellow-400",
        bg: "bg-yellow-50 dark:bg-yellow-950/30",
        border: "border-yellow-300 dark:border-yellow-700"
    },
    network: {
        color: "text-violet-700 dark:text-violet-400",
        bg: "bg-violet-50 dark:bg-violet-950/30",
        border: "border-violet-300 dark:border-violet-700"
    },
    network_step: {
        color: "text-violet-600 dark:text-violet-400",
        bg: "bg-violet-50/50 dark:bg-violet-950/20",
        border: "border-violet-200 dark:border-violet-800"
    },
    workflow: {
        color: "text-indigo-700 dark:text-indigo-400",
        bg: "bg-indigo-50 dark:bg-indigo-950/30",
        border: "border-indigo-300 dark:border-indigo-700"
    },
    workflow_step: {
        color: "text-indigo-600 dark:text-indigo-400",
        bg: "bg-indigo-50/50 dark:bg-indigo-950/20",
        border: "border-indigo-200 dark:border-indigo-800"
    },
    agent_run: {
        color: "text-blue-700 dark:text-blue-400",
        bg: "bg-blue-50 dark:bg-blue-950/30",
        border: "border-blue-300 dark:border-blue-700"
    },
    tool_call: {
        color: "text-amber-700 dark:text-amber-400",
        bg: "bg-amber-50 dark:bg-amber-950/30",
        border: "border-amber-200 dark:border-amber-800"
    }
};

function CausalNodeTree({ node, depth }: { node: CausalNode; depth: number }) {
    const [expanded, setExpanded] = useState(depth < 3);
    const styles = NODE_TYPE_STYLES[node.type] || NODE_TYPE_STYLES.tool_call!;
    const hasChildren = node.children.length > 0;

    const statusDot =
        node.status === "COMPLETED" || node.status === "completed" || node.status === "success"
            ? "bg-emerald-500"
            : node.status === "FAILED" || node.status === "failed" || node.status === "failure"
              ? "bg-red-500"
              : node.status === "RUNNING"
                ? "bg-blue-500 animate-pulse"
                : "bg-gray-400";

    return (
        <div className={cn("relative", depth > 0 && "mt-2 ml-5")}>
            {/* Connector line */}
            {depth > 0 && <div className="bg-border absolute top-3 -left-3 h-px w-3" />}
            {depth > 0 && <div className="bg-border absolute -top-2 bottom-0 -left-3 w-px" />}

            {/* Node */}
            <div
                className={cn("rounded-lg border p-3 transition-colors", styles.bg, styles.border)}
            >
                <button
                    onClick={() => hasChildren && setExpanded(!expanded)}
                    className="flex w-full items-start gap-2 text-left"
                    disabled={!hasChildren}
                >
                    <div className={cn("mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full", statusDot)} />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <span className={cn("text-sm font-semibold", styles.color)}>
                                {node.label}
                            </span>
                            {node.durationMs !== null && (
                                <span className="text-muted-foreground text-[10px] tabular-nums">
                                    {formatDuration(node.durationMs)}
                                </span>
                            )}
                            {hasChildren && (
                                <span className="text-muted-foreground ml-auto text-[10px]">
                                    {expanded ? "collapse" : `${node.children.length} children`}
                                </span>
                            )}
                        </div>

                        {/* Metadata summary */}
                        {typeof node.metadata.inputPreview === "string" && (
                            <p className="text-muted-foreground mt-1 truncate text-xs">
                                {node.metadata.inputPreview}
                            </p>
                        )}
                        {typeof node.metadata.outputPreview === "string" && (
                            <p className="mt-0.5 truncate text-xs text-emerald-600 dark:text-emerald-400">
                                {node.metadata.outputPreview}
                            </p>
                        )}
                        {typeof node.metadata.toolKey === "string" && (
                            <p className="text-muted-foreground mt-0.5 font-mono text-[10px]">
                                {node.metadata.toolKey}
                            </p>
                        )}

                        {/* Metrics row */}
                        <div className="text-muted-foreground mt-1 flex gap-3 text-[10px]">
                            {typeof node.metadata.totalTokens === "number" &&
                                node.metadata.totalTokens > 0 && (
                                    <span>{formatTokens(node.metadata.totalTokens)}</span>
                                )}
                            {typeof node.metadata.costUsd === "number" &&
                                node.metadata.costUsd > 0 && (
                                    <span>{formatCost(node.metadata.costUsd)}</span>
                                )}
                            {typeof node.metadata.totalCostUsd === "number" &&
                                node.metadata.totalCostUsd > 0 && (
                                    <span>{formatCost(node.metadata.totalCostUsd)}</span>
                                )}
                            {typeof node.metadata.modelName === "string" && (
                                <span className="font-mono">{node.metadata.modelName}</span>
                            )}
                        </div>
                    </div>
                </button>
            </div>

            {/* Children */}
            {expanded &&
                node.children.map((child) => (
                    <CausalNodeTree key={child.id} node={child} depth={depth + 1} />
                ))}
        </div>
    );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function GodModePage() {
    const router = useRouter();
    const [events, setEvents] = useState<ActivityEvent[]>([]);
    const [metrics, setMetrics] = useState<FeedMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [isLive, setIsLive] = useState(true);
    const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set());
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const lastTimestampRef = useRef<string | null>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const initialLoadRef = useRef(true);

    const [activeView, setActiveView] = useState<GodModeView>("feed");
    const [chainTarget, setChainTarget] = useState<string | null>(null);

    const fetchEvents = useCallback(
        async (opts?: { since?: string; append?: boolean }) => {
            try {
                const params = new URLSearchParams();
                params.set("limit", "50");
                if (opts?.since) params.set("since", opts.since);
                if (selectedAgent) params.set("agentSlug", selectedAgent);
                if (typeFilter !== "all") params.set("type", typeFilter);
                if (searchQuery) params.set("search", searchQuery);

                const res = await fetch(`/api/activity?${params.toString()}`);
                if (!res.ok) return;

                const data = await res.json();
                if (!data.success) return;

                const incoming: ActivityEvent[] = data.events;

                if (opts?.append) {
                    if (incoming.length > 0) {
                        const incomingIds = new Set(incoming.map((e: ActivityEvent) => e.id));
                        setNewEventIds(incomingIds);
                        setTimeout(() => setNewEventIds(new Set()), 2000);

                        setEvents((prev) => {
                            const existingIds = new Set(prev.map((e) => e.id));
                            const deduped = incoming.filter(
                                (e: ActivityEvent) => !existingIds.has(e.id)
                            );
                            return [...deduped, ...prev].slice(0, 200);
                        });
                        lastTimestampRef.current = incoming[0]!.timestamp;
                    }
                } else {
                    setEvents(incoming);
                    if (incoming.length > 0) {
                        lastTimestampRef.current = incoming[0]!.timestamp;
                    }
                }

                if (data.fullMetrics) {
                    setMetrics(data.fullMetrics);
                } else if (!opts?.append) {
                    setMetrics(data.metrics);
                }
            } catch (err) {
                console.error("[GodMode] Failed to fetch events:", err);
            } finally {
                setLoading(false);
                initialLoadRef.current = false;
            }
        },
        [selectedAgent, typeFilter, searchQuery]
    );

    // Initial load
    useEffect(() => {
        setLoading(true);
        initialLoadRef.current = true;
        fetchEvents();
    }, [fetchEvents]);

    // Polling for live updates
    useEffect(() => {
        if (!isLive) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            return;
        }

        pollingRef.current = setInterval(() => {
            if (lastTimestampRef.current) {
                fetchEvents({ since: lastTimestampRef.current, append: true });
            } else {
                fetchEvents();
            }
        }, POLL_INTERVAL_MS);

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [isLive, fetchEvents]);

    const handleAgentClick = useCallback(
        (slug: string) => {
            router.push(`/agents/${slug}`);
        },
        [router]
    );

    const handleRunClick = useCallback(
        (runId: string, agentSlug: string) => {
            router.push(`/agents/${agentSlug}/runs?runId=${runId}`);
        },
        [router]
    );

    const handleAgentFilter = useCallback((slug: string | null) => {
        setSelectedAgent(slug);
        lastTimestampRef.current = null;
    }, []);

    const handleChainClick = useCallback((networkRunId: string) => {
        setChainTarget(networkRunId);
    }, []);

    const activeAgents = useMemo(() => {
        return metrics?.byAgent ?? [];
    }, [metrics]);

    return (
        <div className="h-full overflow-y-auto">
            <div className="container mx-auto space-y-6 py-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold">God Mode</h1>
                            {activeView === "feed" && (
                                <button
                                    onClick={() => setIsLive(!isLive)}
                                    className={cn(
                                        "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                                        isLive
                                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                            : "bg-muted text-muted-foreground"
                                    )}
                                >
                                    {isLive && (
                                        <span className="relative flex h-2 w-2">
                                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                                        </span>
                                    )}
                                    {isLive ? "LIVE" : "Paused"}
                                </button>
                            )}
                        </div>
                        <p className="text-muted-foreground mt-1">
                            {activeView === "feed"
                                ? "Real-time feed of every agent execution, network routing, and system event across the platform."
                                : "Live execution traces streaming from all running agents across the platform."}
                        </p>
                    </div>
                </div>

                {/* View tabs */}
                <div className="flex items-center gap-1 border-b">
                    <button
                        onClick={() => setActiveView("feed")}
                        className={cn(
                            "relative px-4 py-2 text-sm font-medium transition-colors",
                            activeView === "feed"
                                ? "text-foreground"
                                : "text-muted-foreground hover:text-foreground/70"
                        )}
                    >
                        Feed
                        {activeView === "feed" && (
                            <span className="bg-primary absolute right-0 bottom-0 left-0 h-0.5 rounded-t" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveView("wiretap")}
                        className={cn(
                            "relative flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors",
                            activeView === "wiretap"
                                ? "text-foreground"
                                : "text-muted-foreground hover:text-foreground/70"
                        )}
                    >
                        Wiretap
                        {activeView === "wiretap" && (
                            <span className="bg-primary absolute right-0 bottom-0 left-0 h-0.5 rounded-t" />
                        )}
                    </button>
                </div>

                {/* Feed view */}
                {activeView === "feed" && (
                    <>
                        {/* Stats bar */}
                        <StatsBar metrics={metrics} />

                        {/* Filters */}
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="max-w-sm min-w-[200px] flex-1">
                                <Input
                                    placeholder="Search events..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        lastTimestampRef.current = null;
                                    }}
                                    className="h-9"
                                />
                            </div>
                            <Select
                                value={typeFilter}
                                onValueChange={(val) => {
                                    setTypeFilter(val ?? "all");
                                    lastTimestampRef.current = null;
                                }}
                            >
                                <SelectTrigger className="h-9 w-[180px]">
                                    <SelectValue placeholder="All types" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="RUN_STARTED,RUN_COMPLETED,RUN_FAILED">
                                        Agent Runs
                                    </SelectItem>
                                    <SelectItem value="NETWORK_ROUTED,NETWORK_COMPLETED">
                                        Network
                                    </SelectItem>
                                    <SelectItem value="TASK_CREATED,TASK_COMPLETED,TASK_FAILED">
                                        Tasks
                                    </SelectItem>
                                    <SelectItem value="CAMPAIGN_STARTED,CAMPAIGN_COMPLETED,CAMPAIGN_FAILED,MISSION_COMPLETED">
                                        Campaigns
                                    </SelectItem>
                                    <SelectItem value="SLACK_MESSAGE_HANDLED,EMAIL_PROCESSED">
                                        Communication
                                    </SelectItem>
                                    <SelectItem value="TRIGGER_FIRED,SCHEDULE_EXECUTED">
                                        Triggers
                                    </SelectItem>
                                    <SelectItem value="HEARTBEAT_RAN,HEARTBEAT_ALERT">
                                        Heartbeats
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            {(selectedAgent || typeFilter !== "all" || searchQuery) && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setSelectedAgent(null);
                                        setTypeFilter("all");
                                        setSearchQuery("");
                                        lastTimestampRef.current = null;
                                    }}
                                >
                                    Clear filters
                                </Button>
                            )}
                        </div>

                        {/* Main content: feed + sidebar */}
                        <div className="flex gap-6">
                            {/* Feed */}
                            <div className="min-w-0 flex-1 space-y-3">
                                {loading && initialLoadRef.current ? (
                                    <FeedSkeleton />
                                ) : events.length === 0 ? (
                                    <Card>
                                        <CardContent className="py-16 text-center">
                                            <div className="text-muted-foreground">
                                                <HugeiconsIcon
                                                    icon={icons["search"]!}
                                                    className="mx-auto mb-4 size-12 opacity-30"
                                                />
                                                <p className="text-lg font-medium">
                                                    No activity yet
                                                </p>
                                                <p className="mt-1 text-sm">
                                                    Agent events will appear here in real-time as
                                                    they happen.
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    events.map((event) => (
                                        <FeedCard
                                            key={event.id}
                                            event={event}
                                            isNew={newEventIds.has(event.id)}
                                            onAgentClick={handleAgentClick}
                                            onRunClick={handleRunClick}
                                            onChainClick={handleChainClick}
                                        />
                                    ))
                                )}
                            </div>

                            {/* Sidebar */}
                            <div className="hidden w-64 shrink-0 space-y-4 lg:block">
                                <ActiveAgentsSidebar
                                    agents={activeAgents}
                                    selectedAgent={selectedAgent}
                                    onSelect={handleAgentFilter}
                                />
                            </div>
                        </div>
                    </>
                )}

                {/* Wiretap view */}
                {activeView === "wiretap" && <WiretapView />}
            </div>

            {/* Trace chain drawer */}
            {chainTarget && (
                <TraceChainDrawer networkRunId={chainTarget} onClose={() => setChainTarget(null)} />
            )}
        </div>
    );
}
