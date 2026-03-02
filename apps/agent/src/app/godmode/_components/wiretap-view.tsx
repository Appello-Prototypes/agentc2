"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, CardContent, HugeiconsIcon, Skeleton, icons } from "@repo/ui";
import { cn } from "@/lib/utils";
import type { WiretapRun } from "../_lib/types";
import { getAgentColor, getAgentInitials, formatDuration } from "../_lib/helpers";

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
            {!isFinished && (
                <div className="absolute top-0 right-0 left-0 h-0.5 overflow-hidden">
                    <div className="animate-wiretap-progress h-full w-[200%] bg-linear-to-r from-blue-500 via-cyan-400 to-blue-500" />
                </div>
            )}

            <CardContent className="p-4">
                <button onClick={onToggle} className="flex w-full items-start gap-3 text-left">
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

export function WiretapView() {
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
