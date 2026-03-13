"use client";

import { useMemo, useState } from "react";
import { Badge, Card, CardContent, Skeleton } from "@repo/ui";
import { ChipSlideout } from "../shared/ChipSlideout";
import { BatchActionBar } from "../shared/BatchActionBar";
import type { CommandViewProps, ReviewItem, StepData } from "../../types";
import { formatTimeAgo, getRiskLevel, RISK_COLORS } from "../../types";

interface PipelineStage {
    id: string;
    label: string;
    items: ReviewItem[];
}

interface SwimLane {
    workflowSlug: string;
    workflowName: string;
    stages: PipelineStage[];
}

function computeStage(review: ReviewItem, steps: StepData[]): string {
    if (review.status !== "pending") return review.status;
    if (!steps || steps.length === 0) return "queued";

    const completedCount = steps.filter((s) => s.status.toUpperCase() === "COMPLETED").length;
    const hasRunning = steps.some((s) => s.status.toUpperCase() === "RUNNING");
    const hasFailed = steps.some((s) => s.status.toUpperCase() === "FAILED");
    const hasSuspended = review.suspendedStep != null;

    if (hasFailed) return "failed";
    if (hasSuspended) return "gate";
    if (hasRunning) return "running";
    if (completedCount === steps.length && steps.length > 0) return "complete";
    if (completedCount > 0) return "running";
    return "queued";
}

const STAGE_ORDER = [
    "queued",
    "running",
    "gate",
    "complete",
    "failed",
    "approved",
    "rejected",
    "feedback"
];

const STAGE_LABELS: Record<string, string> = {
    queued: "Queued",
    running: "Running",
    gate: "Gate / HITL",
    complete: "Complete",
    failed: "Failed",
    approved: "Approved",
    rejected: "Rejected",
    feedback: "Feedback"
};

const STAGE_COLORS: Record<string, string> = {
    queued: "bg-gray-100 dark:bg-gray-800",
    running: "bg-blue-50 dark:bg-blue-950/30",
    gate: "bg-amber-50 dark:bg-amber-950/30",
    complete: "bg-green-50 dark:bg-green-950/30",
    failed: "bg-red-50 dark:bg-red-950/30",
    approved: "bg-green-50 dark:bg-green-950/30",
    rejected: "bg-red-50 dark:bg-red-950/30",
    feedback: "bg-purple-50 dark:bg-purple-950/30"
};

const STAGE_DOT_COLORS: Record<string, string> = {
    queued: "bg-gray-400",
    running: "bg-blue-500 animate-pulse",
    gate: "bg-amber-500",
    complete: "bg-green-500",
    failed: "bg-red-500",
    approved: "bg-green-500",
    rejected: "bg-red-500",
    feedback: "bg-purple-500"
};

function usePipelineGrouping(
    reviews: ReviewItem[],
    stepCache: Map<string, StepData[]>
): SwimLane[] {
    return useMemo(() => {
        const byWorkflow = new Map<string, ReviewItem[]>();
        for (const review of reviews) {
            const slug = review.workflowSlug || "unknown";
            const list = byWorkflow.get(slug) || [];
            list.push(review);
            byWorkflow.set(slug, list);
        }

        const lanes: SwimLane[] = [];
        for (const [slug, items] of byWorkflow) {
            const stageMap = new Map<string, ReviewItem[]>();
            for (const item of items) {
                const steps = stepCache.get(item.id) || [];
                const stage = computeStage(item, steps);
                const list = stageMap.get(stage) || [];
                list.push(item);
                stageMap.set(stage, list);
            }

            const stages: PipelineStage[] = STAGE_ORDER.filter((s) => stageMap.has(s)).map(
                (stageId) => ({
                    id: stageId,
                    label: STAGE_LABELS[stageId] || stageId,
                    items: stageMap.get(stageId) || []
                })
            );

            lanes.push({
                workflowSlug: slug,
                workflowName: items[0]?.workflowName || slug,
                stages
            });
        }

        return lanes.sort((a, b) => a.workflowSlug.localeCompare(b.workflowSlug));
    }, [reviews, stepCache]);
}

export function PipelineSwimlanes({
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
    const lanes = usePipelineGrouping(filteredReviews, stepCache);
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
            <div className="space-y-4">
                {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-40 w-full rounded-xl" />
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
            {lanes.map((lane) => (
                <div key={lane.workflowSlug} className="space-y-2">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">{lane.workflowName}</h3>
                        <Badge variant="outline" className="text-[10px]">
                            {lane.stages.reduce((n, s) => n + s.items.length, 0)} runs
                        </Badge>
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {lane.stages.map((stage) => (
                            <div
                                key={stage.id}
                                className={`min-w-[200px] flex-1 rounded-lg border p-2 ${STAGE_COLORS[stage.id] || ""}`}
                            >
                                <div className="mb-2 flex items-center gap-1.5">
                                    <div
                                        className={`h-2 w-2 rounded-full ${STAGE_DOT_COLORS[stage.id] || "bg-gray-400"}`}
                                    />
                                    <span className="text-xs font-medium">{stage.label}</span>
                                    <Badge
                                        variant="secondary"
                                        className="ml-auto px-1 py-0 text-[10px]"
                                    >
                                        {stage.items.length}
                                    </Badge>
                                </div>
                                <div className="space-y-1.5">
                                    {stage.items.map((item) => {
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

                                        return (
                                            <div
                                                key={item.id}
                                                className="group cursor-pointer rounded-md border bg-white p-2 shadow-sm transition-shadow hover:shadow-md dark:bg-gray-900"
                                                onClick={() => setSelectedReview(item)}
                                            >
                                                <div className="flex items-start gap-1.5">
                                                    {stage.id === "gate" && (
                                                        <input
                                                            type="checkbox"
                                                            className="mt-0.5"
                                                            checked={checkedIds.has(item.id)}
                                                            onChange={(e) => {
                                                                e.stopPropagation();
                                                                toggleCheck(item.id);
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1">
                                                            <span className="truncate text-xs font-medium">
                                                                {item.reviewContext?.summary?.slice(
                                                                    0,
                                                                    50
                                                                ) ||
                                                                    item.workflowName ||
                                                                    item.id.slice(0, 8)}
                                                            </span>
                                                            <Badge
                                                                className={`${riskClass} ml-auto shrink-0 px-1 py-0 text-[9px]`}
                                                                variant="secondary"
                                                            >
                                                                {risk}
                                                            </Badge>
                                                        </div>
                                                        {totalSteps > 0 && (
                                                            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                                                                <div
                                                                    className="h-full rounded-full bg-green-500 transition-all"
                                                                    style={{
                                                                        width: `${pct}%`
                                                                    }}
                                                                />
                                                            </div>
                                                        )}
                                                        <div className="text-muted-foreground mt-0.5 text-[10px]">
                                                            {formatTimeAgo(item.createdAt)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
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
