"use client";

import { useState } from "react";
import { Badge, Button, Card, CardContent, HugeiconsIcon, icons } from "@repo/ui";
import { cn } from "@/lib/utils";
import type { ActivityEvent } from "../_lib/types";
import { EVENT_TYPE_CONFIG, DEFAULT_EVENT_CONFIG } from "../_lib/constants";
import {
    getAgentColor,
    getAgentInitials,
    formatRelativeTime,
    formatDuration,
    formatCost,
    formatTokens,
    getSourceLabel,
    getSourceColor,
    getEventInsight,
    getUrgencyStyles
} from "../_lib/helpers";

export function FeedCard({
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

    const insight = getEventInsight(event);
    const urgencyStyles = getUrgencyStyles(insight.urgency);
    const hasExpandableContent =
        inputPreview || outputPreview || event.detail || (toolsUsed && toolsUsed.length > 0);
    const needsAttention = insight.urgency === "critical" || insight.urgency === "action";

    function handleActionClick(kind: string) {
        switch (kind) {
            case "view-run":
                if (event.runId && event.agentSlug) onRunClick(event.runId, event.agentSlug);
                break;
            case "trace-chain":
                if (event.networkRunId && onChainClick) onChainClick(event.networkRunId);
                break;
            case "retry":
            case "dismiss":
                break;
        }
    }

    return (
        <div
            className={cn(
                "group relative transition-all duration-300",
                isNew && "animate-in slide-in-from-top-2 fade-in duration-500"
            )}
        >
            {isRunning && (
                <div className="absolute -inset-px animate-pulse rounded-xl bg-linear-to-r from-blue-500/20 via-cyan-500/20 to-blue-500/20" />
            )}

            <Card
                className={cn(
                    "relative overflow-hidden border transition-all duration-200",
                    "hover:border-foreground/10 hover:shadow-md",
                    isRunning && "border-blue-400/50 dark:border-blue-500/30",
                    isFailed && "border-red-300/50 dark:border-red-500/20",
                    insight.urgency === "action" && "border-amber-300/50 dark:border-amber-500/20"
                )}
            >
                {/* Left accent bar */}
                <div
                    className={cn(
                        "absolute top-0 bottom-0 left-0 w-1",
                        insight.urgency === "critical"
                            ? "bg-red-500"
                            : insight.urgency === "action"
                              ? "bg-amber-500"
                              : event.status === "success"
                                ? "bg-emerald-500"
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
                            {/* Row 1: Agent name, type badge, source, timestamp */}
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

                                {/* Urgency badge — only for actionable items */}
                                {needsAttention && (
                                    <span
                                        className={cn(
                                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                            urgencyStyles.badgeBg,
                                            urgencyStyles.badge
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "inline-block h-1.5 w-1.5 rounded-full",
                                                urgencyStyles.dot,
                                                insight.urgency === "critical" && "animate-pulse"
                                            )}
                                        />
                                        {insight.urgency === "critical"
                                            ? "Action Required"
                                            : "Needs Review"}
                                    </span>
                                )}

                                <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                                    {formatRelativeTime(event.timestamp)}
                                </span>
                            </div>

                            {/* Row 2: Summary */}
                            <p className="text-foreground/80 mt-1 text-sm leading-relaxed">
                                {event.summary}
                            </p>

                            {/* Row 3: "So What" insight line */}
                            <p
                                className={cn(
                                    "mt-1 text-xs leading-snug italic",
                                    insight.urgency === "critical"
                                        ? "text-red-600 dark:text-red-400"
                                        : insight.urgency === "action"
                                          ? "text-amber-600 dark:text-amber-400"
                                          : insight.urgency === "review"
                                            ? "text-blue-600 dark:text-blue-400"
                                            : "text-muted-foreground"
                                )}
                            >
                                {insight.soWhat}
                            </p>

                            {/* Routing info */}
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

                            {/* Expandable detail panel */}
                            {hasExpandableContent && (
                                <div className="mt-2">
                                    <button
                                        onClick={() => setExpanded(!expanded)}
                                        className={cn(
                                            "flex items-center gap-1.5 text-[11px] font-medium transition-colors",
                                            expanded
                                                ? "text-foreground/70"
                                                : "text-muted-foreground hover:text-foreground/70"
                                        )}
                                    >
                                        <HugeiconsIcon
                                            icon={icons["arrow-right"]!}
                                            className={cn(
                                                "size-3 transition-transform duration-200",
                                                expanded && "rotate-90"
                                            )}
                                        />
                                        {expanded ? "Collapse" : "Expand details"}
                                    </button>

                                    {expanded && (
                                        <div className="bg-muted/30 animate-in fade-in slide-in-from-top-1 mt-2 space-y-3 rounded-lg border p-3 text-xs duration-200">
                                            {/* Detail text */}
                                            {event.detail && (
                                                <div>
                                                    <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                                                        Detail
                                                    </span>
                                                    <p className="text-foreground/70 mt-0.5 whitespace-pre-wrap">
                                                        {event.detail}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Input */}
                                            {inputPreview && (
                                                <div>
                                                    <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                                                        Input
                                                    </span>
                                                    <p className="text-foreground/70 mt-0.5 max-h-48 overflow-y-auto whitespace-pre-wrap">
                                                        {inputPreview}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Output */}
                                            {outputPreview && (
                                                <div>
                                                    <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                                                        Output
                                                    </span>
                                                    <p className="text-foreground/70 mt-0.5 max-h-48 overflow-y-auto whitespace-pre-wrap">
                                                        {outputPreview}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Tools used */}
                                            {toolsUsed && toolsUsed.length > 0 && (
                                                <div>
                                                    <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                                                        Tools Used
                                                    </span>
                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                        {toolsUsed.map((tool) => (
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
                                                    </div>
                                                </div>
                                            )}

                                            {/* Metrics row inside expanded */}
                                            {(event.durationMs ||
                                                event.tokenCount ||
                                                event.costUsd) && (
                                                <div className="text-muted-foreground flex items-center gap-4 border-t pt-2 text-[11px]">
                                                    {event.durationMs != null &&
                                                        event.durationMs > 0 && (
                                                            <span className="flex items-center gap-1">
                                                                <HugeiconsIcon
                                                                    icon={icons["clock"]!}
                                                                    className="size-3"
                                                                />
                                                                {formatDuration(event.durationMs)}
                                                            </span>
                                                        )}
                                                    {event.tokenCount != null &&
                                                        event.tokenCount > 0 && (
                                                            <span>
                                                                {formatTokens(event.tokenCount)}
                                                            </span>
                                                        )}
                                                    {event.costUsd != null && event.costUsd > 0 && (
                                                        <span>{formatCost(event.costUsd)}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Bottom row: actions + tags + metrics (when not expanded) */}
                            <div className="mt-2 flex items-center gap-2">
                                {/* Quick action buttons from insight */}
                                {insight.actions.length > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        {insight.actions.map((action) => (
                                            <Button
                                                key={action.label}
                                                variant={
                                                    action.variant === "destructive"
                                                        ? "destructive"
                                                        : action.variant === "default"
                                                          ? "default"
                                                          : "outline"
                                                }
                                                size="sm"
                                                className="h-6 px-2 text-[11px]"
                                                onClick={() => handleActionClick(action.kind)}
                                                disabled={
                                                    action.kind === "view-run" &&
                                                    (!event.runId || !event.agentSlug)
                                                }
                                            >
                                                {action.label}
                                            </Button>
                                        ))}
                                    </div>
                                )}

                                {/* Tags */}
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

                                {/* Compact metrics when NOT expanded */}
                                {!expanded && (
                                    <div className="text-muted-foreground ml-auto flex items-center gap-3 text-[11px]">
                                        {event.durationMs != null && event.durationMs > 0 && (
                                            <span className="flex items-center gap-1">
                                                <HugeiconsIcon
                                                    icon={icons["clock"]!}
                                                    className="size-3"
                                                />
                                                {formatDuration(event.durationMs)}
                                            </span>
                                        )}
                                        {event.costUsd != null && event.costUsd > 0 && (
                                            <span>{formatCost(event.costUsd)}</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
