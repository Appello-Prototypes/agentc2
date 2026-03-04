"use client";

import { cn } from "../../lib/utils";
import { LoaderIcon } from "./loader";
import type { HTMLAttributes } from "react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
    BrainIcon,
    CheckCircle2Icon,
    ChevronDownIcon,
    CircleXIcon,
    SparklesIcon,
    WrenchIcon
} from "lucide-react";

export interface RunActivityEvent {
    id: string;
    type: "thinking" | "tool-start" | "tool-complete" | "tool-error" | "composing" | "submitted";
    label: string;
    detail?: string;
    timestamp: number;
    durationMs?: number;
}

export interface RunActivityLogProps extends HTMLAttributes<HTMLDivElement> {
    status: "submitted" | "streaming" | undefined;
    events: RunActivityEvent[];
    agentName?: string;
}

function formatElapsed(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
}

const EventIcon = memo(
    ({ type, isLatest }: { type: RunActivityEvent["type"]; isLatest: boolean }) => {
        switch (type) {
            case "thinking":
            case "submitted":
                return <BrainIcon className={cn("size-3", isLatest && "animate-pulse")} />;
            case "tool-start":
                return <LoaderIcon className="size-3 animate-spin" size={12} />;
            case "tool-complete":
                return <CheckCircle2Icon className="text-primary size-3" />;
            case "tool-error":
                return <CircleXIcon className="text-destructive size-3" />;
            case "composing":
                return <SparklesIcon className={cn("size-3", isLatest && "animate-pulse")} />;
            default:
                return <BrainIcon className={cn("size-3", isLatest && "animate-pulse")} />;
        }
    }
);
EventIcon.displayName = "EventIcon";

const ActivityEvent = memo(
    ({
        event,
        isLatest,
        isLast
    }: {
        event: RunActivityEvent;
        isLatest: boolean;
        isLast: boolean;
    }) => {
        return (
            <div
                className={cn(
                    "relative flex gap-2.5 text-xs",
                    "animate-in fade-in-0 slide-in-from-left-1 duration-200"
                )}
            >
                <div className="relative flex flex-col items-center">
                    <div
                        className={cn(
                            "relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full",
                            isLatest
                                ? "bg-primary/20 text-primary"
                                : event.type === "tool-error"
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-muted text-muted-foreground/70"
                        )}
                    >
                        <EventIcon type={event.type} isLatest={isLatest} />
                    </div>
                    {!isLast && <div className="bg-border/40 absolute top-5 bottom-0 w-px" />}
                </div>

                <div className="flex min-w-0 flex-1 items-baseline gap-2 pb-2">
                    <span
                        className={cn(
                            "truncate leading-5",
                            isLatest ? "text-foreground font-medium" : "text-muted-foreground"
                        )}
                    >
                        {event.label}
                    </span>
                    {event.durationMs != null && (
                        <span className="text-muted-foreground/40 shrink-0 tabular-nums">
                            {formatElapsed(event.durationMs)}
                        </span>
                    )}
                </div>
            </div>
        );
    }
);
ActivityEvent.displayName = "ActivityEvent";

export const RunActivityLog = memo(
    ({ status, events, agentName, className, ...props }: RunActivityLogProps) => {
        const [isOpen, setIsOpen] = useState(true);
        const [elapsed, setElapsed] = useState(0);
        const startRef = useRef<number | null>(null);
        const wasActive = useRef(false);
        const finalElapsed = useRef(0);

        const isActive = !!status;

        useEffect(() => {
            if (isActive) {
                wasActive.current = true;
                startRef.current = startRef.current ?? Date.now();
                setElapsed(0);
                const interval = setInterval(() => {
                    if (startRef.current) {
                        const ms = Date.now() - startRef.current;
                        setElapsed(ms);
                        finalElapsed.current = ms;
                    }
                }, 1000);
                return () => clearInterval(interval);
            } else if (wasActive.current) {
                wasActive.current = false;
                setIsOpen(false);
            }
        }, [isActive]);

        useEffect(() => {
            if (!isActive) {
                startRef.current = null;
            }
        }, [isActive]);

        const hasEvents = events.length > 0;

        if (!isActive && !hasEvents) return null;

        const toolCount = events.filter(
            (e) => e.type === "tool-start" || e.type === "tool-complete" || e.type === "tool-error"
        ).length;

        const headerLabel = isActive
            ? agentName
                ? `${agentName} is working`
                : "Working"
            : toolCount > 0
              ? `Completed in ${formatElapsed(finalElapsed.current)} · ${toolCount} tool${toolCount !== 1 ? "s" : ""}`
              : `Completed in ${formatElapsed(finalElapsed.current)}`;

        const visibleEvents = useMemo(() => {
            return isOpen ? events : [];
        }, [isOpen, events]);

        return (
            <div
                className={cn(
                    "not-prose my-2 overflow-hidden rounded-lg border",
                    isActive
                        ? "border-primary/20 bg-primary/[0.02]"
                        : "bg-muted/10 border-border/30",
                    className
                )}
                {...props}
            >
                <button
                    type="button"
                    onClick={() => setIsOpen((prev) => !prev)}
                    className="hover:bg-muted/40 flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors"
                >
                    <div
                        className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-md",
                            isActive ? "bg-primary/15" : "bg-muted"
                        )}
                    >
                        {isActive ? (
                            <LoaderIcon className="text-primary size-3 animate-spin" size={12} />
                        ) : (
                            <CheckCircle2Icon className="text-muted-foreground size-3" />
                        )}
                    </div>
                    <span
                        className={cn(
                            "flex-1 text-left text-xs font-medium",
                            isActive ? "text-foreground" : "text-muted-foreground"
                        )}
                    >
                        {headerLabel}
                        {isActive && (
                            <span className="ml-1 inline-flex gap-[1px]">
                                <span className="bg-primary/40 inline-block size-1 animate-bounce rounded-full [animation-delay:0ms]" />
                                <span className="bg-primary/40 inline-block size-1 animate-bounce rounded-full [animation-delay:150ms]" />
                                <span className="bg-primary/40 inline-block size-1 animate-bounce rounded-full [animation-delay:300ms]" />
                            </span>
                        )}
                    </span>

                    {isActive && (
                        <span className="text-muted-foreground/40 text-xs tabular-nums">
                            {formatElapsed(elapsed)}
                        </span>
                    )}

                    <ChevronDownIcon
                        className={cn(
                            "text-muted-foreground size-3.5 shrink-0 transition-transform",
                            isOpen ? "rotate-180" : "rotate-0"
                        )}
                    />
                </button>

                {isOpen && hasEvents && (
                    <div className="border-t px-3 pt-2 pb-2">
                        {visibleEvents.map((event, i) => (
                            <ActivityEvent
                                key={event.id}
                                event={event}
                                isLatest={i === visibleEvents.length - 1 && isActive}
                                isLast={i === visibleEvents.length - 1}
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    }
);

RunActivityLog.displayName = "RunActivityLog";
