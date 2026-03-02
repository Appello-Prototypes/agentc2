"use client";

import { useCallback, useEffect, useState } from "react";
import {
    Badge,
    Button,
    Card,
    CardContent,
    HugeiconsIcon,
    icons,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";
import { ConversationPanel } from "./ConversationPanel";

interface ThreadSummary {
    threadId: string;
    agentId: string | null;
    agentSlug: string | null;
    agentName: string | null;
    source: string | null;
    runCount: number;
    totalTurns: number;
    totalTokens: number;
    totalCostUsd: number;
    totalDurationMs: number;
    firstMessageAt: string;
    lastMessageAt: string;
    lastCompletedAt: string | null;
    firstInput: string | null;
    lastInput: string | null;
    lastOutput: string | null;
    lastStatus: string | null;
}

function formatRelativeTime(dateStr: string): string {
    const d = new Date(dateStr);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return d.toLocaleDateString();
}

function formatCost(v: number | null | undefined): string {
    if (!v) return "-";
    return v < 1 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`;
}

function formatTokens(v: number | null | undefined): string {
    if (!v) return "-";
    return v.toLocaleString();
}

function formatDuration(ms: number | null | undefined): string {
    if (!ms) return "-";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

export function ConversationsListContent({ agentSlug }: { agentSlug?: string }) {
    const [threads, setThreads] = useState<ThreadSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [sourceFilter, setSourceFilter] = useState("all");
    const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
    const [total, setTotal] = useState(0);

    const fetchThreads = useCallback(async () => {
        setLoading(true);
        try {
            const p = new URLSearchParams();
            if (agentSlug) p.set("agentSlug", agentSlug);
            if (search) p.set("search", search);
            if (sourceFilter && sourceFilter !== "all") p.set("source", sourceFilter);
            p.set("limit", "50");

            const res = await fetch(`${getApiBase()}/api/threads?${p.toString()}`);
            const data = await res.json();
            if (data.success) {
                setThreads(data.threads);
                setTotal(data.total);
            }
        } catch (error) {
            console.error("Failed to fetch threads:", error);
        } finally {
            setLoading(false);
        }
    }, [agentSlug, search, sourceFilter]);

    useEffect(() => {
        fetchThreads();
    }, [fetchThreads]);

    if (selectedThreadId) {
        return (
            <ConversationPanel
                threadId={selectedThreadId}
                onBack={() => setSelectedThreadId(null)}
            />
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold">Conversations</h2>
                    <p className="text-muted-foreground text-sm">
                        {total} conversation thread{total !== 1 ? "s" : ""}
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchThreads}>
                    <HugeiconsIcon icon={icons.refresh!} className="mr-1.5 size-4" />
                    Refresh
                </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Input
                    placeholder="Search conversations..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-xs"
                />
                <Select value={sourceFilter} onValueChange={(v) => v && setSourceFilter(v)}>
                    <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Source" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Sources</SelectItem>
                        <SelectItem value="api">API</SelectItem>
                        <SelectItem value="slack">Slack</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="voice">Voice</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="space-y-3 p-4">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Skeleton key={i} className="h-16 w-full" />
                            ))}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Agent</TableHead>
                                    <TableHead>Source</TableHead>
                                    <TableHead>First Message</TableHead>
                                    <TableHead>Last Message</TableHead>
                                    <TableHead className="text-right">Runs</TableHead>
                                    <TableHead className="text-right">Turns</TableHead>
                                    <TableHead className="text-right">Tokens</TableHead>
                                    <TableHead className="text-right">Cost</TableHead>
                                    <TableHead className="text-right">Duration</TableHead>
                                    <TableHead className="text-right">Last Active</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {threads.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={10} className="py-12 text-center">
                                            <p className="text-muted-foreground text-sm">
                                                No conversation threads found
                                            </p>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    threads.map((t) => (
                                        <TableRow
                                            key={t.threadId}
                                            className="hover:bg-muted/50 cursor-pointer"
                                            onClick={() => setSelectedThreadId(t.threadId)}
                                        >
                                            <TableCell>
                                                <span className="text-sm font-medium">
                                                    {t.agentName || "Unknown"}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                {t.source ? (
                                                    <Badge variant="outline" className="text-xs">
                                                        {t.source}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">
                                                        -
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="max-w-[200px] truncate text-sm">
                                                {t.firstInput || "-"}
                                            </TableCell>
                                            <TableCell className="max-w-[200px] truncate text-sm">
                                                {t.lastInput || "-"}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-xs">
                                                {t.runCount}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-xs">
                                                {t.totalTurns}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-xs">
                                                {formatTokens(t.totalTokens)}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-xs">
                                                {formatCost(t.totalCostUsd)}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-xs">
                                                {formatDuration(t.totalDurationMs)}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-right text-xs">
                                                {formatRelativeTime(t.lastMessageAt)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
