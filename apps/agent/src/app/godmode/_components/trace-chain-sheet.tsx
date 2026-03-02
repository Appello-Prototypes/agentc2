"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardContent, HugeiconsIcon, Skeleton, icons } from "@repo/ui";
import { cn, getApiBase } from "@/lib/utils";
import type { CausalNode } from "../_lib/types";
import { NODE_TYPE_STYLES } from "../_lib/constants";
import { formatDuration, formatCost, formatTokens } from "../_lib/helpers";

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
            {depth > 0 && <div className="bg-border absolute top-3 -left-3 h-px w-3" />}
            {depth > 0 && <div className="bg-border absolute -top-2 bottom-0 -left-3 w-px" />}

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

            {expanded &&
                node.children.map((child) => (
                    <CausalNodeTree key={child.id} node={child} depth={depth + 1} />
                ))}
        </div>
    );
}

export function TraceChainDrawer({
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
            const res = await fetch(`${getApiBase()}/api/godmode/trace-chain?networkRunId=${id}`);
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
            <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

            <div className="animate-in slide-in-from-right fixed top-0 right-0 bottom-0 z-50 flex w-full max-w-lg flex-col border-l bg-white shadow-xl duration-200 dark:bg-gray-950">
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
