"use client";

import { useCallback, useEffect, useState } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Badge,
    Button,
    Skeleton,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";
import type { ChangeLogEntry, FieldChange } from "./types";

interface ChangelogTimelineProps {
    entityType: "agent" | "workflow" | "network";
    entityId: string; // Can be database ID or slug
    title?: string;
}

const ACTION_COLORS: Record<string, string> = {
    create: "bg-green-500 text-white",
    update: "bg-blue-500 text-white",
    rollback: "bg-amber-500 text-white",
    delete: "bg-red-500 text-white"
};

const ACTION_LABELS: Record<string, string> = {
    create: "Created",
    update: "Updated",
    rollback: "Rollback",
    delete: "Deleted"
};

function formatFieldName(field: string): string {
    return field
        .replace(/([A-Z])/g, " $1")
        .replace(/Json$/, "")
        .replace(/^./, (s) => s.toUpperCase())
        .trim();
}

function truncateValue(val: unknown, maxLen = 120): string {
    if (val === null || val === undefined) return "—";
    const str = typeof val === "string" ? val : JSON.stringify(val);
    if (str.length <= maxLen) return str;
    return str.slice(0, maxLen) + "…";
}

function FieldChangeItem({ change }: { change: FieldChange }) {
    const label = formatFieldName(change.field);

    if (change.action === "added" && change.items) {
        return (
            <div className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-green-500" />
                <span>
                    Added {label}:{" "}
                    <span className="text-muted-foreground">{change.items.join(", ")}</span>
                </span>
            </div>
        );
    }

    if (change.action === "removed" && change.items) {
        return (
            <div className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                <span>
                    Removed {label}:{" "}
                    <span className="text-muted-foreground">{change.items.join(", ")}</span>
                </span>
            </div>
        );
    }

    const isLongText =
        (typeof change.before === "string" && change.before.length > 120) ||
        (typeof change.after === "string" && change.after.length > 120);

    if (isLongText) {
        return (
            <Collapsible>
                <div className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                    <div className="min-w-0 flex-1">
                        <CollapsibleTrigger className="text-left hover:underline">
                            {label} modified{" "}
                            <span className="text-muted-foreground text-xs">(click to expand)</span>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2 space-y-2">
                            <div className="rounded border border-red-500/20 bg-red-500/5 p-2">
                                <p className="text-muted-foreground mb-1 text-xs">Before:</p>
                                <pre className="text-xs whitespace-pre-wrap">
                                    {String(change.before ?? "—")}
                                </pre>
                            </div>
                            <div className="rounded border border-green-500/20 bg-green-500/5 p-2">
                                <p className="text-muted-foreground mb-1 text-xs">After:</p>
                                <pre className="text-xs whitespace-pre-wrap">
                                    {String(change.after ?? "—")}
                                </pre>
                            </div>
                        </CollapsibleContent>
                    </div>
                </div>
            </Collapsible>
        );
    }

    return (
        <div className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
            <span>
                {label}:{" "}
                <span className="text-muted-foreground line-through">
                    {truncateValue(change.before)}
                </span>
                {" → "}
                <span>{truncateValue(change.after)}</span>
            </span>
        </div>
    );
}

function ChangeLogCard({ entry }: { entry: ChangeLogEntry }) {
    const changes = Array.isArray(entry.changes) ? (entry.changes as FieldChange[]) : [];

    return (
        <div className="border-muted relative ml-3 border-l-2 pb-8 pl-8 last:border-l-0">
            {/* Timeline dot */}
            <div
                className={`absolute left-0 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full text-[10px] font-bold ${ACTION_COLORS[entry.action] || "bg-muted text-muted-foreground"}`}
            >
                v{entry.version}
            </div>

            <div className="rounded-lg border p-4">
                <div className="mb-2 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                        <Badge
                            variant={entry.action === "rollback" ? "outline" : "default"}
                            className={
                                entry.action === "rollback" ? "border-amber-500 text-amber-500" : ""
                            }
                        >
                            {ACTION_LABELS[entry.action] || entry.action}
                        </Badge>
                        {entry.summary && (
                            <span className="text-muted-foreground text-sm">{entry.summary}</span>
                        )}
                    </div>
                    <div className="shrink-0 text-right">
                        <p className="text-sm">{new Date(entry.createdAt).toLocaleDateString()}</p>
                        <p className="text-muted-foreground text-xs">
                            {new Date(entry.createdAt).toLocaleTimeString()}
                        </p>
                    </div>
                </div>

                {entry.createdBy && (
                    <p className="text-muted-foreground mb-2 text-xs">by {entry.createdBy}</p>
                )}

                {entry.reason && (
                    <div className="mb-3 rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                        <p className="text-xs font-medium text-amber-600">Reason</p>
                        <p className="text-sm">{entry.reason}</p>
                    </div>
                )}

                {changes.length > 0 && (
                    <div className="space-y-1.5">
                        {changes.map((change, i) => (
                            <FieldChangeItem key={i} change={change} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export function ChangelogTimeline({ entityType, entityId, title }: ChangelogTimelineProps) {
    const [entries, setEntries] = useState<ChangeLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [totalCount, setTotalCount] = useState(0);
    const [loadingMore, setLoadingMore] = useState(false);

    const fetchEntries = useCallback(
        async (cursor?: string) => {
            try {
                if (!cursor) setLoading(true);
                else setLoadingMore(true);
                setError(null);

                const url = new URL(`${getApiBase()}/api/changelog`, window.location.origin);
                url.searchParams.set("entityType", entityType);
                url.searchParams.set("entityId", entityId);
                if (cursor) url.searchParams.set("cursor", cursor);

                const res = await fetch(url.toString());
                const data = await res.json();

                if (!data.success) throw new Error(data.error || "Failed to fetch changelog");

                if (cursor) {
                    setEntries((prev) => [...prev, ...data.entries]);
                } else {
                    setEntries(data.entries);
                }
                setNextCursor(data.nextCursor || null);
                setTotalCount(data.totalCount ?? 0);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load changelog");
            } finally {
                setLoading(false);
                setLoadingMore(false);
            }
        },
        [entityType, entityId]
    );

    useEffect(() => {
        if (entityId) fetchEntries();
    }, [fetchEntries, entityId]);

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{title || "Change Log"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-24" />
                    ))}
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{title || "Change Log"}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-8">
                    <p className="text-destructive mb-4 text-sm">{error}</p>
                    <Button size="sm" onClick={() => fetchEntries()}>
                        Retry
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{title || "Change Log"}</CardTitle>
                <CardDescription>
                    {totalCount === 0
                        ? "No changes recorded yet"
                        : `${totalCount} change${totalCount === 1 ? "" : "s"} recorded`}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {entries.length === 0 ? (
                    <div className="text-muted-foreground py-8 text-center text-sm">
                        No changes have been recorded yet. Changes will appear here when the
                        configuration is modified.
                    </div>
                ) : (
                    <>
                        <div>
                            {entries.map((entry) => (
                                <ChangeLogCard key={entry.id} entry={entry} />
                            ))}
                        </div>
                        {nextCursor && (
                            <div className="mt-4 text-center">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fetchEntries(nextCursor)}
                                    disabled={loadingMore}
                                >
                                    {loadingMore ? "Loading..." : "Load More"}
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
