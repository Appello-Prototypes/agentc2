"use client";

import { useState } from "react";
import { useReviews } from "./hooks/useReviews";
import { useStepPrefetch } from "./hooks/useStepPrefetch";
import { useViewPreference } from "./hooks/useViewPreference";
import { CommandCenterHeader } from "./components/CommandCenterHeader";
import { ViewSwitcher } from "./components/ViewSwitcher";
import { LegacyView } from "./components/views/LegacyView";
import { ShortcutHelpDialog } from "./components/ShortcutHelpDialog";
import { ConditionalApprovalDialog } from "./components/ConditionalApprovalDialog";
import type { ReviewItem, CommandViewProps } from "./types";

export default function CommandPage() {
    const hook = useReviews();
    const { viewMode, setViewMode } = useViewPreference();
    const { stepCache, loading: stepCacheLoading } = useStepPrefetch(hook.reviews);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [conditionalReview, setConditionalReview] = useState<ReviewItem | null>(null);

    const viewProps: CommandViewProps = {
        reviews: hook.reviews,
        filteredReviews: hook.filteredReviews,
        loading: hook.loading,
        metrics: hook.metrics,
        stepCache,
        stepCacheLoading,
        filterWorkflow: hook.filterWorkflow,
        filterRisk: hook.filterRisk,
        sortBy: hook.sortBy,
        workflowSlugs: hook.workflowSlugs,
        riskLevels: hook.riskLevels,
        onFilterWorkflowChange: hook.setFilterWorkflow,
        onFilterRiskChange: hook.setFilterRisk,
        onSortByChange: hook.setSortBy,
        onApprove: hook.handleApprove,
        onReject: hook.handleReject,
        onFeedback: hook.handleFeedback,
        onCancelRun: hook.handleCancelRun,
        onRetryStep: hook.handleRetryStep,
        onSkipStep: hook.handleSkipStep,
        onBatchApprove: async (reviewIds: string[]) => {
            hook.setSelectedIds(new Set(reviewIds));
            await hook.handleBatchApprove();
        },
        toasts: hook.toasts
    };

    return (
        <div className="container mx-auto max-w-6xl space-y-6 p-6">
            <CommandCenterHeader
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                metrics={hook.metrics}
                onShowShortcuts={() => setShowShortcuts(true)}
                connectionError={hook.connectionError}
                newReviewCount={hook.newReviewCount}
                onDismissNewReviews={hook.dismissNewReviews}
            />

            {viewMode === "legacy" ? (
                <LegacyView hook={hook} />
            ) : (
                <ViewSwitcher viewMode={viewMode} viewProps={viewProps} />
            )}

            {/* Toast notifications */}
            {hook.toasts.length > 0 && (
                <div className="fixed right-4 bottom-4 z-50 space-y-2">
                    {hook.toasts.map((t) => (
                        <div
                            key={t.id}
                            className={[
                                "rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg",
                                t.type === "success"
                                    ? "bg-green-600"
                                    : t.type === "error"
                                      ? "bg-red-600"
                                      : "bg-blue-600"
                            ].join(" ")}
                        >
                            {t.message}
                        </div>
                    ))}
                </div>
            )}

            <ShortcutHelpDialog open={showShortcuts} onOpenChange={setShowShortcuts} />
            <ConditionalApprovalDialog
                review={conditionalReview}
                open={!!conditionalReview}
                onOpenChange={(open) => {
                    if (!open) setConditionalReview(null);
                }}
                onSubmit={(review, conditionMeta) => {
                    hook.handleConditional(review, conditionMeta);
                    setConditionalReview(null);
                }}
                isActing={hook.actingId === conditionalReview?.id}
            />
        </div>
    );
}
