"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, CardContent, Skeleton } from "@repo/ui";
import { ChipSlideout } from "../shared/ChipSlideout";
import { BatchActionBar } from "../shared/BatchActionBar";
import { getApiBase } from "@/lib/utils";
import type { CommandViewProps, ReviewItem, StepData } from "../../types";
import { getRiskLevel, RISK_COLORS, formatTimeAgo } from "../../types";

interface TopologyNode {
    id: string;
    name: string;
    type: string;
    isGate: boolean;
}

interface TopologyEdge {
    from: string;
    to: string;
}

interface WorkflowTopology {
    slug: string;
    name: string;
    nodes: TopologyNode[];
    edges: TopologyEdge[];
    activeRunCount: number;
}

function useTopologyMap(selectedSlug: string | null) {
    const [topologies, setTopologies] = useState<WorkflowTopology[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetch_() {
            try {
                const res = await fetch(`${getApiBase()}/api/workflows/topology`);
                const data = await res.json();
                if (data.success) setTopologies(data.workflows || []);
            } catch {
                /* non-critical */
            } finally {
                setLoading(false);
            }
        }
        fetch_();
    }, []);

    const selected = useMemo(
        () => topologies.find((t) => t.slug === selectedSlug) || topologies[0] || null,
        [topologies, selectedSlug]
    );

    return { topologies, selected, loading };
}

function getNodeItemCounts(
    node: TopologyNode,
    reviews: ReviewItem[],
    stepCache: Map<string, StepData[]>
): ReviewItem[] {
    return reviews.filter((r) => {
        const steps = stepCache.get(r.id) || [];
        return steps.some((s) => {
            const nameMatch =
                s.stepId === node.id || s.stepName === node.name || s.stepId === node.name;
            const isActive =
                s.status.toUpperCase() === "RUNNING" ||
                (r.suspendedStep === s.stepId && s.status.toUpperCase() !== "COMPLETED");
            return nameMatch && isActive;
        });
    });
}

const NODE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
    gate: {
        bg: "bg-amber-50 dark:bg-amber-950/30",
        border: "border-amber-300 dark:border-amber-700",
        text: "text-amber-700 dark:text-amber-300"
    },
    step: {
        bg: "bg-blue-50 dark:bg-blue-950/20",
        border: "border-blue-200 dark:border-blue-800",
        text: "text-blue-700 dark:text-blue-300"
    },
    start: {
        bg: "bg-green-50 dark:bg-green-950/20",
        border: "border-green-200 dark:border-green-800",
        text: "text-green-700 dark:text-green-300"
    },
    end: {
        bg: "bg-gray-50 dark:bg-gray-900",
        border: "border-gray-200 dark:border-gray-700",
        text: "text-gray-700 dark:text-gray-300"
    }
};

function getNodeStyle(node: TopologyNode) {
    if (node.isGate) return NODE_COLORS.gate;
    const t = node.type.toLowerCase();
    if (t.includes("start") || t.includes("trigger")) return NODE_COLORS.start;
    if (t.includes("end") || t.includes("output")) return NODE_COLORS.end;
    return NODE_COLORS.step;
}

export function TopologyFlow({
    filteredReviews,
    loading: reviewsLoading,
    stepCache,
    onApprove,
    onReject,
    onCancelRun,
    onRetryStep,
    onSkipStep,
    onBatchApprove
}: CommandViewProps) {
    const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
    const { topologies, selected, loading: topoLoading } = useTopologyMap(selectedSlug);
    const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null);
    const [expandedNode, setExpandedNode] = useState<string | null>(null);
    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

    const workflowReviews = useMemo(() => {
        if (!selected) return filteredReviews;
        return filteredReviews.filter((r) => r.workflowSlug === selected.slug);
    }, [filteredReviews, selected]);

    const toggleCheck = (id: string) => {
        setCheckedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const loading = reviewsLoading || topoLoading;

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-64 w-full rounded-lg" />
            </div>
        );
    }

    if (topologies.length === 0) {
        return (
            <Card>
                <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">
                        No active workflows with topology data found
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Workflow selector pills */}
            <div className="flex flex-wrap gap-1.5">
                {topologies.map((topo) => (
                    <Button
                        key={topo.slug}
                        variant={selected?.slug === topo.slug ? "default" : "outline"}
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => setSelectedSlug(topo.slug)}
                    >
                        {topo.name}
                        {topo.activeRunCount > 0 && (
                            <Badge variant="secondary" className="px-1 py-0 text-[9px]">
                                {topo.activeRunCount}
                            </Badge>
                        )}
                    </Button>
                ))}
            </div>

            {/* DAG visualization */}
            {selected && (
                <div className="space-y-3">
                    <div className="text-muted-foreground text-xs">
                        {selected.nodes.length} nodes · {selected.edges.length} edges ·{" "}
                        {workflowReviews.length} active runs
                    </div>

                    <div className="flex flex-wrap gap-3">
                        {selected.nodes.map((node) => {
                            const style = getNodeStyle(node);
                            const nodeItems = getNodeItemCounts(node, workflowReviews, stepCache);
                            const isExpanded = expandedNode === node.id;
                            const hasItems = nodeItems.length > 0;

                            return (
                                <div
                                    key={node.id}
                                    className={`rounded-lg border-2 ${style.bg} ${style.border} min-w-[160px] transition-all ${hasItems ? "cursor-pointer ring-2 ring-offset-1" : ""} ${node.isGate ? "ring-amber-300" : "ring-blue-200"}`}
                                    onClick={() => {
                                        if (hasItems) {
                                            setExpandedNode(isExpanded ? null : node.id);
                                        }
                                    }}
                                >
                                    <div className="p-2.5">
                                        <div className="flex items-center gap-1.5">
                                            {node.isGate && <span className="text-xs">⚡</span>}
                                            <span className={`text-xs font-semibold ${style.text}`}>
                                                {node.name}
                                            </span>
                                            {hasItems && (
                                                <Badge
                                                    variant="destructive"
                                                    className="ml-auto px-1.5 py-0 text-[9px]"
                                                >
                                                    {nodeItems.length}
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="text-muted-foreground mt-0.5 text-[10px]">
                                            {node.type}
                                        </div>
                                    </div>

                                    {/* Expanded items list */}
                                    {isExpanded && nodeItems.length > 0 && (
                                        <div className="space-y-1 border-t p-2">
                                            {nodeItems.map((item) => {
                                                const risk = getRiskLevel(item);
                                                const riskClass = RISK_COLORS[risk] || "";
                                                const isPending = item.status === "pending";

                                                return (
                                                    <div
                                                        key={item.id}
                                                        className="flex items-center gap-1.5 rounded bg-white/80 p-1.5 dark:bg-gray-900/80"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedReview(item);
                                                        }}
                                                    >
                                                        {isPending && (
                                                            <input
                                                                type="checkbox"
                                                                className="shrink-0"
                                                                checked={checkedIds.has(item.id)}
                                                                onChange={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleCheck(item.id);
                                                                }}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        )}
                                                        <div className="min-w-0 flex-1">
                                                            <span className="truncate text-[10px] font-medium">
                                                                {item.reviewContext?.summary?.slice(
                                                                    0,
                                                                    40
                                                                ) || item.id.slice(0, 8)}
                                                            </span>
                                                        </div>
                                                        <Badge
                                                            className={`${riskClass} px-1 py-0 text-[8px]`}
                                                            variant="secondary"
                                                        >
                                                            {risk}
                                                        </Badge>
                                                        <span className="text-muted-foreground text-[9px]">
                                                            {formatTimeAgo(item.createdAt)}
                                                        </span>
                                                    </div>
                                                );
                                            })}

                                            {/* Batch action for gate nodes */}
                                            {node.isGate &&
                                                nodeItems.some((i) => i.status === "pending") && (
                                                    <div className="mt-1 flex gap-1">
                                                        <Button
                                                            size="sm"
                                                            className="h-5 flex-1 text-[9px]"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const pendingIds = nodeItems
                                                                    .filter(
                                                                        (i) =>
                                                                            i.status === "pending"
                                                                    )
                                                                    .map((i) => i.id);
                                                                onBatchApprove(pendingIds);
                                                            }}
                                                        >
                                                            Approve All (
                                                            {
                                                                nodeItems.filter(
                                                                    (i) => i.status === "pending"
                                                                ).length
                                                            }
                                                            )
                                                        </Button>
                                                    </div>
                                                )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Edge connections (text-based for now) */}
                    {selected.edges.length > 0 && (
                        <div className="text-muted-foreground flex flex-wrap gap-2 text-[10px]">
                            {selected.edges.map((edge, i) => {
                                const fromNode = selected.nodes.find((n) => n.id === edge.from);
                                const toNode = selected.nodes.find((n) => n.id === edge.to);
                                return (
                                    <span key={i} className="rounded border px-1.5 py-0.5">
                                        {fromNode?.name || edge.from} → {toNode?.name || edge.to}
                                    </span>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            <ChipSlideout
                review={selectedReview}
                open={!!selectedReview}
                onOpenChange={(open) => {
                    if (!open) setSelectedReview(null);
                }}
                steps={selectedReview ? stepCache.get(selectedReview.id) || [] : []}
                onApprove={onApprove}
                onReject={onReject}
                onCancelRun={onCancelRun}
                onRetryStep={onRetryStep}
                onSkipStep={onSkipStep}
            />

            <BatchActionBar
                selectedCount={checkedIds.size}
                onBatchApprove={() => {
                    onBatchApprove([...checkedIds]);
                    setCheckedIds(new Set());
                }}
                onClearSelection={() => setCheckedIds(new Set())}
            />
        </div>
    );
}
