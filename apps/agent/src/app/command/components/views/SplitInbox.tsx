"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, CardContent, Skeleton } from "@repo/ui";
import { StepMiniTimeline } from "../shared/StepMiniTimeline";
import type { CommandViewProps } from "../../types";
import {
    formatTimeAgo,
    getRiskLevel,
    RISK_COLORS,
    getDecisionPrompt,
    getUrgencyClass
} from "../../types";

export function SplitInbox({
    filteredReviews,
    loading,
    stepCache,
    onApprove,
    onReject,
    onCancelRun,
    onRetryStep,
    onSkipStep,
    onBatchApprove,
    filterWorkflow,
    onFilterWorkflowChange,
    workflowSlugs
}: CommandViewProps) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState("");

    const filtered = useMemo(() => {
        if (!searchQuery.trim()) return filteredReviews;
        const q = searchQuery.toLowerCase();
        return filteredReviews.filter(
            (r) =>
                (r.workflowName || "").toLowerCase().includes(q) ||
                (r.workflowSlug || "").toLowerCase().includes(q) ||
                (r.reviewContext?.summary || "").toLowerCase().includes(q) ||
                r.id.toLowerCase().includes(q)
        );
    }, [filteredReviews, searchQuery]);

    const clampedIndex = useMemo(
        () => Math.min(selectedIndex, Math.max(0, filtered.length - 1)),
        [selectedIndex, filtered.length]
    );
    const selectedReview = filtered[clampedIndex] || null;
    const selectedSteps = selectedReview ? stepCache.get(selectedReview.id) || [] : [];

    const toggleCheck = (id: string) => {
        setCheckedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const advanceAfterAction = useCallback(() => {
        setSelectedIndex((prev) => Math.min(prev, Math.max(0, filtered.length - 2)));
    }, [filtered.length]);

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
                case "j":
                    e.preventDefault();
                    setSelectedIndex((p) => Math.min(p + 1, filtered.length - 1));
                    break;
                case "k":
                    e.preventDefault();
                    setSelectedIndex((p) => Math.max(p - 1, 0));
                    break;
                case "a":
                    if (!e.shiftKey && selectedReview?.status === "pending") {
                        e.preventDefault();
                        onApprove(selectedReview);
                        advanceAfterAction();
                    }
                    break;
                case "r":
                    if (selectedReview?.status === "pending") {
                        e.preventDefault();
                        onReject(selectedReview);
                        advanceAfterAction();
                    }
                    break;
                case "x":
                    if (selectedReview) {
                        e.preventDefault();
                        toggleCheck(selectedReview.id);
                    }
                    break;
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [filtered, selectedIndex, selectedReview, onApprove, onReject, advanceAfterAction]);

    if (loading) {
        return (
            <div className="flex gap-4">
                <Skeleton className="h-96 w-96 rounded-xl" />
                <Skeleton className="h-96 flex-1 rounded-xl" />
            </div>
        );
    }

    if (filteredReviews.length === 0) {
        return (
            <Card>
                <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No items in inbox</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="flex gap-4" style={{ minHeight: "calc(100vh - 280px)" }}>
            {/* Left panel - item list */}
            <div className="flex w-[420px] shrink-0 flex-col overflow-hidden rounded-lg border">
                {/* Search */}
                <div className="border-b p-2">
                    <input
                        type="text"
                        placeholder="Search items..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-background w-full rounded-md border px-2.5 py-1.5 text-xs"
                    />
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 border-b px-2 py-1.5">
                    <select
                        value={filterWorkflow}
                        onChange={(e) => onFilterWorkflowChange(e.target.value)}
                        className="bg-background rounded border px-1.5 py-0.5 text-[10px]"
                    >
                        <option value="all">All workflows</option>
                        {workflowSlugs.map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </select>
                    {checkedIds.size > 0 && (
                        <Button
                            size="sm"
                            className="ml-auto h-5 px-1.5 text-[10px]"
                            onClick={() => {
                                onBatchApprove([...checkedIds]);
                                setCheckedIds(new Set());
                            }}
                        >
                            Approve {checkedIds.size}
                        </Button>
                    )}
                </div>

                {/* Items */}
                <div className="flex-1 overflow-y-auto">
                    {filtered.map((review, idx) => {
                        const risk = getRiskLevel(review);
                        const riskClass = RISK_COLORS[risk] || "";
                        const isActive = idx === selectedIndex;
                        const steps = stepCache.get(review.id) || [];
                        const completedSteps = steps.filter(
                            (s) => s.status.toUpperCase() === "COMPLETED"
                        ).length;

                        return (
                            <div
                                key={review.id}
                                className={`cursor-pointer border-b px-3 py-2 transition-colors ${isActive ? "bg-blue-50 dark:bg-blue-950/30" : "hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}
                                onClick={() => setSelectedIndex(idx)}
                            >
                                <div className="flex items-start gap-2">
                                    <input
                                        type="checkbox"
                                        className="mt-1 shrink-0"
                                        checked={checkedIds.has(review.id)}
                                        onChange={() => toggleCheck(review.id)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <span className="truncate text-xs font-medium">
                                                {review.workflowName ||
                                                    review.workflowSlug ||
                                                    "Workflow"}
                                            </span>
                                            <Badge
                                                className={`${riskClass} shrink-0 px-1 py-0 text-[9px]`}
                                                variant="secondary"
                                            >
                                                {risk}
                                            </Badge>
                                        </div>
                                        <p className="text-muted-foreground mt-0.5 truncate text-[10px]">
                                            {review.reviewContext?.summary ||
                                                getDecisionPrompt(review)}
                                        </p>
                                        <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-[10px]">
                                            <span className={getUrgencyClass(review.createdAt)}>
                                                {formatTimeAgo(review.createdAt)}
                                            </span>
                                            {steps.length > 0 && (
                                                <span>
                                                    {completedSteps}/{steps.length} steps
                                                </span>
                                            )}
                                            <Badge
                                                variant="outline"
                                                className="px-1 py-0 text-[9px]"
                                            >
                                                {review.status}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Keyboard hints */}
                <div className="text-muted-foreground flex items-center justify-center gap-3 border-t px-2 py-1.5 text-[10px]">
                    <span>
                        <kbd className="rounded border px-0.5">j</kbd>/
                        <kbd className="rounded border px-0.5">k</kbd> navigate
                    </span>
                    <span>
                        <kbd className="rounded border px-0.5">a</kbd> approve
                    </span>
                    <span>
                        <kbd className="rounded border px-0.5">r</kbd> reject
                    </span>
                    <span>
                        <kbd className="rounded border px-0.5">x</kbd> select
                    </span>
                </div>
            </div>

            {/* Right panel - detail */}
            <div className="flex-1 overflow-y-auto rounded-lg border">
                {selectedReview ? (
                    <div className="space-y-4 p-4">
                        {/* Header */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold">
                                    {selectedReview.workflowName ||
                                        selectedReview.workflowSlug ||
                                        "Workflow"}
                                </h2>
                                <div className="flex gap-1.5">
                                    <Badge
                                        className={`${RISK_COLORS[getRiskLevel(selectedReview)] || ""}`}
                                        variant="secondary"
                                    >
                                        {getRiskLevel(selectedReview)}
                                    </Badge>
                                    <Badge variant="outline">{selectedReview.status}</Badge>
                                </div>
                            </div>
                            <p className="text-muted-foreground text-sm">
                                {getDecisionPrompt(selectedReview)}
                            </p>
                        </div>

                        {/* Summary */}
                        {selectedReview.reviewContext?.summary && (
                            <div className="space-y-1">
                                <div className="text-muted-foreground text-xs font-medium">
                                    Summary
                                </div>
                                <p className="text-sm leading-relaxed">
                                    {selectedReview.reviewContext.summary}
                                </p>
                            </div>
                        )}

                        {/* Step timeline */}
                        {selectedSteps.length > 0 && (
                            <div className="space-y-1">
                                <div className="text-muted-foreground text-xs font-medium">
                                    Workflow Steps ({selectedSteps.length})
                                </div>
                                <StepMiniTimeline
                                    steps={selectedSteps}
                                    suspendedStep={selectedReview.suspendedStep}
                                    onRetryStep={
                                        onRetryStep
                                            ? (stepId) => onRetryStep(selectedReview.id, stepId)
                                            : undefined
                                    }
                                    onSkipStep={
                                        onSkipStep
                                            ? (stepId, reason) =>
                                                  onSkipStep(selectedReview.id, stepId, reason)
                                            : undefined
                                    }
                                />
                            </div>
                        )}

                        {/* Files changed */}
                        {selectedReview.reviewContext?.filesChanged &&
                            selectedReview.reviewContext.filesChanged.length > 0 && (
                                <div className="space-y-1">
                                    <div className="text-muted-foreground text-xs font-medium">
                                        Files Changed (
                                        {selectedReview.reviewContext.filesChanged.length})
                                    </div>
                                    <div className="max-h-40 overflow-y-auto rounded border bg-gray-50 p-2 dark:bg-gray-900">
                                        {selectedReview.reviewContext.filesChanged.map((f) => (
                                            <div
                                                key={f}
                                                className="truncate font-mono text-[10px] text-gray-600 dark:text-gray-400"
                                            >
                                                {f}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        {/* Action buttons */}
                        {selectedReview.status === "pending" && (
                            <div className="flex gap-2 border-t pt-3">
                                <Button
                                    onClick={() => {
                                        onApprove(selectedReview);
                                        advanceAfterAction();
                                    }}
                                >
                                    Approve
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={() => {
                                        onReject(selectedReview);
                                        advanceAfterAction();
                                    }}
                                >
                                    Reject
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => onCancelRun(selectedReview)}
                                >
                                    Cancel Run
                                </Button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex h-full items-center justify-center">
                        <p className="text-muted-foreground text-sm">
                            Select an item to view details
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
