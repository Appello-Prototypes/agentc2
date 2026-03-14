"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, CardContent, Skeleton } from "@repo/ui";
import { ChipSlideout } from "../shared/ChipSlideout";
import { BatchActionBar } from "../shared/BatchActionBar";
import type { CommandViewProps, ReviewItem, StepData } from "../../types";
import { formatTimeAgo, getRiskLevel, RISK_COLORS } from "../../types";

/* ─── Stage definitions with step patterns ─────────────────────────── */

interface StageDefinition {
    id: string;
    label: string;
    isGate: boolean;
    stepPatterns: string[];
}

const DEFAULT_STAGES: StageDefinition[] = [
    {
        id: "triage",
        label: "Triage",
        isGate: false,
        stepPatterns: ["triage", "classify", "create-issue", "ingest"]
    },
    {
        id: "analysis",
        label: "Analysis",
        isGate: false,
        stepPatterns: ["analy*", "research", "investigate", "assess"]
    },
    {
        id: "implementation",
        label: "Implementation",
        isGate: false,
        stepPatterns: ["implement*", "code*", "fix*", "build*", "create-pr", "audit*"]
    },
    {
        id: "review-gate",
        label: "Review Gate",
        isGate: true,
        stepPatterns: ["review*", "merge-review", "approval*", "human*"]
    },
    {
        id: "qa",
        label: "QA / Verify",
        isGate: false,
        stepPatterns: ["qa*", "test*", "verify*", "validate*", "check*"]
    },
    {
        id: "merge-gate",
        label: "Merge Gate",
        isGate: true,
        stepPatterns: ["merge*", "deploy*", "release*"]
    },
    {
        id: "done",
        label: "Done",
        isGate: false,
        stepPatterns: ["done", "complete", "finish", "close"]
    }
];

function matchesPattern(stepId: string, pattern: string): boolean {
    const normalizedStep = stepId.toLowerCase();
    const normalizedPattern = pattern.toLowerCase();
    if (normalizedPattern.endsWith("*")) {
        return normalizedStep.startsWith(normalizedPattern.slice(0, -1));
    }
    return normalizedStep === normalizedPattern || normalizedStep.includes(normalizedPattern);
}

function computeStageForReview(review: ReviewItem, steps: StepData[]): string {
    if (review.status !== "pending") {
        if (review.status === "approved" || review.status === "rejected") return "done";
        return "triage";
    }
    if (!steps || steps.length === 0) return "triage";

    const activeStep = steps.find(
        (s) =>
            s.stepId === review.suspendedStep ||
            s.status.toUpperCase() === "RUNNING" ||
            s.status.toUpperCase() === "SUSPENDED"
    );
    const lastCompleted = [...steps].reverse().find((s) => s.status.toUpperCase() === "COMPLETED");
    const targetStep = activeStep || lastCompleted || steps[steps.length - 1];

    if (!targetStep) return "triage";

    const stepId = targetStep.stepName || targetStep.stepId;
    for (const stage of DEFAULT_STAGES) {
        for (const pattern of stage.stepPatterns) {
            if (matchesPattern(stepId, pattern)) return stage.id;
        }
    }

    const completedCount = steps.filter((s) => s.status.toUpperCase() === "COMPLETED").length;
    const total = steps.length;
    if (total === 0) return "triage";
    const progress = completedCount / total;
    if (progress >= 1) return "done";
    if (progress >= 0.7) return "qa";
    if (progress >= 0.4) return "implementation";
    if (progress >= 0.1) return "analysis";
    return "triage";
}

/* ─── Risk dot colors ──────────────────────────────────────────────── */

const RISK_DOT: Record<string, string> = {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-amber-400",
    low: "bg-green-500",
    trivial: "bg-gray-400",
    unknown: "bg-gray-400"
};

/* ─── Chip color variants ──────────────────────────────────────────── */

const CHIP_VARIANTS: Record<string, { bg: string; text: string; border: string }> = {
    critical: {
        bg: "bg-red-500/10 dark:bg-red-500/15",
        text: "text-red-600 dark:text-red-400",
        border: "border-red-500/30"
    },
    high: {
        bg: "bg-orange-500/10 dark:bg-orange-500/15",
        text: "text-orange-600 dark:text-orange-400",
        border: "border-orange-500/30"
    },
    medium: {
        bg: "bg-amber-500/10 dark:bg-amber-500/15",
        text: "text-amber-600 dark:text-amber-400",
        border: "border-amber-500/30"
    },
    low: {
        bg: "bg-green-500/10 dark:bg-green-500/15",
        text: "text-green-600 dark:text-green-400",
        border: "border-green-500/30"
    },
    trivial: {
        bg: "bg-gray-500/10 dark:bg-gray-500/15",
        text: "text-gray-600 dark:text-gray-400",
        border: "border-gray-500/30"
    },
    unknown: {
        bg: "bg-gray-500/10 dark:bg-gray-500/15",
        text: "text-gray-500 dark:text-gray-400",
        border: "border-gray-500/30"
    }
};

/* ─── View mode type ────────────────────────────────────────────────── */

type BoardView = "full" | "gates" | "empty";

/* ─── Pipeline grouping hook ─────────────────────────────────────── */

interface ChipData {
    review: ReviewItem;
    stageId: string;
    isAtGate: boolean;
    riskLevel: string;
    label: string;
    age: string;
}

interface PipelineGroup {
    workflowSlug: string;
    workflowName: string;
    activeCount: number;
    chipsByStage: Map<string, ChipData[]>;
    gateItems: ChipData[];
}

function usePipelineGrouping(
    reviews: ReviewItem[],
    stepCache: Map<string, StepData[]>
): PipelineGroup[] {
    return useMemo(() => {
        const byWorkflow = new Map<string, ReviewItem[]>();
        for (const review of reviews) {
            const slug = review.workflowSlug || "other";
            const list = byWorkflow.get(slug) || [];
            list.push(review);
            byWorkflow.set(slug, list);
        }

        const groups: PipelineGroup[] = [];
        for (const [slug, items] of byWorkflow) {
            const chipsByStage = new Map<string, ChipData[]>();
            const gateItems: ChipData[] = [];

            for (const item of items) {
                const steps = stepCache.get(item.id) || [];
                const stageId = computeStageForReview(item, steps);
                const stage = DEFAULT_STAGES.find((s) => s.id === stageId);
                const risk = getRiskLevel(item);
                const issueNum = item.reviewContext?.issueNumber;
                const label = issueNum
                    ? `#${issueNum}`
                    : item.reviewContext?.summary?.slice(0, 20) || item.id.slice(0, 8);

                const chip: ChipData = {
                    review: item,
                    stageId,
                    isAtGate: stage?.isGate || false,
                    riskLevel: risk,
                    label,
                    age: formatTimeAgo(item.createdAt)
                };

                const list = chipsByStage.get(stageId) || [];
                list.push(chip);
                chipsByStage.set(stageId, list);

                if (chip.isAtGate) gateItems.push(chip);
            }

            groups.push({
                workflowSlug: slug,
                workflowName: items[0]?.workflowName || slug,
                activeCount: items.length,
                chipsByStage,
                gateItems
            });
        }

        return groups.sort((a, b) => b.activeCount - a.activeCount);
    }, [reviews, stepCache]);
}

/* ─── Main component ──────────────────────────────────────────────── */

export function PipelineSwimlanes({
    filteredReviews,
    loading,
    metrics,
    stepCache,
    onApprove,
    onReject,
    onFeedback,
    onCancelRun,
    onRetryStep,
    onSkipStep,
    onBatchApprove
}: CommandViewProps) {
    const groups = usePipelineGrouping(filteredReviews, stepCache);
    const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null);
    const [selectedChipId, setSelectedChipId] = useState<string | null>(null);
    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
    const [boardView, setBoardView] = useState<BoardView>("full");

    const totalGateItems = useMemo(
        () => groups.reduce((n, g) => n + g.gateItems.length, 0),
        [groups]
    );

    const toggleCheck = useCallback((id: string) => {
        setCheckedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (
                e.target instanceof HTMLElement &&
                (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
            )
                return;
            if (e.shiftKey && e.key === "A") {
                e.preventDefault();
                const gateIds = groups
                    .flatMap((g) => g.gateItems)
                    .filter((c) => c.review.status === "pending")
                    .map((c) => c.review.id);
                if (gateIds.length > 0) onBatchApprove(gateIds);
            }
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [groups, onBatchApprove]);

    const visibleStages =
        boardView === "gates" ? DEFAULT_STAGES.filter((s) => s.isGate) : DEFAULT_STAGES;

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
                <CardContent className="py-16 text-center">
                    <div className="mx-auto mb-3 text-5xl opacity-30">⚙</div>
                    <p className="text-base font-semibold">All pipelines are clear</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                        No active workflow runs. Items will appear here as workflows execute.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Pipeline metrics strip */}
            {metrics && (
                <div className="flex items-center gap-4 rounded-lg border bg-gray-50/50 px-4 py-2.5 dark:bg-gray-900/50">
                    <div className="flex items-center gap-1.5">
                        <span className="text-lg font-bold text-amber-500">
                            {metrics.pendingCount}
                        </span>
                        <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                            Awaiting
                        </span>
                    </div>
                    <div className="bg-border h-4 w-px" />
                    <div className="flex items-center gap-1.5">
                        <span className="text-lg font-bold text-blue-500">
                            {filteredReviews.filter((r) => r.runStatus === "RUNNING").length}
                        </span>
                        <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                            Running
                        </span>
                    </div>
                    <div className="bg-border h-4 w-px" />
                    <div className="flex items-center gap-1.5">
                        <span className="text-lg font-bold text-green-500">
                            {metrics.decisionsToday}
                        </span>
                        <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                            Today
                        </span>
                    </div>
                    <div className="bg-border h-4 w-px" />
                    <div className="flex items-center gap-1.5">
                        <span className="text-lg font-bold">
                            {metrics.avgWaitMinutes < 60
                                ? `${metrics.avgWaitMinutes}m`
                                : `${Math.floor(metrics.avgWaitMinutes / 60)}h`}
                        </span>
                        <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                            Avg Wait
                        </span>
                    </div>
                    <div className="bg-border h-4 w-px" />
                    <div className="flex items-center gap-1.5">
                        <span className="text-lg font-bold">{metrics.approvalRate7d}%</span>
                        <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                            Rate (7d)
                        </span>
                    </div>
                </div>
            )}

            {/* View toggle */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
                    {(["full", "gates"] as BoardView[]).map((v) => (
                        <button
                            key={v}
                            className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                                boardView === v
                                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                                    : "text-muted-foreground hover:text-gray-700 dark:hover:text-gray-300"
                            }`}
                            onClick={() => setBoardView(v)}
                        >
                            {v === "full" ? "Full Board" : "Gates Only"}
                        </button>
                    ))}
                </div>
                {totalGateItems > 0 && (
                    <span className="text-sm font-medium text-fuchsia-600 dark:text-fuchsia-400">
                        {totalGateItems} item{totalGateItems !== 1 ? "s" : ""} at gates
                    </span>
                )}
            </div>

            {/* Swimlane board */}
            <div className="overflow-x-auto rounded-lg border">
                {/* Column headers */}
                <div
                    className="grid border-b bg-gray-50/80 dark:bg-gray-900/80"
                    style={{
                        gridTemplateColumns: `160px repeat(${visibleStages.length}, minmax(140px, 1fr))`
                    }}
                >
                    <div className="border-r px-3 py-2">
                        <span className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">
                            Pipeline
                        </span>
                    </div>
                    {visibleStages.map((stage) => (
                        <div
                            key={stage.id}
                            className={`px-3 py-2 text-center ${
                                stage.isGate ? "bg-fuchsia-50/50 dark:bg-fuchsia-950/20" : ""
                            }`}
                        >
                            <span
                                className={`text-[10px] font-semibold tracking-widest uppercase ${
                                    stage.isGate
                                        ? "text-fuchsia-600 dark:text-fuchsia-400"
                                        : "text-muted-foreground"
                                }`}
                            >
                                {stage.label}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Pipeline rows */}
                {groups.map((group) => (
                    <div
                        key={group.workflowSlug}
                        className="grid border-b transition-colors last:border-b-0 hover:bg-gray-50/30 dark:hover:bg-gray-800/10"
                        style={{
                            gridTemplateColumns: `160px repeat(${visibleStages.length}, minmax(140px, 1fr))`
                        }}
                    >
                        {/* Pipeline label cell */}
                        <div className="flex items-start border-r px-3 py-2.5">
                            <div className="min-w-0">
                                <div className="truncate text-xs font-semibold">
                                    {group.workflowName}
                                </div>
                                <div className="text-muted-foreground mt-0.5 text-[10px]">
                                    {group.activeCount} active
                                </div>
                            </div>
                        </div>

                        {/* Stage cells */}
                        {visibleStages.map((stage) => {
                            const chips = group.chipsByStage.get(stage.id) || [];
                            const gateCount = stage.isGate ? chips.length : 0;

                            return (
                                <div
                                    key={stage.id}
                                    className={`relative min-h-[60px] px-2 py-2 ${
                                        stage.isGate
                                            ? "bg-fuchsia-50/30 dark:bg-fuchsia-950/10"
                                            : ""
                                    }`}
                                >
                                    {stage.isGate && gateCount > 0 && (
                                        <div className="absolute -top-1 right-1 z-10 flex h-5 min-w-[20px] animate-pulse items-center justify-center rounded-full bg-fuchsia-500 px-1 text-[9px] font-bold text-white">
                                            {gateCount}
                                        </div>
                                    )}
                                    <div className="flex flex-wrap gap-1">
                                        {chips.map((chip) => {
                                            const variant =
                                                CHIP_VARIANTS[chip.riskLevel] ||
                                                CHIP_VARIANTS.unknown!;
                                            const isSelected = selectedChipId === chip.review.id;

                                            return (
                                                <button
                                                    key={chip.review.id}
                                                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] transition-all hover:-translate-y-px hover:shadow-md ${variant.bg} ${variant.border} ${variant.text} ${
                                                        isSelected
                                                            ? "ring-2 ring-blue-500 ring-offset-1"
                                                            : ""
                                                    }`}
                                                    onClick={() => {
                                                        setSelectedChipId(chip.review.id);
                                                        setSelectedReview(chip.review);
                                                    }}
                                                >
                                                    <div
                                                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${RISK_DOT[chip.riskLevel] || RISK_DOT.unknown!}`}
                                                    />
                                                    <span className="font-medium">
                                                        {chip.label}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>

            <ChipSlideout
                review={selectedReview}
                open={!!selectedReview}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedReview(null);
                        setSelectedChipId(null);
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
                gateItemCount={totalGateItems}
                onBatchApprove={() => {
                    const ids =
                        checkedIds.size > 0
                            ? [...checkedIds]
                            : groups
                                  .flatMap((g) => g.gateItems)
                                  .filter((c) => c.review.status === "pending")
                                  .map((c) => c.review.id);
                    onBatchApprove(ids);
                    setCheckedIds(new Set());
                }}
                onBatchReject={() => {}}
                onClearSelection={() => setCheckedIds(new Set())}
            />
        </div>
    );
}
