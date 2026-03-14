"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, CardContent, Skeleton } from "@repo/ui";
import { StepMiniTimeline } from "../shared/StepMiniTimeline";
import { BatchActionBar } from "../shared/BatchActionBar";
import type { CommandViewProps } from "../../types";
import {
    formatTimeAgo,
    getRiskLevel,
    RISK_COLORS,
    getDecisionPrompt,
    getUrgencyClass
} from "../../types";

/* ─── Risk dot colors ────────────────────────────────────────────── */

const RISK_DOT: Record<string, string> = {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-amber-400",
    low: "bg-green-500",
    trivial: "bg-gray-400",
    unknown: "bg-gray-400"
};

/* ─── Step status badge colors ───────────────────────────────────── */

const STEP_BADGE: Record<string, string> = {
    SUSPENDED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    FAILED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    RUNNING: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    QUEUED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
};

/* ─── Filter pill type ───────────────────────────────────────────── */

type InboxFilter = "all" | "pending" | "running" | "done";

/* ─── Main component ──────────────────────────────────────────────── */

export function SplitInbox({
    filteredReviews,
    loading,
    stepCache,
    onApprove,
    onReject,
    onFeedback,
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
    const [activeFilter, setActiveFilter] = useState<InboxFilter>("all");
    const listRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    const filterCounts = useMemo(() => {
        const pending = filteredReviews.filter((r) => r.status === "pending").length;
        const running = filteredReviews.filter((r) => r.runStatus === "RUNNING").length;
        const done = filteredReviews.filter(
            (r) => r.status !== "pending" && r.runStatus !== "RUNNING"
        ).length;
        return { all: filteredReviews.length, pending, running, done };
    }, [filteredReviews]);

    const filtered = useMemo(() => {
        let items = filteredReviews;

        if (activeFilter === "pending") {
            items = items.filter((r) => r.status === "pending");
        } else if (activeFilter === "running") {
            items = items.filter((r) => r.runStatus === "RUNNING");
        } else if (activeFilter === "done") {
            items = items.filter((r) => r.status !== "pending" && r.runStatus !== "RUNNING");
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            items = items.filter(
                (r) =>
                    (r.workflowName || "").toLowerCase().includes(q) ||
                    (r.workflowSlug || "").toLowerCase().includes(q) ||
                    (r.reviewContext?.summary || "").toLowerCase().includes(q) ||
                    r.id.toLowerCase().includes(q) ||
                    String(r.reviewContext?.issueNumber || "").includes(q)
            );
        }

        return items;
    }, [filteredReviews, searchQuery, activeFilter]);

    const clampedIndex = useMemo(
        () => Math.min(selectedIndex, Math.max(0, filtered.length - 1)),
        [selectedIndex, filtered.length]
    );
    const selectedReview = filtered[clampedIndex] || null;
    const selectedSteps = selectedReview ? stepCache.get(selectedReview.id) || [] : [];

    const toggleCheck = useCallback((id: string) => {
        setCheckedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const advanceAfterAction = useCallback(() => {
        setSelectedIndex((prev) => Math.min(prev, Math.max(0, filtered.length - 2)));
    }, [filtered.length]);

    const scrollToIndex = useCallback((idx: number) => {
        if (!listRef.current) return;
        const items = listRef.current.querySelectorAll("[data-inbox-item]");
        items[idx]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, []);

    /* ─── Keyboard shortcuts ──────────────────────────────────────── */

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
                    setSelectedIndex((p) => {
                        const next = Math.min(p + 1, filtered.length - 1);
                        scrollToIndex(next);
                        return next;
                    });
                    break;
                case "k":
                    e.preventDefault();
                    setSelectedIndex((p) => {
                        const next = Math.max(p - 1, 0);
                        scrollToIndex(next);
                        return next;
                    });
                    break;
                case "a":
                    if (e.shiftKey) {
                        e.preventDefault();
                        if (checkedIds.size > 0) {
                            onBatchApprove([...checkedIds]);
                            setCheckedIds(new Set());
                        }
                    } else if (selectedReview?.status === "pending") {
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
                case "f":
                    if (selectedReview?.status === "pending") {
                        e.preventDefault();
                        onFeedback(selectedReview);
                    }
                    break;
                case "x":
                    if (selectedReview) {
                        e.preventDefault();
                        onCancelRun(selectedReview);
                    }
                    break;
                case "Escape":
                    e.preventDefault();
                    setCheckedIds(new Set());
                    break;
            }

            if (e.metaKey && e.key === "k") {
                e.preventDefault();
                searchRef.current?.focus();
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [
        filtered,
        selectedIndex,
        selectedReview,
        checkedIds,
        onApprove,
        onReject,
        onFeedback,
        onCancelRun,
        onBatchApprove,
        advanceAfterAction,
        scrollToIndex
    ]);

    if (loading) {
        return (
            <div className="flex gap-4">
                <Skeleton className="h-96 w-[420px] rounded-xl" />
                <Skeleton className="h-96 flex-1 rounded-xl" />
            </div>
        );
    }

    if (filteredReviews.length === 0) {
        return (
            <Card>
                <CardContent className="py-16 text-center">
                    <div className="mx-auto mb-3 text-5xl opacity-30">✉</div>
                    <p className="text-base font-semibold">Inbox zero</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                        No pending workflow decisions. New items will appear as agents request
                        approval.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="flex gap-4" style={{ minHeight: "calc(100vh - 280px)" }}>
            {/* Left panel */}
            <div className="flex w-[420px] shrink-0 flex-col overflow-hidden rounded-lg border">
                {/* Search */}
                <div className="border-b p-2">
                    <input
                        ref={searchRef}
                        type="text"
                        placeholder="Search... (⌘K)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-background w-full rounded-md border px-2.5 py-1.5 text-xs"
                    />
                </div>

                {/* Filter pills */}
                <div className="flex items-center gap-1 border-b px-2 py-1.5">
                    {(
                        [
                            { id: "all", label: "All" },
                            { id: "pending", label: "Pending" },
                            { id: "running", label: "Running" },
                            { id: "done", label: "Done" }
                        ] as { id: InboxFilter; label: string }[]
                    ).map((pill) => (
                        <button
                            key={pill.id}
                            className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium transition-all ${
                                activeFilter === pill.id
                                    ? "border-teal-400 bg-teal-50 text-teal-700 dark:border-teal-600 dark:bg-teal-950/30 dark:text-teal-300"
                                    : "border-transparent hover:border-gray-300 dark:hover:border-gray-600"
                            }`}
                            onClick={() => setActiveFilter(pill.id)}
                        >
                            {pill.label}
                            <span className="text-muted-foreground text-[9px]">
                                ({filterCounts[pill.id]})
                            </span>
                        </button>
                    ))}
                </div>

                {/* Items list */}
                <div ref={listRef} className="flex-1 overflow-y-auto">
                    {filtered.length === 0 && (
                        <div className="text-muted-foreground py-8 text-center text-xs">
                            No matches found
                        </div>
                    )}
                    {filtered.map((review, idx) => {
                        const risk = getRiskLevel(review);
                        const riskDot = RISK_DOT[risk] || RISK_DOT.unknown!;
                        const isActive = idx === clampedIndex;
                        const steps = stepCache.get(review.id) || [];
                        const completedSteps = steps.filter(
                            (s) => s.status.toUpperCase() === "COMPLETED"
                        ).length;

                        const currentStep = steps.find(
                            (s) =>
                                s.stepId === review.suspendedStep ||
                                s.status.toUpperCase() === "RUNNING" ||
                                s.status.toUpperCase() === "SUSPENDED"
                        );
                        const stepStatus = currentStep
                            ? currentStep.status.toUpperCase()
                            : "QUEUED";
                        const stepBadgeColor = STEP_BADGE[stepStatus] || STEP_BADGE.QUEUED!;

                        const issueId = review.reviewContext?.issueNumber
                            ? `#${review.reviewContext.issueNumber}`
                            : review.id.slice(0, 8);

                        return (
                            <div
                                key={review.id}
                                data-inbox-item
                                className={`cursor-pointer border-b px-3 py-2 transition-colors ${
                                    isActive
                                        ? "border-l-[3px] border-l-teal-500 bg-teal-50/50 dark:bg-teal-950/15"
                                        : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                }`}
                                onClick={() => setSelectedIndex(idx)}
                            >
                                <div className="flex items-start gap-2">
                                    <input
                                        type="checkbox"
                                        className="mt-1 shrink-0 accent-teal-500"
                                        checked={checkedIds.has(review.id)}
                                        onChange={() => toggleCheck(review.id)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <div
                                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${riskDot}`}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-mono text-xs font-bold">
                                                {issueId}
                                            </span>
                                            <span
                                                className={`text-[10px] font-medium ${getUrgencyClass(review.createdAt)}`}
                                            >
                                                {formatTimeAgo(review.createdAt)}
                                            </span>
                                        </div>
                                        <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
                                            {review.reviewContext?.summary ||
                                                getDecisionPrompt(review)}
                                        </p>
                                        <div className="mt-0.5 flex items-center gap-1.5">
                                            {currentStep && (
                                                <span
                                                    className={`rounded px-1 py-0 text-[8px] font-medium ${stepBadgeColor}`}
                                                >
                                                    {currentStep.stepName || currentStep.stepId}
                                                </span>
                                            )}
                                            <span className="text-muted-foreground font-mono text-[10px]">
                                                {review.workflowName || review.workflowSlug}
                                                {steps.length > 0 &&
                                                    ` · ${completedSteps}/${steps.length}`}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Status bar */}
                <div className="flex items-center justify-between border-t px-3 py-1.5">
                    <span className="text-muted-foreground text-[10px]">
                        {filtered.length} of {filteredReviews.length} shown
                    </span>
                    <div className="text-muted-foreground flex items-center gap-2 text-[10px]">
                        <span>
                            <kbd className="rounded border px-0.5 font-mono">j</kbd>/
                            <kbd className="rounded border px-0.5 font-mono">k</kbd> navigate
                        </span>
                        <span>
                            <kbd className="rounded border px-0.5 font-mono">a</kbd> approve
                        </span>
                        <span>
                            <kbd className="rounded border px-0.5 font-mono">r</kbd> reject
                        </span>
                        <span>
                            <kbd className="rounded border px-0.5 font-mono">f</kbd> feedback
                        </span>
                        <span>
                            <kbd className="rounded border px-0.5 font-mono">x</kbd> cancel
                        </span>
                    </div>
                </div>
            </div>

            {/* Right panel */}
            <div className="flex flex-1 flex-col overflow-hidden rounded-lg border">
                {selectedReview ? (
                    <>
                        <div className="flex-1 space-y-4 overflow-y-auto p-4">
                            {/* Header */}
                            <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <Badge
                                        className={RISK_COLORS[getRiskLevel(selectedReview)] || ""}
                                        variant="secondary"
                                    >
                                        {getRiskLevel(selectedReview)}
                                    </Badge>
                                    <Badge variant="outline">{selectedReview.status}</Badge>
                                    <Badge variant="outline" className="font-mono text-[10px]">
                                        {selectedReview.reviewContext?.issueNumber
                                            ? `#${selectedReview.reviewContext.issueNumber}`
                                            : selectedReview.id.slice(0, 8)}
                                    </Badge>
                                </div>
                                <h2 className="text-lg font-bold">
                                    {selectedReview.workflowName ||
                                        selectedReview.workflowSlug ||
                                        "Workflow"}
                                </h2>
                                <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
                                    <span>
                                        {selectedReview.workflowName || selectedReview.workflowSlug}
                                    </span>
                                    <span className={getUrgencyClass(selectedReview.createdAt)}>
                                        {formatTimeAgo(selectedReview.createdAt)}
                                    </span>
                                    {selectedSteps.length > 0 && (
                                        <span>
                                            {
                                                selectedSteps.filter(
                                                    (s) => s.status.toUpperCase() === "COMPLETED"
                                                ).length
                                            }
                                            /{selectedSteps.length} steps
                                        </span>
                                    )}
                                    {selectedReview.reviewContext?.issueUrl && (
                                        <a
                                            href={selectedReview.reviewContext.issueUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline dark:text-blue-400"
                                        >
                                            Issue →
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Summary */}
                            {selectedReview.reviewContext?.summary && (
                                <div className="space-y-1">
                                    <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                                        Summary
                                    </div>
                                    <p className="text-sm leading-relaxed">
                                        {selectedReview.reviewContext.summary}
                                    </p>
                                </div>
                            )}

                            {/* Progress */}
                            {selectedSteps.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                                        Workflow Steps ({selectedSteps.length})
                                    </div>
                                    <div className="h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                                        <div
                                            className="h-full rounded-full bg-green-500 transition-all"
                                            style={{
                                                width: `${
                                                    (selectedSteps.filter(
                                                        (s) =>
                                                            s.status.toUpperCase() === "COMPLETED"
                                                    ).length /
                                                        selectedSteps.length) *
                                                    100
                                                }%`
                                            }}
                                        />
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
                                        <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                                            Files Changed (
                                            {selectedReview.reviewContext.filesChanged.length})
                                        </div>
                                        <div className="max-h-40 overflow-y-auto rounded border bg-gray-50 p-2 dark:bg-gray-900">
                                            {selectedReview.reviewContext.filesChanged.map((f) => (
                                                <div
                                                    key={f}
                                                    className="truncate font-mono text-[10px]"
                                                >
                                                    <span className="text-green-600">+</span>{" "}
                                                    <span className="text-gray-600 dark:text-gray-400">
                                                        {f}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                        </div>

                        {/* Sticky action bar */}
                        <div className="border-t bg-gray-50/50 p-3 dark:bg-gray-900/50">
                            <div className="flex gap-2">
                                {selectedReview.status === "pending" && (
                                    <>
                                        <Button
                                            className="flex-1 bg-green-600 text-white hover:bg-green-700"
                                            onClick={() => {
                                                onApprove(selectedReview);
                                                advanceAfterAction();
                                            }}
                                        >
                                            Approve{" "}
                                            <kbd className="ml-1 rounded bg-green-700/30 px-1 font-mono text-[10px]">
                                                a
                                            </kbd>
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
                                            onClick={() => {
                                                onReject(selectedReview);
                                                advanceAfterAction();
                                            }}
                                        >
                                            Reject{" "}
                                            <kbd className="ml-1 rounded border px-1 font-mono text-[10px]">
                                                r
                                            </kbd>
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => onFeedback(selectedReview)}
                                        >
                                            Feedback{" "}
                                            <kbd className="ml-1 rounded border px-1 font-mono text-[10px]">
                                                f
                                            </kbd>
                                        </Button>
                                    </>
                                )}
                                <div className="flex-1" />
                                <Button
                                    variant="outline"
                                    onClick={() => onCancelRun(selectedReview)}
                                >
                                    Cancel Run{" "}
                                    <kbd className="ml-1 rounded border px-1 font-mono text-[10px]">
                                        x
                                    </kbd>
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex h-full items-center justify-center">
                        <p className="text-muted-foreground text-sm">
                            Select an item to view details
                        </p>
                    </div>
                )}
            </div>

            {/* Batch action bar */}
            {checkedIds.size > 0 && (
                <BatchActionBar
                    selectedCount={checkedIds.size}
                    onBatchApprove={() => {
                        onBatchApprove([...checkedIds]);
                        setCheckedIds(new Set());
                    }}
                    onBatchReject={() => {}}
                    onClearSelection={() => setCheckedIds(new Set())}
                />
            )}
        </div>
    );
}
