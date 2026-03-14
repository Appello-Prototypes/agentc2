"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, CardContent, Skeleton } from "@repo/ui";
import { ChipSlideout } from "../shared/ChipSlideout";
import { BatchActionBar } from "../shared/BatchActionBar";
import type { CommandViewProps, ReviewItem, StepData } from "../../types";
import { formatTimeAgo, getRiskLevel, RISK_COLORS, getUrgencyClass } from "../../types";

/* ─── Urgency scoring ──────────────────────────────────────────────── */

function computeUrgencyScore(review: ReviewItem): number {
    const ageMs = Date.now() - new Date(review.createdAt).getTime();
    const ageMinutes = ageMs / 60_000;
    const riskWeight =
        { critical: 5, high: 4, medium: 3, low: 2, trivial: 1, unknown: 1 }[getRiskLevel(review)] ||
        1;
    return ageMinutes * riskWeight;
}

/* ─── Filter type ──────────────────────────────────────────────────── */

type FilterPill = "all" | "attention" | "running" | "failed";

/* ─── Band grouping ────────────────────────────────────────────────── */

interface UrgencyBand {
    id: string;
    label: string;
    icon: string;
    color: string;
    dotColor: string;
    items: ReviewItem[];
}

function useUrgencySort(reviews: ReviewItem[]): UrgencyBand[] {
    return useMemo(() => {
        const needsAttention: ReviewItem[] = [];
        const running: ReviewItem[] = [];
        const completedToday: ReviewItem[] = [];

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        for (const review of reviews) {
            if (review.status === "pending") {
                needsAttention.push(review);
            } else if (review.runStatus === "RUNNING") {
                running.push(review);
            } else if (new Date(review.createdAt) >= todayStart) {
                completedToday.push(review);
            }
        }

        needsAttention.sort((a, b) => computeUrgencyScore(b) - computeUrgencyScore(a));
        running.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        completedToday.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        const bands: UrgencyBand[] = [];
        if (needsAttention.length > 0) {
            bands.push({
                id: "attention",
                label: "Needs Attention",
                icon: "⚠",
                color: "text-amber-500",
                dotColor: "bg-amber-500",
                items: needsAttention
            });
        }
        if (running.length > 0) {
            bands.push({
                id: "running",
                label: "Running",
                icon: "▶",
                color: "text-blue-500",
                dotColor: "bg-blue-500",
                items: running
            });
        }
        if (completedToday.length > 0) {
            bands.push({
                id: "completed",
                label: "Completed Today",
                icon: "✓",
                color: "text-green-500",
                dotColor: "bg-green-500",
                items: completedToday
            });
        }
        return bands;
    }, [reviews]);
}

/* ─── Progress color helper ─────────────────────────────────────── */

function getProgressBarColor(review: ReviewItem, steps: StepData[]): string {
    if (review.status === "pending") {
        const hasFailed = steps.some((s) => s.status.toUpperCase() === "FAILED");
        if (hasFailed) return "bg-red-500";
        if (review.suspendedStep) return "bg-amber-500";
        return "bg-blue-500";
    }
    return "bg-green-500";
}

/* ─── Tile left border color based on individual item status ────── */

function getTileBorderColor(review: ReviewItem, steps: StepData[]): string {
    const hasFailed = steps.some((s) => s.status.toUpperCase() === "FAILED");
    if (hasFailed) return "border-l-red-500";
    if (review.status === "pending") {
        if (review.suspendedStep) return "border-l-amber-500";
        return "border-l-amber-400";
    }
    if (review.runStatus === "RUNNING") return "border-l-blue-500";
    return "border-l-green-500";
}

/* ─── Current step finder ───────────────────────────────────────── */

function findCurrentStep(review: ReviewItem, steps: StepData[]): StepData | undefined {
    return steps.find(
        (s) =>
            s.stepId === review.suspendedStep ||
            s.status.toUpperCase() === "RUNNING" ||
            s.status.toUpperCase() === "SUSPENDED"
    );
}

/* ─── Risk dot colors ────────────────────────────────────────────── */

const RISK_DOT: Record<string, string> = {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-amber-400",
    low: "bg-green-500",
    trivial: "bg-gray-400",
    unknown: "bg-gray-400"
};

/* ─── Main component ──────────────────────────────────────────────── */

export function MissionControlGrid({
    filteredReviews,
    loading,
    stepCache,
    onApprove,
    onReject,
    onFeedback,
    onCancelRun,
    onRetryStep,
    onSkipStep,
    onBatchApprove
}: CommandViewProps) {
    const bands = useUrgencySort(filteredReviews);
    const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null);
    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
    const [activeFilter, setActiveFilter] = useState<FilterPill>("all");
    const [selectedTileIndex, setSelectedTileIndex] = useState<number | null>(null);

    const toggleCheck = useCallback((id: string) => {
        setCheckedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const filteredBands = useMemo(() => {
        if (activeFilter === "all") return bands;
        if (activeFilter === "failed") {
            return bands
                .map((b) => ({
                    ...b,
                    items: b.items.filter((r) => {
                        const steps = stepCache.get(r.id) || [];
                        return steps.some((s) => s.status.toUpperCase() === "FAILED");
                    })
                }))
                .filter((b) => b.items.length > 0);
        }
        return bands.filter((b) => b.id === activeFilter);
    }, [bands, activeFilter, stepCache]);

    const allVisibleItems = useMemo(() => filteredBands.flatMap((b) => b.items), [filteredBands]);

    const filterCounts = useMemo(() => {
        const attention = bands.find((b) => b.id === "attention")?.items.length || 0;
        const running = bands.find((b) => b.id === "running")?.items.length || 0;
        const failed = filteredReviews.filter((r) => {
            const steps = stepCache.get(r.id) || [];
            return steps.some((s) => s.status.toUpperCase() === "FAILED");
        }).length;
        return {
            all: filteredReviews.length,
            attention,
            running,
            failed
        };
    }, [bands, filteredReviews, stepCache]);

    /* ─── Keyboard shortcuts ───────────────────────────────────────── */

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (
                e.target instanceof HTMLElement &&
                (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
            )
                return;

            const key = e.key;
            if (key >= "1" && key <= "9") {
                e.preventDefault();
                const idx = parseInt(key) - 1;
                if (idx < allVisibleItems.length) {
                    setSelectedTileIndex(idx);
                    setSelectedReview(allVisibleItems[idx]!);
                }
                return;
            }

            if (selectedTileIndex != null && allVisibleItems[selectedTileIndex]) {
                const item = allVisibleItems[selectedTileIndex]!;
                if (key === "a" && item.status === "pending") {
                    e.preventDefault();
                    onApprove(item);
                } else if (key === "r" && item.status === "pending") {
                    e.preventDefault();
                    onReject(item);
                } else if (key === "f" && item.status === "pending") {
                    e.preventDefault();
                    onFeedback(item);
                }
            }
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [allVisibleItems, selectedTileIndex, onApprove, onReject, onFeedback]);

    if (loading) {
        return (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} className="h-44 w-full rounded-xl" />
                ))}
            </div>
        );
    }

    if (filteredReviews.length === 0) {
        return (
            <Card>
                <CardContent className="py-16 text-center">
                    <div className="mx-auto mb-3 text-5xl opacity-30">🚀</div>
                    <p className="text-base font-semibold">All systems nominal</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                        No active workflow runs. The control room will populate as new runs start.
                    </p>
                </CardContent>
            </Card>
        );
    }

    let tileCounter = 0;

    return (
        <div className="space-y-4">
            {/* Toolbar with filter pills */}
            <div className="flex items-center justify-between rounded-lg border bg-gray-50/50 px-3 py-2 dark:bg-gray-900/50">
                <div className="flex items-center gap-1.5">
                    {(
                        [
                            { id: "all", label: "All" },
                            { id: "attention", label: "Needs Attention" },
                            { id: "running", label: "Running" },
                            { id: "failed", label: "Failed" }
                        ] as { id: FilterPill; label: string }[]
                    ).map((pill) => (
                        <button
                            key={pill.id}
                            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-all ${
                                activeFilter === pill.id
                                    ? "border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-300"
                                    : "border-transparent hover:border-gray-300 hover:bg-gray-100 dark:hover:border-gray-600 dark:hover:bg-gray-800"
                            }`}
                            onClick={() => setActiveFilter(pill.id)}
                        >
                            {pill.label}
                            <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                                {filterCounts[pill.id]}
                            </Badge>
                        </button>
                    ))}
                </div>
                <div className="text-muted-foreground flex items-center gap-2 text-[10px]">
                    <kbd className="rounded border px-1">1-9</kbd> select
                    <kbd className="rounded border px-1">a</kbd> approve
                    <kbd className="rounded border px-1">r</kbd> reject
                </div>
            </div>

            {/* Urgency bands with tiles */}
            {filteredBands.map((band) => (
                <div key={band.id} className="space-y-3">
                    <div className="flex items-center gap-2">
                        <span className={`text-sm ${band.color}`}>{band.icon}</span>
                        <span className="text-[10px] font-bold tracking-widest uppercase">
                            {band.label}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                            {band.items.length}
                        </Badge>
                    </div>

                    <div
                        className="grid gap-3"
                        style={{
                            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))"
                        }}
                    >
                        {band.items.map((item) => {
                            const currentTileIndex = tileCounter++;
                            const risk = getRiskLevel(item);
                            const riskDot = RISK_DOT[risk] || RISK_DOT.unknown!;
                            const steps = stepCache.get(item.id) || [];
                            const completedSteps = steps.filter(
                                (s) => s.status.toUpperCase() === "COMPLETED"
                            ).length;
                            const totalSteps = steps.length;
                            const pct =
                                totalSteps > 0
                                    ? Math.round((completedSteps / totalSteps) * 100)
                                    : 0;
                            const isPending = item.status === "pending";
                            const borderColor = getTileBorderColor(item, steps);
                            const progressColor = getProgressBarColor(item, steps);
                            const currentStep = findCurrentStep(item, steps);
                            const isRunning = steps.some(
                                (s) => s.status.toUpperCase() === "RUNNING"
                            );
                            const isSelected = selectedTileIndex === currentTileIndex;

                            const issueId = item.reviewContext?.issueNumber
                                ? `#${item.reviewContext.issueNumber}`
                                : item.id.slice(0, 8);

                            const ageMs = Date.now() - new Date(item.createdAt).getTime();
                            const isStale = ageMs > 2 * 60 * 60 * 1000;

                            return (
                                <div
                                    key={item.id}
                                    className={`relative cursor-pointer rounded-xl border-l-[3px] bg-white shadow-sm transition-all hover:-translate-y-px hover:shadow-lg dark:bg-gray-900 ${borderColor} ${
                                        band.id === "completed" ? "opacity-70" : ""
                                    } ${
                                        isPending && !isRunning
                                            ? "ring-1 ring-amber-300/30 dark:ring-amber-500/20"
                                            : ""
                                    } ${isSelected ? "ring-2 ring-blue-500" : ""}`}
                                    onClick={() => {
                                        setSelectedTileIndex(currentTileIndex);
                                        setSelectedReview(item);
                                    }}
                                >
                                    {/* Age badge (top-right) */}
                                    <div
                                        className={`absolute top-2 right-2 rounded px-1 py-0.5 font-mono text-[10px] font-medium ${
                                            isStale
                                                ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                                                : "text-muted-foreground"
                                        }`}
                                    >
                                        {formatTimeAgo(item.createdAt)}
                                    </div>

                                    <div className="p-3 pt-2.5">
                                        {/* Header: ID + risk dot */}
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-mono text-xs font-bold">
                                                {issueId}
                                            </span>
                                            <div
                                                className={`h-2 w-2 rounded-full ${riskDot}`}
                                                title={`${risk} risk`}
                                            />
                                            {isPending && (
                                                <input
                                                    type="checkbox"
                                                    className="ml-auto shrink-0"
                                                    checked={checkedIds.has(item.id)}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        toggleCheck(item.id);
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            )}
                                        </div>

                                        {/* Title */}
                                        <p className="mt-1 line-clamp-2 text-[13px] leading-tight font-medium">
                                            {item.reviewContext?.summary ||
                                                item.workflowName ||
                                                "No summary"}
                                        </p>

                                        {/* Progress bar */}
                                        {totalSteps > 0 && (
                                            <div className="mt-2">
                                                <div className="relative h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                                                    <div
                                                        className={`h-full rounded-full transition-all ${progressColor} ${
                                                            isRunning
                                                                ? "animate-[shimmer_1.5s_infinite_linear]"
                                                                : ""
                                                        }`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Meta row */}
                                        <div className="text-muted-foreground mt-1.5 flex items-center gap-2 font-mono text-[10px]">
                                            {totalSteps > 0 && (
                                                <span>
                                                    {completedSteps}/{totalSteps} steps
                                                </span>
                                            )}
                                            <span className="truncate">
                                                {item.workflowName ||
                                                    item.workflowSlug ||
                                                    "Workflow"}
                                            </span>
                                        </div>

                                        {/* Current step indicator */}
                                        {currentStep && (
                                            <div className="mt-1.5 flex items-center gap-1.5">
                                                <div
                                                    className={`h-1.5 w-1.5 rounded-full ${
                                                        currentStep.status.toUpperCase() ===
                                                        "RUNNING"
                                                            ? "bg-blue-500"
                                                            : "bg-amber-500"
                                                    }`}
                                                />
                                                <span className="truncate text-[10px] font-medium">
                                                    {currentStep.stepName || currentStep.stepId}
                                                </span>
                                                <span className="text-muted-foreground text-[10px]">
                                                    (
                                                    {item.suspendedStep
                                                        ? "awaiting"
                                                        : currentStep.status.toLowerCase()}
                                                    )
                                                </span>
                                            </div>
                                        )}

                                        {/* Inline actions */}
                                        {isPending && (
                                            <div className="mt-2 flex gap-1">
                                                <Button
                                                    size="sm"
                                                    className="h-6 flex-1 bg-green-600 px-2 text-[10px] text-white hover:bg-green-700"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onApprove(item);
                                                    }}
                                                >
                                                    Approve
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-6 flex-1 border-red-300 px-2 text-[10px] text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onReject(item);
                                                    }}
                                                >
                                                    Reject
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-6 px-2 text-[10px]"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onFeedback(item);
                                                    }}
                                                >
                                                    Feedback
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            <ChipSlideout
                review={selectedReview}
                open={!!selectedReview}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedReview(null);
                        setSelectedTileIndex(null);
                    }
                }}
                steps={selectedReview ? stepCache.get(selectedReview.id) || [] : []}
                onApprove={onApprove}
                onReject={onReject}
                onFeedback={onFeedback}
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
                onBatchReject={() => {}}
                onClearSelection={() => setCheckedIds(new Set())}
            />
        </div>
    );
}
