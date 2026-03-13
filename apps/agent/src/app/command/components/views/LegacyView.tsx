"use client";

import { useEffect, useRef, useState } from "react";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
    Skeleton,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@repo/ui";
import { formatTimeAgo, getUrgencyClass } from "../../types";
import { DecisionCard } from "../DecisionCard";
import { FilterBar } from "../FilterBar";
import { MetricsSparklines } from "../MetricsSparklines";
import type { useReviews } from "../../hooks/useReviews";
import type { ReviewItem } from "../../types";

type UseReviewsReturn = ReturnType<typeof useReviews>;

/* ─── Shared card list renderer ──────────────────────────────────────── */

function ReviewCardList({
    filteredReviews,
    loading,
    tab,
    emptyLabel,
    focusedIndex,
    selectedIds,
    expandedIds,
    confirmingRejectId,
    feedbackForId,
    feedbackText,
    actingId,
    highlightedIds,
    cardRefs,
    feedbackInputRef,
    filterWorkflow,
    filterRisk,
    onToggleSelect,
    onToggleExpand,
    onApprove,
    onReject,
    onConfirmReject,
    onCancelReject,
    onOpenFeedback,
    onCancelFeedback,
    onFeedback,
    onFeedbackTextChange,
    onOpenConditional,
    onCancelRun,
    onRetryStep,
    onSkipStep
}: {
    filteredReviews: UseReviewsReturn["filteredReviews"];
    loading: boolean;
    tab: string;
    emptyLabel: string;
    focusedIndex: number;
    selectedIds: Set<string>;
    expandedIds: Set<string>;
    confirmingRejectId: string | null;
    feedbackForId: string | null;
    feedbackText: string;
    actingId: string | null;
    highlightedIds: Set<string>;
    cardRefs: React.RefObject<Map<number, HTMLDivElement>>;
    feedbackInputRef: React.RefObject<HTMLTextAreaElement | null>;
    filterWorkflow: string;
    filterRisk: string;
    onToggleSelect: (id: string) => void;
    onToggleExpand: (id: string) => void;
    onApprove: (review: (typeof filteredReviews)[0]) => void;
    onReject: (review: (typeof filteredReviews)[0]) => void;
    onConfirmReject: (id: string) => void;
    onCancelReject: () => void;
    onOpenFeedback: (id: string) => void;
    onCancelFeedback: () => void;
    onFeedback: (review: (typeof filteredReviews)[0]) => void;
    onFeedbackTextChange: (text: string) => void;
    onOpenConditional: (review: (typeof filteredReviews)[0]) => void;
    onCancelRun?: (review: (typeof filteredReviews)[0]) => void;
    onRetryStep?: (reviewId: string, stepId: string) => void;
    onSkipStep?: (reviewId: string, stepId: string, reason?: string) => void;
}) {
    if (loading) {
        return (
            <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-32 w-full rounded-xl" />
                ))}
            </div>
        );
    }

    if (filteredReviews.length === 0) {
        return (
            <Card>
                <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">
                        {emptyLabel}
                        {filterWorkflow !== "all" || filterRisk !== "all"
                            ? " matching filters"
                            : ""}
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-3">
            {filteredReviews.map((review, index) => (
                <DecisionCard
                    key={review.id}
                    review={review}
                    index={index}
                    isFocused={focusedIndex === index}
                    isSelected={selectedIds.has(review.id)}
                    isExpanded={expandedIds.has(review.id)}
                    isConfirmingReject={confirmingRejectId === review.id}
                    isFeedbackMode={feedbackForId === review.id}
                    isActing={actingId === review.id}
                    isNew={highlightedIds.has(review.id)}
                    feedbackText={feedbackText}
                    onToggleSelect={onToggleSelect}
                    onToggleExpand={onToggleExpand}
                    onApprove={onApprove}
                    onReject={onReject}
                    onConfirmReject={onConfirmReject}
                    onCancelReject={onCancelReject}
                    onOpenFeedback={onOpenFeedback}
                    onCancelFeedback={onCancelFeedback}
                    onFeedback={onFeedback}
                    onFeedbackTextChange={onFeedbackTextChange}
                    onOpenConditional={onOpenConditional}
                    onCancelRun={onCancelRun}
                    onRetryStep={onRetryStep}
                    onSkipStep={onSkipStep}
                    feedbackInputRef={feedbackInputRef}
                    cardRef={(el) => {
                        if (el) cardRefs.current.set(index, el);
                    }}
                />
            ))}
        </div>
    );
}

/* ─── Legacy View ────────────────────────────────────────────────────── */

interface LegacyViewProps {
    hook: UseReviewsReturn;
}

export function LegacyView({ hook }: LegacyViewProps) {
    const {
        tab,
        changeTab,
        filteredReviews,
        loading,
        metrics,
        learningProposals,
        learningLoading,
        learningActingId,
        selectedIds,
        setSelectedIds,
        expandedIds,
        focusedIndex,
        setFocusedIndex,
        confirmingRejectId,
        setConfirmingRejectId,
        feedbackForId,
        setFeedbackForId,
        feedbackText,
        setFeedbackText,
        actingId,
        batchActing,
        highlightedIds,
        filterWorkflow,
        setFilterWorkflow,
        filterRisk,
        setFilterRisk,
        sortBy,
        setSortBy,
        feedbackInputRef,
        workflowSlugs,
        riskLevels,
        pendingInFiltered,
        allPendingSelected,
        reviews,
        handleApprove,
        handleReject,
        handleFeedback,
        handleConditional,
        handleBatchApprove,
        handleCancelRun,
        handleRetryStep,
        handleSkipStep,
        handleLearningApprove,
        handleLearningReject,
        toggleSelect,
        toggleSelectAll,
        toggleExpand
    } = hook;

    const [conditionalReview, setConditionalReview] = useState<ReviewItem | null>(null);
    const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            const target = e.target as HTMLElement;
            if (
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.isContentEditable
            )
                return;

            switch (e.key) {
                case "j": {
                    e.preventDefault();
                    setFocusedIndex((prev: number) => {
                        const next = Math.min(prev + 1, filteredReviews.length - 1);
                        cardRefs.current.get(next)?.scrollIntoView({
                            behavior: "smooth",
                            block: "nearest"
                        });
                        return next;
                    });
                    break;
                }
                case "k": {
                    e.preventDefault();
                    setFocusedIndex((prev: number) => {
                        const next = Math.max(prev - 1, 0);
                        cardRefs.current.get(next)?.scrollIntoView({
                            behavior: "smooth",
                            block: "nearest"
                        });
                        return next;
                    });
                    break;
                }
                case "Enter": {
                    e.preventDefault();
                    const review = filteredReviews[focusedIndex];
                    if (review) toggleExpand(review.id);
                    break;
                }
                case "a":
                case "A": {
                    if (e.shiftKey) {
                        e.preventDefault();
                        if (selectedIds.size > 0) handleBatchApprove();
                    } else {
                        e.preventDefault();
                        const review = filteredReviews[focusedIndex];
                        if (review?.status === "pending") handleApprove(review);
                    }
                    break;
                }
                case "r": {
                    e.preventDefault();
                    const review = filteredReviews[focusedIndex];
                    if (review?.status === "pending") {
                        if (confirmingRejectId === review.id) {
                            handleReject(review);
                        } else {
                            setConfirmingRejectId(review.id);
                        }
                    }
                    break;
                }
                case "f": {
                    e.preventDefault();
                    const review = filteredReviews[focusedIndex];
                    if (review?.status === "pending") {
                        setFeedbackForId(review.id);
                        setFeedbackText("");
                        setTimeout(() => feedbackInputRef.current?.focus(), 100);
                    }
                    break;
                }
                case "x": {
                    e.preventDefault();
                    const review = filteredReviews[focusedIndex];
                    if (review?.status === "pending") toggleSelect(review.id);
                    break;
                }
                case "Escape": {
                    e.preventDefault();
                    if (confirmingRejectId) {
                        setConfirmingRejectId(null);
                    } else if (feedbackForId) {
                        setFeedbackForId(null);
                    } else if (selectedIds.size > 0) {
                        setSelectedIds(new Set());
                    }
                    break;
                }
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [focusedIndex, selectedIds, confirmingRejectId, feedbackForId, filteredReviews]);

    const cardListProps = {
        filteredReviews,
        loading,
        tab,
        focusedIndex,
        selectedIds,
        expandedIds,
        confirmingRejectId,
        feedbackForId,
        feedbackText,
        actingId,
        highlightedIds,
        cardRefs,
        feedbackInputRef,
        filterWorkflow,
        filterRisk,
        onToggleSelect: toggleSelect,
        onToggleExpand: toggleExpand,
        onApprove: handleApprove,
        onReject: handleReject,
        onConfirmReject: (id: string) => setConfirmingRejectId(id),
        onCancelReject: () => setConfirmingRejectId(null),
        onOpenFeedback: (id: string) => {
            setFeedbackForId(id);
            setFeedbackText("");
            setTimeout(() => feedbackInputRef.current?.focus(), 100);
        },
        onCancelFeedback: () => setFeedbackForId(null),
        onFeedback: handleFeedback,
        onFeedbackTextChange: setFeedbackText,
        onOpenConditional: (review: ReviewItem) => setConditionalReview(review),
        onCancelRun: handleCancelRun,
        onRetryStep: handleRetryStep,
        onSkipStep: handleSkipStep
    };

    const filterBarProps = {
        workflowSlugs,
        riskLevels,
        filterWorkflow,
        filterRisk,
        sortBy,
        onFilterWorkflowChange: setFilterWorkflow,
        onFilterRiskChange: setFilterRisk,
        onSortByChange: setSortBy,
        tab,
        pendingCount: pendingInFiltered.length,
        allPendingSelected,
        selectedCount: selectedIds.size,
        onToggleSelectAll: toggleSelectAll,
        onBatchApprove: handleBatchApprove,
        batchActing,
        filteredCount: filteredReviews.length
    };

    // Import ConditionalApprovalDialog dynamically to avoid circular deps
    const ConditionalApprovalDialog =
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("../ConditionalApprovalDialog").ConditionalApprovalDialog;

    return (
        <div className="space-y-4">
            <Tabs defaultValue="pending" value={tab} onValueChange={changeTab}>
                <TabsList>
                    <TabsTrigger value="pending">
                        Pending
                        {metrics && metrics.pendingCount > 0 && (
                            <Badge variant="destructive" className="ml-1.5 px-1.5 py-0 text-xs">
                                {metrics.pendingCount}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="approved">Approved</TabsTrigger>
                    <TabsTrigger value="rejected">Rejected</TabsTrigger>
                    <TabsTrigger value="feedback">Feedback</TabsTrigger>
                    <TabsTrigger value="learning">
                        Learning
                        {learningProposals.length > 0 && (
                            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                                {learningProposals.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="audit">Audit</TabsTrigger>
                    <TabsTrigger value="all">All</TabsTrigger>
                </TabsList>

                {/* Learning tab */}
                <TabsContent value="learning" className="space-y-4">
                    {learningLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-40 w-full rounded-xl" />
                            ))}
                        </div>
                    ) : learningProposals.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <p className="text-muted-foreground">
                                    No learning proposals awaiting approval
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {learningProposals.map((lp) => {
                                const isActing = learningActingId === lp.id;
                                const riskColor =
                                    lp.riskTier === "HIGH"
                                        ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                                        : lp.riskTier === "MEDIUM"
                                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                                          : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
                                return (
                                    <Card key={lp.id}>
                                        <CardHeader className="pb-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-mono text-sm font-semibold">
                                                            {lp.agentName}
                                                        </span>
                                                        <Badge
                                                            variant="outline"
                                                            className="text-xs"
                                                        >
                                                            v{lp.agentVersion}
                                                        </Badge>
                                                        <Badge
                                                            className={riskColor}
                                                            variant="secondary"
                                                        >
                                                            {lp.riskTier}
                                                        </Badge>
                                                        <span
                                                            className={`text-muted-foreground text-sm ${getUrgencyClass(lp.createdAt)}`}
                                                        >
                                                            {formatTimeAgo(lp.createdAt)}
                                                        </span>
                                                    </div>
                                                    <p className="mt-1.5 text-base font-medium">
                                                        {lp.proposal?.title || "Learning proposal"}
                                                    </p>
                                                    {lp.triggerReason && (
                                                        <p className="text-muted-foreground mt-0.5 text-sm">
                                                            Trigger: {lp.triggerReason}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-3 pt-0">
                                            <Collapsible>
                                                <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 text-xs">
                                                    <span className="inline-block transition-transform duration-150">
                                                        ▶
                                                    </span>
                                                    Show details
                                                </CollapsibleTrigger>
                                                <CollapsibleContent>
                                                    <div className="bg-muted/50 mt-2 space-y-3 rounded-lg p-3">
                                                        {lp.proposal?.description && (
                                                            <div>
                                                                <div className="text-muted-foreground mb-1 text-xs font-medium">
                                                                    Description
                                                                </div>
                                                                <p className="text-sm whitespace-pre-wrap">
                                                                    {lp.proposal.description}
                                                                </p>
                                                            </div>
                                                        )}
                                                        {lp.proposal?.changeDescription && (
                                                            <div>
                                                                <div className="text-muted-foreground mb-1 text-xs font-medium">
                                                                    Changes
                                                                </div>
                                                                <pre className="bg-muted max-h-64 overflow-auto rounded p-2 text-xs">
                                                                    {lp.proposal.changeDescription}
                                                                </pre>
                                                            </div>
                                                        )}
                                                        {lp.experiment && (
                                                            <div>
                                                                <div className="text-muted-foreground mb-1 text-xs font-medium">
                                                                    Experiment Results
                                                                </div>
                                                                <div className="flex flex-wrap gap-3 text-sm">
                                                                    <span>
                                                                        Win rate:{" "}
                                                                        <span className="font-mono font-semibold">
                                                                            {lp.experiment
                                                                                .winRate != null
                                                                                ? `${(lp.experiment.winRate * 100).toFixed(1)}%`
                                                                                : "—"}
                                                                        </span>
                                                                    </span>
                                                                    <span>
                                                                        Gating:{" "}
                                                                        <Badge
                                                                            variant="outline"
                                                                            className="text-xs"
                                                                        >
                                                                            {lp.experiment
                                                                                .gatingDecision ||
                                                                                "pending"}
                                                                        </Badge>
                                                                    </span>
                                                                    <span>
                                                                        Baseline:{" "}
                                                                        {lp.experiment.baselineRuns}{" "}
                                                                        runs
                                                                    </span>
                                                                    <span>
                                                                        Candidate:{" "}
                                                                        {
                                                                            lp.experiment
                                                                                .candidateRuns
                                                                        }{" "}
                                                                        runs
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}
                                                        <div className="text-muted-foreground text-xs">
                                                            Session:{" "}
                                                            <code>{lp.id.slice(0, 12)}…</code>
                                                            {" | "}Agent:{" "}
                                                            <code>{lp.agentSlug}</code>
                                                        </div>
                                                    </div>
                                                </CollapsibleContent>
                                            </Collapsible>

                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleLearningApprove(lp.id)}
                                                    disabled={isActing}
                                                >
                                                    {isActing ? "Approving…" : "Approve"}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => handleLearningReject(lp.id)}
                                                    disabled={isActing}
                                                >
                                                    {isActing ? "Rejecting…" : "Reject"}
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>

                {/* Audit tab */}
                <TabsContent value="audit" className="space-y-4">
                    <MetricsSparklines />
                    {!loading && filteredReviews.length > 0 && <FilterBar {...filterBarProps} />}
                    <ReviewCardList {...cardListProps} emptyLabel="No resolved decisions found" />
                </TabsContent>

                {/* Standard review tabs */}
                {tab !== "learning" && tab !== "audit" && (
                    <TabsContent value={tab} className="space-y-4">
                        {!loading && reviews.length > 0 && <FilterBar {...filterBarProps} />}
                        <ReviewCardList
                            {...cardListProps}
                            emptyLabel={`No ${tab === "all" ? "" : tab} decisions found`}
                        />
                    </TabsContent>
                )}
            </Tabs>

            <ConditionalApprovalDialog
                review={conditionalReview}
                open={!!conditionalReview}
                onOpenChange={(open: boolean) => {
                    if (!open) setConditionalReview(null);
                }}
                onSubmit={(
                    review: ReviewItem,
                    conditionMeta: {
                        conditionType: "ci-checks";
                        repository?: string;
                        ref?: string;
                    }
                ) => {
                    handleConditional(review, conditionMeta);
                    setConditionalReview(null);
                }}
                isActing={actingId === conditionalReview?.id}
            />
        </div>
    );
}
