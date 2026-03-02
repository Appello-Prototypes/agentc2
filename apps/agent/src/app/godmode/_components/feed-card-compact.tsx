"use client";

import { cn } from "@/lib/utils";
import type { ActivityEvent } from "../_lib/types";
import { EVENT_TYPE_CONFIG, DEFAULT_EVENT_CONFIG } from "../_lib/constants";
import {
    getAgentColor,
    getAgentInitials,
    formatRelativeTime,
    formatDuration
} from "../_lib/helpers";

export function FeedCardCompact({
    event,
    isNew,
    onAgentClick,
    onRunClick
}: {
    event: ActivityEvent;
    isNew: boolean;
    onAgentClick: (slug: string) => void;
    onRunClick: (runId: string, agentSlug: string) => void;
}) {
    const config = EVENT_TYPE_CONFIG[event.type] || DEFAULT_EVENT_CONFIG;
    const isFailed = event.status === "failure" || event.type.includes("FAILED");
    const isRunning = event.type === "RUN_STARTED" && event.status !== "success";

    return (
        <div
            className={cn(
                "group flex items-center gap-2 rounded-md border px-3 py-1.5 transition-all",
                "hover:bg-muted/50",
                isFailed && "border-red-500/20 bg-red-500/5",
                isRunning && "border-blue-400/20 bg-blue-500/5",
                isNew && "animate-in fade-in duration-300"
            )}
        >
            <div
                className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    isFailed
                        ? "bg-red-500"
                        : isRunning
                          ? "animate-pulse bg-blue-500"
                          : event.status === "success"
                            ? "bg-emerald-500"
                            : "bg-gray-400"
                )}
            />

            <button
                onClick={() => event.agentSlug && onAgentClick(event.agentSlug)}
                className="shrink-0"
                disabled={!event.agentSlug}
            >
                <div
                    className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full bg-linear-to-br text-[7px] font-bold text-white",
                        getAgentColor(event.agentSlug)
                    )}
                >
                    {getAgentInitials(event.agentName, event.agentSlug)}
                </div>
            </button>

            <span
                className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium",
                    config.bgColor,
                    config.color
                )}
            >
                {config.label}
            </span>

            <span className="text-foreground/70 min-w-0 flex-1 truncate text-xs">
                {event.summary}
            </span>

            {event.durationMs != null && event.durationMs > 0 && (
                <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">
                    {formatDuration(event.durationMs)}
                </span>
            )}

            <span className="text-muted-foreground shrink-0 text-[10px]">
                {formatRelativeTime(event.timestamp)}
            </span>

            {event.runId && event.agentSlug && (
                <button
                    onClick={() => onRunClick(event.runId!, event.agentSlug!)}
                    className="text-primary shrink-0 text-[10px] opacity-0 transition-opacity group-hover:opacity-100"
                >
                    View
                </button>
            )}
        </div>
    );
}
