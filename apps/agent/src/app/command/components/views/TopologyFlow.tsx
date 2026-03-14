"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, CardContent, Skeleton } from "@repo/ui";
import { ChipSlideout } from "../shared/ChipSlideout";
import { getApiBase } from "@/lib/utils";
import type { CommandViewProps, ReviewItem, StepData } from "../../types";
import { getRiskLevel, RISK_COLORS, formatTimeAgo, getUrgencyClass } from "../../types";

/* ─── Topology types ───────────────────────────────────────────────── */

interface TopologyNode {
    id: string;
    name: string;
    type: string;
    isGate: boolean;
}

interface TopologyEdge {
    from: string;
    to: string;
    label?: string;
}

interface WorkflowTopology {
    slug: string;
    name: string;
    nodes: TopologyNode[];
    edges: TopologyEdge[];
    activeRunCount: number;
}

/* ─── Layout: compute row levels from edges ──────────────────────── */

interface LayoutNode extends TopologyNode {
    level: number;
    col: number;
}

function computeLayout(nodes: TopologyNode[], edges: TopologyEdge[]): LayoutNode[] {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const inDegree = new Map<string, number>();
    const children = new Map<string, string[]>();

    for (const n of nodes) {
        inDegree.set(n.id, 0);
        children.set(n.id, []);
    }
    for (const e of edges) {
        inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
        children.get(e.from)?.push(e.to);
    }

    const levels = new Map<string, number>();
    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
        if (deg === 0) {
            queue.push(id);
            levels.set(id, 0);
        }
    }

    while (queue.length > 0) {
        const current = queue.shift()!;
        const currentLevel = levels.get(current) || 0;
        for (const child of children.get(current) || []) {
            const existing = levels.get(child) || 0;
            levels.set(child, Math.max(existing, currentLevel + 1));
            const newInDeg = (inDegree.get(child) || 1) - 1;
            inDegree.set(child, newInDeg);
            if (newInDeg <= 0) queue.push(child);
        }
    }

    for (const n of nodes) {
        if (!levels.has(n.id)) levels.set(n.id, 0);
    }

    const byLevel = new Map<number, string[]>();
    for (const [id, level] of levels) {
        const list = byLevel.get(level) || [];
        list.push(id);
        byLevel.set(level, list);
    }

    return nodes.map((n) => {
        const level = levels.get(n.id) || 0;
        const siblings = byLevel.get(level) || [];
        const col = siblings.indexOf(n.id);
        return { ...n, level, col };
    });
}

/* ─── Topology API hook ────────────────────────────────────────────── */

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

/* ─── Node item counting ──────────────────────────────────────────── */

interface NodeCounts {
    total: number;
    waiting: number;
    failed: number;
    items: ReviewItem[];
}

function computeNodeCounts(
    node: TopologyNode,
    reviews: ReviewItem[],
    stepCache: Map<string, StepData[]>
): NodeCounts {
    const items = reviews.filter((r) => {
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

    const waiting = items.filter((r) => r.suspendedStep != null).length;
    const failed = items.filter((r) => {
        const steps = stepCache.get(r.id) || [];
        return steps.some(
            (s) =>
                (s.stepId === node.id || s.stepName === node.name) &&
                s.status.toUpperCase() === "FAILED"
        );
    }).length;

    return { total: items.length, waiting, failed, items };
}

/* ─── Colors ───────────────────────────────────────────────────────── */

const NODE_STYLES: Record<string, { bg: string; border: string; text: string }> = {
    gate: {
        bg: "bg-amber-50 dark:bg-amber-950/20",
        border: "border-amber-400 dark:border-amber-600",
        text: "text-amber-700 dark:text-amber-300"
    },
    step: {
        bg: "bg-blue-50 dark:bg-blue-950/15",
        border: "border-blue-300 dark:border-blue-700",
        text: "text-blue-700 dark:text-blue-300"
    },
    start: {
        bg: "bg-green-50 dark:bg-green-950/15",
        border: "border-green-300 dark:border-green-700",
        text: "text-green-700 dark:text-green-300"
    },
    end: {
        bg: "bg-green-50 dark:bg-green-950/15",
        border: "border-green-400 dark:border-green-600",
        text: "text-green-600 dark:text-green-400"
    }
};

const RISK_DOT: Record<string, string> = {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-amber-400",
    low: "bg-green-500",
    trivial: "bg-gray-400",
    unknown: "bg-gray-400"
};

function getNodeStyleKey(node: TopologyNode): string {
    if (node.isGate) return "gate";
    const t = node.type.toLowerCase();
    if (t.includes("start") || t.includes("trigger")) return "start";
    if (t.includes("end") || t.includes("output") || t.includes("done")) return "end";
    return "step";
}

/* ─── SVG edge component ──────────────────────────────────────────── */

const NODE_WIDTH = 160;
const NODE_HEIGHT = 56;
const ROW_GAP = 60;
const COL_GAP = 32;

function computeNodePosition(
    node: LayoutNode,
    maxCols: Map<number, number>,
    totalWidth: number
): { x: number; y: number } {
    const cols = maxCols.get(node.level) || 1;
    const rowWidth = cols * NODE_WIDTH + (cols - 1) * COL_GAP;
    const startX = (totalWidth - rowWidth) / 2;
    const x = startX + node.col * (NODE_WIDTH + COL_GAP);
    const y = node.level * (NODE_HEIGHT + ROW_GAP);
    return { x, y };
}

/* ─── Main component ──────────────────────────────────────────────── */

export function TopologyFlow({
    filteredReviews,
    loading: reviewsLoading,
    stepCache,
    onApprove,
    onReject,
    onFeedback,
    onCancelRun,
    onRetryStep,
    onSkipStep,
    onBatchApprove
}: CommandViewProps) {
    const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
    const { topologies, selected, loading: topoLoading } = useTopologyMap(selectedSlug);
    const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null);
    const [drawerNodeId, setDrawerNodeId] = useState<string | null>(null);

    const workflowReviews = useMemo(() => {
        if (!selected) return filteredReviews;
        return filteredReviews.filter((r) => r.workflowSlug === selected.slug);
    }, [filteredReviews, selected]);

    const layoutNodes = useMemo(() => {
        if (!selected) return [];
        return computeLayout(selected.nodes, selected.edges);
    }, [selected]);

    const maxCols = useMemo(() => {
        const m = new Map<number, number>();
        for (const n of layoutNodes) {
            m.set(n.level, Math.max(m.get(n.level) || 0, n.col + 1));
        }
        return m;
    }, [layoutNodes]);

    const maxLevel = useMemo(() => Math.max(0, ...layoutNodes.map((n) => n.level)), [layoutNodes]);

    const svgWidth = 700;
    const svgHeight = (maxLevel + 1) * (NODE_HEIGHT + ROW_GAP);

    const nodeCountsMap = useMemo(() => {
        const map = new Map<string, NodeCounts>();
        if (!selected) return map;
        for (const node of selected.nodes) {
            map.set(node.id, computeNodeCounts(node, workflowReviews, stepCache));
        }
        return map;
    }, [selected, workflowReviews, stepCache]);

    const drawerNode = useMemo(() => {
        if (!drawerNodeId || !selected) return null;
        return selected.nodes.find((n) => n.id === drawerNodeId) || null;
    }, [drawerNodeId, selected]);

    const drawerItems = useMemo(() => {
        if (!drawerNode) return [];
        return nodeCountsMap.get(drawerNode.id)?.items || [];
    }, [drawerNode, nodeCountsMap]);

    const totalGateItems = useMemo(() => {
        let total = 0;
        for (const [, counts] of nodeCountsMap) {
            total += counts.waiting;
        }
        return total;
    }, [nodeCountsMap]);

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
                <CardContent className="py-16 text-center">
                    <div className="mx-auto mb-3 text-5xl opacity-30">🗺</div>
                    <p className="text-base font-semibold">No active flows</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Select a workflow type to visualize its topology. Nodes will populate as
                        runs execute.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Workflow selector pills */}
            <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">
                    Workflow:
                </span>
                <div className="flex flex-wrap gap-1.5">
                    {topologies.map((topo) => (
                        <button
                            key={topo.slug}
                            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-medium transition-all ${
                                selected?.slug === topo.slug
                                    ? "border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-300"
                                    : "border-gray-200 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-500"
                            }`}
                            onClick={() => setSelectedSlug(topo.slug)}
                        >
                            {topo.name}
                            {topo.activeRunCount > 0 && (
                                <span className="text-[10px] opacity-70">
                                    ({topo.activeRunCount})
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* DAG visualization */}
            {selected && (
                <div className="flex flex-col items-center rounded-lg border p-4">
                    <div className="text-muted-foreground mb-3 text-xs">
                        {selected.nodes.length} nodes · {selected.edges.length} edges ·{" "}
                        {workflowReviews.length} active runs
                    </div>

                    <div className="relative w-full overflow-x-auto">
                        <svg
                            width={svgWidth}
                            height={svgHeight}
                            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                            className="mx-auto"
                        >
                            {/* Edges */}
                            {selected.edges.map((edge, i) => {
                                const fromNode = layoutNodes.find((n) => n.id === edge.from);
                                const toNode = layoutNodes.find((n) => n.id === edge.to);
                                if (!fromNode || !toNode) return null;

                                const fromPos = computeNodePosition(fromNode, maxCols, svgWidth);
                                const toPos = computeNodePosition(toNode, maxCols, svgWidth);

                                const x1 = fromPos.x + NODE_WIDTH / 2;
                                const y1 = fromPos.y + NODE_HEIGHT;
                                const x2 = toPos.x + NODE_WIDTH / 2;
                                const y2 = toPos.y;
                                const midY = (y1 + y2) / 2;

                                return (
                                    <g key={i}>
                                        <path
                                            d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            fill="none"
                                            className="text-gray-300 dark:text-gray-600"
                                        />
                                        <circle
                                            cx={x2}
                                            cy={y2}
                                            r={3}
                                            className="fill-gray-400 dark:fill-gray-500"
                                        />
                                    </g>
                                );
                            })}
                        </svg>

                        {/* Node overlays (positioned over SVG) */}
                        <div
                            className="absolute inset-0"
                            style={{ width: svgWidth, margin: "0 auto" }}
                        >
                            {layoutNodes.map((node) => {
                                const pos = computeNodePosition(node, maxCols, svgWidth);
                                const styleKey = getNodeStyleKey(node);
                                const style = NODE_STYLES[styleKey] || NODE_STYLES.step!;
                                const counts = nodeCountsMap.get(node.id) || {
                                    total: 0,
                                    waiting: 0,
                                    failed: 0,
                                    items: []
                                };
                                const hasWaiting = counts.waiting > 0;
                                const hasFailed = counts.failed > 0;
                                const hasItems = counts.total > 0;

                                return (
                                    <div
                                        key={node.id}
                                        className={`absolute cursor-pointer rounded-xl border-2 transition-all hover:-translate-y-px hover:shadow-lg ${style.bg} ${style.border} ${
                                            hasWaiting
                                                ? "shadow-amber-200/30 dark:shadow-amber-500/10"
                                                : ""
                                        }`}
                                        style={{
                                            left: pos.x,
                                            top: pos.y,
                                            width: NODE_WIDTH,
                                            height: NODE_HEIGHT
                                        }}
                                        onClick={() => {
                                            if (hasItems) setDrawerNodeId(node.id);
                                        }}
                                    >
                                        <div className="flex h-full flex-col items-center justify-center px-2">
                                            <span
                                                className={`truncate text-center text-[11px] leading-tight font-bold ${style.text}`}
                                            >
                                                {node.name}
                                            </span>
                                            <span className="text-muted-foreground mt-0.5 font-mono text-[9px]">
                                                {node.type}
                                            </span>
                                        </div>

                                        {/* Count badges */}
                                        {hasItems && !hasFailed && !hasWaiting && (
                                            <div className="absolute -top-2 -right-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1 text-[9px] font-bold text-white">
                                                {counts.total}
                                            </div>
                                        )}
                                        {hasWaiting && (
                                            <div className="absolute -top-2 -right-2 flex h-5 min-w-[20px] animate-pulse items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-black">
                                                {counts.waiting}
                                            </div>
                                        )}
                                        {hasFailed && !hasWaiting && (
                                            <div className="absolute -top-2 -right-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                                                {counts.failed}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="mt-4 flex items-center gap-4">
                        {[
                            { label: "Running", color: "bg-blue-500" },
                            { label: "Human Gate", color: "bg-amber-500" },
                            { label: "Complete", color: "bg-green-500" },
                            { label: "Failed", color: "bg-red-500" },
                            {
                                label: "Queued",
                                color: "border border-gray-400 dark:border-gray-500"
                            }
                        ].map((item) => (
                            <div key={item.label} className="flex items-center gap-1.5">
                                <div className={`h-2 w-2 rounded-full ${item.color}`} />
                                <span className="text-muted-foreground text-[10px]">
                                    {item.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Bottom drawer */}
            {drawerNode && drawerItems.length > 0 && (
                <>
                    <div
                        className="fixed inset-0 z-40 bg-black/50"
                        onClick={() => setDrawerNodeId(null)}
                    />
                    <div className="animate-in slide-in-from-bottom fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[700px] duration-300">
                        <div className="max-h-[380px] overflow-hidden rounded-t-xl border bg-white shadow-2xl dark:bg-gray-900">
                            {/* Drawer header */}
                            <div className="flex items-center justify-between border-b px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <div
                                        className={`h-3 w-3 rounded ${
                                            drawerNode.isGate ? "bg-amber-500" : "bg-blue-500"
                                        }`}
                                    />
                                    <span className="text-sm font-bold">{drawerNode.name}</span>
                                    <Badge variant="secondary" className="text-[10px]">
                                        {drawerItems.length} item
                                        {drawerItems.length !== 1 ? "s" : ""} waiting
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                    {drawerNode.isGate &&
                                        drawerItems.some((i) => i.status === "pending") && (
                                            <Button
                                                size="sm"
                                                className="h-7 bg-green-600 text-white hover:bg-green-700"
                                                onClick={() => {
                                                    const pendingIds = drawerItems
                                                        .filter((i) => i.status === "pending")
                                                        .map((i) => i.id);
                                                    onBatchApprove(pendingIds);
                                                }}
                                            >
                                                Approve All (
                                                {
                                                    drawerItems.filter(
                                                        (i) => i.status === "pending"
                                                    ).length
                                                }
                                                )
                                            </Button>
                                        )}
                                    <button
                                        className="flex h-7 w-7 items-center justify-center rounded-md border text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                                        onClick={() => setDrawerNodeId(null)}
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            {/* Drawer items */}
                            <div className="max-h-[320px] overflow-y-auto">
                                {drawerItems.map((item) => {
                                    const risk = getRiskLevel(item);
                                    const riskDot = RISK_DOT[risk] || RISK_DOT.unknown!;
                                    const isPending = item.status === "pending";
                                    const issueId = item.reviewContext?.issueNumber
                                        ? `#${item.reviewContext.issueNumber}`
                                        : item.id.slice(0, 8);

                                    return (
                                        <div
                                            key={item.id}
                                            className="flex items-center gap-3 border-b px-4 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                        >
                                            <div
                                                className={`h-1.5 w-1.5 shrink-0 rounded-full ${riskDot}`}
                                            />
                                            <span className="font-mono text-xs font-bold">
                                                {issueId}
                                            </span>
                                            <span className="min-w-0 flex-1 truncate text-xs">
                                                {item.reviewContext?.summary ||
                                                    item.workflowName ||
                                                    "—"}
                                            </span>
                                            <Badge
                                                className={`${RISK_COLORS[risk] || ""} shrink-0 px-1.5 py-0 text-[9px]`}
                                                variant="secondary"
                                            >
                                                {risk}
                                            </Badge>
                                            <span
                                                className={`shrink-0 font-mono text-[10px] ${getUrgencyClass(item.createdAt)}`}
                                            >
                                                {formatTimeAgo(item.createdAt)}
                                            </span>
                                            {isPending && (
                                                <div className="flex shrink-0 gap-1">
                                                    <Button
                                                        size="sm"
                                                        className="h-5 bg-green-600 px-2 text-[9px] text-white hover:bg-green-700"
                                                        onClick={() => onApprove(item)}
                                                    >
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-5 border-red-300 px-2 text-[9px] text-red-600"
                                                        onClick={() => onReject(item)}
                                                    >
                                                        Reject
                                                    </Button>
                                                </div>
                                            )}
                                            <button
                                                className="text-muted-foreground shrink-0 text-[10px] hover:underline"
                                                onClick={() => {
                                                    setDrawerNodeId(null);
                                                    setSelectedReview(item);
                                                }}
                                            >
                                                Detail →
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </>
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
                onFeedback={onFeedback}
                onCancelRun={onCancelRun}
                onRetryStep={onRetryStep}
                onSkipStep={onSkipStep}
            />
        </div>
    );
}
