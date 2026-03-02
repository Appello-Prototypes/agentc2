"use client";

import { useState } from "react";
import { Badge, Card, CardContent, HugeiconsIcon, icons } from "@repo/ui";
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
    getSourceColor
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
                    isFailed && "border-red-300/50 dark:border-red-500/20"
                )}
            >
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
                    <div className="flex items-start gap-3">
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

                            <p className="text-foreground/80 mt-1 text-sm leading-relaxed">
                                {event.summary}
                            </p>

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
