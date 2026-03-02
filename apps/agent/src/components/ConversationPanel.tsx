"use client";

import { useCallback, useEffect, useState } from "react";
import {
    Badge,
    Button,
    Card,
    CardContent,
    HugeiconsIcon,
    icons,
    Separator,
    Skeleton
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface ThreadMessage {
    role: "user" | "assistant";
    content: string;
    runId: string;
    turnIndex: number;
    timestamp: string;
    durationMs?: number | null;
    tokens?: number | null;
    costUsd?: number | null;
    toolCalls?: Array<{ toolKey: string; success: boolean; error?: string | null }>;
}

interface ThreadRun {
    id: string;
    status: string;
    inputText: string;
    durationMs: number | null;
    totalTokens: number | null;
    costUsd: number | null;
    turnCount: number;
    startedAt: string;
    completedAt: string | null;
    modelName: string | null;
    source: string | null;
}

interface ThreadDetail {
    threadId: string;
    agentSlug: string;
    agentName: string;
    source: string | null;
    firstMessageAt: string;
    lastMessageAt: string;
    totals: {
        runCount: number;
        totalTurns: number;
        totalTokens: number;
        totalCostUsd: number;
        totalDurationMs: number;
    };
    messages: ThreadMessage[];
    runs: ThreadRun[];
}

function formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function formatDuration(ms: number | null | undefined): string {
    if (!ms) return "";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

function formatCost(v: number | null | undefined): string {
    if (!v) return "";
    return v < 1 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`;
}

function formatTokens(v: number | null | undefined): string {
    if (!v) return "";
    return v.toLocaleString();
}

export function ConversationPanel({ threadId, onBack }: { threadId: string; onBack: () => void }) {
    const [data, setData] = useState<ThreadDetail | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchThread = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${getApiBase()}/api/threads/${encodeURIComponent(threadId)}`);
            const json = await res.json();
            if (json.success) {
                setData(json);
            }
        } catch (error) {
            console.error("Failed to fetch thread:", error);
        } finally {
            setLoading(false);
        }
    }, [threadId]);

    useEffect(() => {
        fetchThread();
    }, [fetchThread]);

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="space-y-4">
                <Button variant="ghost" size="sm" onClick={onBack}>
                    <HugeiconsIcon icon={icons["arrow-left"]!} className="mr-1.5 size-4" />
                    Back
                </Button>
                <p className="text-muted-foreground">Thread not found.</p>
            </div>
        );
    }

    // Track run boundaries to show separators
    let lastRunId = "";

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={onBack}>
                        <HugeiconsIcon icon={icons["arrow-left"]!} className="mr-1.5 size-4" />
                        Back
                    </Button>
                    <div>
                        <h2 className="text-xl font-semibold">
                            Conversation with {data.agentName}
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            {formatDateTime(data.firstMessageAt)} &mdash;{" "}
                            {formatDateTime(data.lastMessageAt)}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                    <div className="text-center">
                        <div className="text-muted-foreground text-xs">Runs</div>
                        <div className="font-mono font-medium">{data.totals.runCount}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-muted-foreground text-xs">Turns</div>
                        <div className="font-mono font-medium">{data.totals.totalTurns}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-muted-foreground text-xs">Tokens</div>
                        <div className="font-mono font-medium">
                            {data.totals.totalTokens.toLocaleString()}
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-muted-foreground text-xs">Cost</div>
                        <div className="font-mono font-medium">
                            {formatCost(data.totals.totalCostUsd)}
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-muted-foreground text-xs">Duration</div>
                        <div className="font-mono font-medium">
                            {formatDuration(data.totals.totalDurationMs)}
                        </div>
                    </div>
                </div>
            </div>

            <Separator />

            {/* Messages */}
            <Card>
                <CardContent className="space-y-1 p-4">
                    {data.messages.map((msg, i) => {
                        const showRunBoundary = msg.runId !== lastRunId;
                        lastRunId = msg.runId;
                        const run = showRunBoundary
                            ? data.runs.find((r) => r.id === msg.runId)
                            : null;

                        return (
                            <div key={`${msg.runId}-${msg.turnIndex}-${msg.role}-${i}`}>
                                {showRunBoundary && run && data.runs.length > 1 && (
                                    <div className="flex items-center gap-2 py-3">
                                        <Separator className="flex-1" />
                                        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                                            <Badge variant="outline" className="text-[10px]">
                                                {run.status}
                                            </Badge>
                                            {run.modelName && (
                                                <span>{run.modelName.replace(/-\d{8}$/, "")}</span>
                                            )}
                                            {run.durationMs && (
                                                <span>{formatDuration(run.durationMs)}</span>
                                            )}
                                            {run.totalTokens && (
                                                <span>{formatTokens(run.totalTokens)} tok</span>
                                            )}
                                        </span>
                                        <Separator className="flex-1" />
                                    </div>
                                )}
                                <div
                                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} mb-2`}
                                >
                                    <div
                                        className={`max-w-[75%] rounded-lg px-4 py-3 ${
                                            msg.role === "user"
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-muted"
                                        }`}
                                    >
                                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                        <div
                                            className={`mt-1.5 flex items-center gap-2 text-[10px] ${
                                                msg.role === "user"
                                                    ? "text-primary-foreground/60"
                                                    : "text-muted-foreground"
                                            }`}
                                        >
                                            <span>{formatTime(msg.timestamp)}</span>
                                            {msg.durationMs && (
                                                <span>{formatDuration(msg.durationMs)}</span>
                                            )}
                                            {msg.tokens && (
                                                <span>{formatTokens(msg.tokens)} tok</span>
                                            )}
                                            {msg.costUsd && <span>{formatCost(msg.costUsd)}</span>}
                                        </div>
                                        {msg.toolCalls && msg.toolCalls.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {msg.toolCalls.map((tc, j) => (
                                                    <Badge
                                                        key={j}
                                                        variant={
                                                            tc.success ? "secondary" : "destructive"
                                                        }
                                                        className="text-[10px]"
                                                    >
                                                        {tc.toolKey}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </CardContent>
            </Card>
        </div>
    );
}
