"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Card, CardContent, Skeleton } from "@repo/ui";
import { ChipSlideout } from "../shared/ChipSlideout";
import { BatchActionBar } from "../shared/BatchActionBar";
import type { CommandViewProps, ReviewItem } from "../../types";
import { formatTimeAgo, getRiskLevel, RISK_COLORS } from "../../types";

interface UrgencyBand {
    id: string;
    label: string;
    items: ReviewItem[];
}

function computeUrgencyScore(review: ReviewItem): number {
    const ageMs = Date.now() - new Date(review.createdAt).getTime();
    const ageHours = ageMs / 3_600_000;
    const riskWeight =
        {
            critical: 5,
            high: 4,
            medium: 3,
            low: 2,
            trivial: 1,
            unknown: 1
        }[getRiskLevel(review)] || 1;
    return ageHours * riskWeight;
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
            bands.push({ id: "attention", label: "Needs Attention", items: needsAttention });
        }
        if (running.length > 0) {
            bands.push({ id: "running", label: "Running", items: running });
        }
        if (completedToday.length > 0) {
            bands.push({ id: "completed", label: "Completed Today", items: completedToday });
        }
        return bands;
    }, [reviews]);
}

const BAND_COLORS: Record<string, string> = {
    attention: "border-l-amber-500",
    running: "border-l-blue-500",
    completed: "border-l-green-500"
};

export function MissionControlGrid({
    filteredReviews,
    loading,
    stepCache,
    onApprove,
    onReject,
    onCancelRun,
    onRetryStep,
    onSkipStep,
    onBatchApprove
}: CommandViewProps) {
    const bands = useUrgencySort(filteredReviews);
    const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null);
    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

    const toggleCheck = (id: string) => {
        setCheckedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    if (loading) {
        return (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} className="h-36 w-full rounded-xl" />
                ))}
            </div>
        );
    }

    if (filteredReviews.length === 0) {
        return (
            <Card>
                <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No workflow runs to display</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {bands.map((band) => (
                <div key={band.id} className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div
                            className={`h-3 w-1 rounded-full ${
                                band.id === "attention"
                                    ? "bg-amber-500"
                                    : band.id === "running"
                                      ? "bg-blue-500"
                                      : "bg-green-500"
                            }`}
                        />
                        <h3 className="text-sm font-semibold">{band.label}</h3>
                        <Badge variant="secondary" className="text-[10px]">
                            {band.items.length}
                        </Badge>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {band.items.map((item) => {
                            const risk = getRiskLevel(item);
                            const riskClass = RISK_COLORS[risk] || "";
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

                            return (
                                <div
                                    key={item.id}
                                    className={`cursor-pointer rounded-lg border-l-4 bg-white shadow-sm transition-all hover:shadow-md dark:bg-gray-900 ${BAND_COLORS[band.id] || "border-l-gray-300"}`}
                                    onClick={() => setSelectedReview(item)}
                                >
                                    <div className="p-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    {isPending && (
                                                        <input
                                                            type="checkbox"
                                                            className="mt-0.5 shrink-0"
                                                            checked={checkedIds.has(item.id)}
                                                            onChange={(e) => {
                                                                e.stopPropagation();
                                                                toggleCheck(item.id);
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    )}
                                                    <span className="truncate text-sm font-medium">
                                                        {item.workflowName ||
                                                            item.workflowSlug ||
                                                            "Workflow"}
                                                    </span>
                                                </div>
                                                <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                                                    {item.reviewContext?.summary ||
                                                        "No summary available"}
                                                </p>
                                            </div>
                                            <Badge
                                                className={`${riskClass} shrink-0 px-1.5 py-0 text-[10px]`}
                                                variant="secondary"
                                            >
                                                {risk}
                                            </Badge>
                                        </div>

                                        {/* Progress */}
                                        {totalSteps > 0 && (
                                            <div className="mt-2">
                                                <div className="flex items-center justify-between text-[10px]">
                                                    <span className="text-muted-foreground">
                                                        {completedSteps}/{totalSteps} steps
                                                    </span>
                                                    <span className="font-mono">{pct}%</span>
                                                </div>
                                                <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                                                    <div
                                                        className="h-full rounded-full bg-green-500 transition-all"
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Footer */}
                                        <div className="mt-2 flex items-center justify-between">
                                            <span className="text-muted-foreground text-[10px]">
                                                {formatTimeAgo(item.createdAt)}
                                            </span>
                                            {isPending && (
                                                <div className="flex gap-1">
                                                    <Button
                                                        size="sm"
                                                        className="h-6 px-2 text-[10px]"
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
                                                        className="h-6 px-2 text-[10px]"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onReject(item);
                                                        }}
                                                    >
                                                        Reject
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
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
