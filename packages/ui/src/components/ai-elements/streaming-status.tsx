"use client";

import { cn } from "../../lib/utils";
import { LoaderIcon } from "./loader";
import type { HTMLAttributes } from "react";
import { memo, useEffect, useRef, useState } from "react";
import { CheckIcon, SparklesIcon, WrenchIcon } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ToolActivity {
    /** Unique ID for the tool call (toolCallId from the stream) */
    id: string;
    /** Human-readable tool name */
    name: string;
    /** Whether the tool is currently running or has completed */
    status: "running" | "complete" | "error";
    /** Duration in ms (populated when complete) */
    durationMs?: number;
}

export interface StreamingStatusProps extends HTMLAttributes<HTMLDivElement> {
    /** Current chat status from useChat */
    status: "submitted" | "streaming" | undefined;
    /** True when assistant text has started rendering in the conversation */
    hasVisibleContent?: boolean;
    /** Optional agent name for contextual feedback, e.g. "Research Agent" */
    agentName?: string;
    /** Active and recently-completed tool calls to show in the activity feed */
    activeTools?: ToolActivity[];
}

// ─── Helper: format elapsed time ─────────────────────────────────────────────

function formatElapsed(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
}

// ─── Helper: humanize tool name ──────────────────────────────────────────────

function humanizeToolName(name: string): string {
    return name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Phase detection ─────────────────────────────────────────────────────────

type Phase =
    | "thinking-initial"
    | "thinking-named"
    | "working"
    | "using-tools"
    | "composing"
    | "hidden";

function resolvePhase(
    status: "submitted" | "streaming" | undefined,
    hasVisibleContent: boolean,
    elapsedSeconds: number,
    agentName: string | undefined,
    hasActiveTools: boolean
): Phase {
    if (!status) return "hidden";
    if (status === "streaming" && hasVisibleContent) return "hidden";

    if (hasActiveTools) return "using-tools";

    if (status === "submitted") {
        if (elapsedSeconds < 2) return "thinking-initial";
        if (elapsedSeconds < 5 && agentName) return "thinking-named";
        return "working";
    }

    // streaming but no visible content yet
    return "composing";
}

function phaseLabel(phase: Phase, agentName?: string): string {
    switch (phase) {
        case "thinking-initial":
            return "Thinking";
        case "thinking-named":
            return `${agentName} is thinking`;
        case "working":
            return "Working on it";
        case "using-tools":
            return "Using tools";
        case "composing":
            return "Composing response";
        default:
            return "";
    }
}

// ─── Animated dots (smoother than before) ────────────────────────────────────

function AnimatedDots() {
    return (
        <span className="streaming-dots ml-0.5 inline-flex gap-[1px]">
            <span className="streaming-dot" />
            <span className="streaming-dot" />
            <span className="streaming-dot" />
        </span>
    );
}

// ─── Tool activity item ──────────────────────────────────────────────────────

function ToolActivityItem({ tool }: { tool: ToolActivity }) {
    const displayName = humanizeToolName(tool.name);
    const isRunning = tool.status === "running";

    return (
        <div
            className={cn(
                "streaming-activity-item flex items-center gap-1.5 text-xs",
                isRunning ? "text-muted-foreground" : "text-muted-foreground/60"
            )}
        >
            {isRunning ? (
                <LoaderIcon className="shrink-0 animate-spin" size={11} />
            ) : tool.status === "error" ? (
                <span className="text-destructive shrink-0 text-[11px]">!</span>
            ) : (
                <CheckIcon className="text-primary/70 size-[11px] shrink-0" />
            )}
            <span className="truncate">{isRunning ? `${displayName}...` : displayName}</span>
            {tool.durationMs != null && (
                <span className="text-muted-foreground/40 ml-auto shrink-0 tabular-nums">
                    {(tool.durationMs / 1000).toFixed(1)}s
                </span>
            )}
        </div>
    );
}

// ─── Main component ──────────────────────────────────────────────────────────

export const StreamingStatus = memo(
    ({
        status,
        hasVisibleContent = false,
        agentName,
        activeTools = [],
        className,
        ...props
    }: StreamingStatusProps) => {
        const [elapsedSeconds, setElapsedSeconds] = useState(0);
        const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
        const startTimeRef = useRef<number | null>(null);

        // Start / stop the elapsed timer based on status
        useEffect(() => {
            if (status) {
                // Active: start counting
                startTimeRef.current = Date.now();
                setElapsedSeconds(0);

                intervalRef.current = setInterval(() => {
                    if (startTimeRef.current) {
                        setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
                    }
                }, 1000);

                return () => {
                    if (intervalRef.current) clearInterval(intervalRef.current);
                };
            } else {
                // Idle: reset
                if (intervalRef.current) clearInterval(intervalRef.current);
                startTimeRef.current = null;
                setElapsedSeconds(0);
            }
        }, [status]);

        const hasActiveTools = activeTools.some((t) => t.status === "running");
        const phase = resolvePhase(
            status,
            hasVisibleContent,
            elapsedSeconds,
            agentName,
            hasActiveTools
        );

        if (phase === "hidden") return null;

        const label = phaseLabel(phase, agentName);

        return (
            <div
                className={cn(
                    "streaming-status-root",
                    "text-muted-foreground flex flex-col gap-1.5 py-3 text-sm",
                    "animate-in fade-in-0 duration-300",
                    className
                )}
                {...props}
            >
                {/* Primary status row */}
                <div className="flex items-center gap-2">
                    {/* Icon */}
                    <span className="streaming-icon-wrapper relative flex items-center justify-center">
                        {phase === "using-tools" ? (
                            <WrenchIcon
                                className="size-[14px] animate-spin"
                                style={{ animationDuration: "3s" }}
                            />
                        ) : phase === "composing" ? (
                            <SparklesIcon className="streaming-sparkle size-[14px]" />
                        ) : (
                            <span className="streaming-pulse-ring">
                                <LoaderIcon className="animate-spin" size={14} />
                            </span>
                        )}
                    </span>

                    {/* Label + dots */}
                    <span className="streaming-label transition-all duration-300 ease-in-out">
                        {label}
                        <AnimatedDots />
                    </span>

                    {/* Elapsed timer */}
                    <span className="text-muted-foreground/40 ml-auto text-xs tabular-nums">
                        {formatElapsed(elapsedSeconds)}
                    </span>
                </div>

                {/* Tool activity feed */}
                {activeTools.length > 0 && (
                    <div className="flex flex-col gap-0.5 pl-6">
                        {activeTools.map((tool) => (
                            <ToolActivityItem key={tool.id} tool={tool} />
                        ))}
                    </div>
                )}
            </div>
        );
    }
);

StreamingStatus.displayName = "StreamingStatus";
