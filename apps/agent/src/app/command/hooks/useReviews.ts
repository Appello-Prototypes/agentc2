"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getApiBase } from "@/lib/utils";
import {
    type ReviewItem,
    type MetricsData,
    type LearningProposal,
    type ToastItem,
    type SortOption,
    POLL_INTERVAL_MS,
    TIME_UPDATE_INTERVAL_MS,
    TOAST_DURATION_MS,
    RISK_SORT_ORDER,
    getRiskLevel
} from "../types";

export function useReviews() {
    const [tab, setTabState] = useState("pending");
    const [reviews, setReviews] = useState<ReviewItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState<MetricsData | null>(null);
    const [connectionError, setConnectionError] = useState(false);

    const [learningProposals, setLearningProposals] = useState<LearningProposal[]>([]);
    const [learningLoading, setLearningLoading] = useState(false);
    const [learningActingId, setLearningActingId] = useState<string | null>(null);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [focusedIndex, setFocusedIndex] = useState(0);
    const [confirmingRejectId, setConfirmingRejectId] = useState<string | null>(null);
    const [feedbackForId, setFeedbackForId] = useState<string | null>(null);
    const [feedbackText, setFeedbackText] = useState("");

    const [actingId, setActingId] = useState<string | null>(null);
    const [batchActing, setBatchActing] = useState(false);

    const prevReviewIds = useRef<Set<string>>(new Set());
    const [newReviewCount, setNewReviewCount] = useState(0);
    const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());

    const [, setTimeTick] = useState(0);

    const [filterWorkflow, setFilterWorkflow] = useState<string>("all");
    const [filterRisk, setFilterRisk] = useState<string>("all");
    const [sortBy, setSortBy] = useState<SortOption>("newest");

    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const feedbackInputRef = useRef<HTMLTextAreaElement | null>(null);

    /* ─── Toast ───────────────────────────────────────────────────────── */

    const addToast = useCallback((message: string, type: ToastItem["type"] = "success") => {
        const id = Math.random().toString(36).slice(2);
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((n) => n.id !== id));
        }, TOAST_DURATION_MS);
    }, []);

    /* ─── Data fetching ──────────────────────────────────────────────── */

    const fetchReviews = useCallback(async (status: string, isPolling = false) => {
        if (!isPolling) setLoading(true);
        try {
            const res = await fetch(`${getApiBase()}/api/reviews?status=${status}`);
            const data = await res.json();
            setConnectionError(false);
            if (data.success) {
                const incoming: ReviewItem[] = data.reviews;

                if (isPolling && prevReviewIds.current.size > 0) {
                    const newIds = incoming
                        .filter((r) => !prevReviewIds.current.has(r.id))
                        .map((r) => r.id);
                    if (newIds.length > 0) {
                        setNewReviewCount(newIds.length);
                        setHighlightedIds(new Set(newIds));
                        if (
                            typeof window !== "undefined" &&
                            "Notification" in window &&
                            Notification.permission === "granted"
                        ) {
                            const hasHighPriority = incoming.some(
                                (r) =>
                                    newIds.includes(r.id) &&
                                    ["high", "critical"].includes(getRiskLevel(r))
                            );
                            if (hasHighPriority) {
                                new Notification("AgentC2: Decision required", {
                                    body: `${newIds.length} agent(s) awaiting your decision`,
                                    icon: "/favicon.ico"
                                });
                            }
                        }
                    }
                }

                prevReviewIds.current = new Set(incoming.map((r) => r.id));
                setReviews(incoming);
            }
        } catch {
            setConnectionError(true);
        } finally {
            if (!isPolling) setLoading(false);
        }
    }, []);

    const fetchMetrics = useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/reviews?action=metrics`);
            const data = await res.json();
            if (data.success) setMetrics(data.metrics);
        } catch {
            /* non-critical */
        }
    }, []);

    const fetchLearningProposals = useCallback(async () => {
        setLearningLoading(true);
        try {
            const res = await fetch(
                `${getApiBase()}/api/reviews?type=learning&status=AWAITING_APPROVAL`
            );
            const data = await res.json();
            if (data.success) setLearningProposals(data.learningProposals || []);
        } catch {
            /* non-critical */
        } finally {
            setLearningLoading(false);
        }
    }, []);

    /* ─── Tab change ─────────────────────────────────────────────────── */

    const changeTab = useCallback((newTab: string) => {
        setTabState(newTab);
        setSelectedIds(new Set());
        setFocusedIndex(0);
        setConfirmingRejectId(null);
        setFeedbackForId(null);
        setNewReviewCount(0);
        setHighlightedIds(new Set());
        prevReviewIds.current = new Set();
    }, []);

    /* ─── Effects ─────────────────────────────────────────────────────── */

    useEffect(() => {
        if (tab === "learning") {
            fetchLearningProposals();
        } else if (tab === "audit") {
            fetchReviews("all");
        } else {
            fetchReviews(tab);
        }
        fetchMetrics();
    }, [tab, fetchReviews, fetchMetrics, fetchLearningProposals]);

    useEffect(() => {
        if (tab !== "pending") return;
        const interval = setInterval(() => {
            fetchReviews(tab, true);
            fetchMetrics();
        }, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [tab, fetchReviews, fetchMetrics]);

    useEffect(() => {
        const interval = setInterval(() => {
            setTimeTick((t) => t + 1);
        }, TIME_UPDATE_INTERVAL_MS);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "default"
        ) {
            Notification.requestPermission();
        }
    }, []);

    /* ─── Filtering & sorting ────────────────────────────────────────── */

    const workflowSlugs = useMemo(
        () => [...new Set(reviews.map((r) => r.workflowSlug).filter(Boolean) as string[])],
        [reviews]
    );

    const riskLevels = useMemo(
        () => [...new Set(reviews.map(getRiskLevel).filter((r) => r !== "unknown"))],
        [reviews]
    );

    const filteredReviews = useMemo(() => {
        const base = tab === "audit" ? reviews.filter((r) => r.status !== "pending") : reviews;

        const afterFilter = base.filter((r) => {
            if (filterWorkflow !== "all" && r.workflowSlug !== filterWorkflow) return false;
            if (filterRisk !== "all" && getRiskLevel(r) !== filterRisk) return false;
            return true;
        });

        return [...afterFilter].sort((a, b) => {
            switch (sortBy) {
                case "oldest":
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                case "highest-risk":
                    return (
                        (RISK_SORT_ORDER[getRiskLevel(a)] ?? 5) -
                        (RISK_SORT_ORDER[getRiskLevel(b)] ?? 5)
                    );
                case "by-source":
                    return (a.sourceType || "").localeCompare(b.sourceType || "");
                default:
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
        });
    }, [reviews, tab, filterWorkflow, filterRisk, sortBy]);

    useEffect(() => {
        setFocusedIndex((prev) => Math.min(prev, Math.max(0, filteredReviews.length - 1)));
    }, [filteredReviews.length]);

    /* ─── Selection helpers ──────────────────────────────────────────── */

    function toggleSelect(id: string) {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function toggleSelectAll() {
        const pendingIds = filteredReviews.filter((r) => r.status === "pending").map((r) => r.id);
        const allSelected = pendingIds.every((id) => selectedIds.has(id));
        setSelectedIds(allSelected ? new Set() : new Set(pendingIds));
    }

    function toggleExpand(id: string) {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    /* ─── Review actions ─────────────────────────────────────────────── */

    async function handleApprove(review: ReviewItem) {
        setActingId(review.id);
        try {
            const res = await fetch(`${getApiBase()}/api/reviews`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    approvalRequestId: review.id,
                    decision: "approved"
                })
            });
            const data = await res.json();
            if (data.success) {
                addToast(
                    `Approved — ${review.workflowName || review.workflowSlug || "workflow"} resumed`
                );
                setReviews((prev) => prev.filter((r) => r.id !== review.id));
                setSelectedIds((prev) => {
                    const next = new Set(prev);
                    next.delete(review.id);
                    return next;
                });
                fetchMetrics();
            } else {
                addToast(data.error || "Approval failed", "error");
            }
        } catch {
            addToast("Network error", "error");
        } finally {
            setActingId(null);
        }
    }

    async function handleReject(review: ReviewItem) {
        setActingId(review.id);
        setConfirmingRejectId(null);
        try {
            const res = await fetch(`${getApiBase()}/api/reviews`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    approvalRequestId: review.id,
                    decision: "rejected"
                })
            });
            const data = await res.json();
            if (data.success) {
                addToast(`Rejected — ${review.workflowName || review.workflowSlug || "workflow"}`);
                setReviews((prev) => prev.filter((r) => r.id !== review.id));
                setSelectedIds((prev) => {
                    const next = new Set(prev);
                    next.delete(review.id);
                    return next;
                });
                fetchMetrics();
            } else {
                addToast(data.error || "Rejection failed", "error");
            }
        } catch {
            addToast("Network error", "error");
        } finally {
            setActingId(null);
        }
    }

    async function handleFeedback(review: ReviewItem) {
        const text = feedbackText.trim() || "Needs revision — please re-analyze.";
        setActingId(review.id);
        try {
            const res = await fetch(`${getApiBase()}/api/reviews`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    approvalRequestId: review.id,
                    decision: "feedback",
                    message: text
                })
            });
            const data = await res.json();
            if (data.success) {
                addToast("Feedback sent — agent will re-analyze");
                setFeedbackForId(null);
                setFeedbackText("");
                fetchReviews(tab === "audit" ? "all" : tab);
                fetchMetrics();
            } else {
                addToast(data.error || "Feedback failed", "error");
            }
        } catch {
            addToast("Network error", "error");
        } finally {
            setActingId(null);
        }
    }

    async function handleConditional(
        review: ReviewItem,
        conditionMeta: { conditionType: "ci-checks"; repository?: string; ref?: string }
    ) {
        setActingId(review.id);
        try {
            const res = await fetch(`${getApiBase()}/api/reviews`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    approvalRequestId: review.id,
                    decision: "conditional",
                    conditionMeta
                })
            });
            const data = await res.json();
            if (data.success) {
                addToast("Conditional approval set — checking conditions...");
                setReviews((prev) =>
                    prev.map((r) => (r.id === review.id ? { ...r, status: "conditional" } : r))
                );
                fetchMetrics();
            } else {
                addToast(data.error || "Conditional approval failed", "error");
            }
        } catch {
            addToast("Network error", "error");
        } finally {
            setActingId(null);
        }
    }

    async function handleBatchApprove() {
        const items = [...selectedIds].map((id) => ({
            approvalRequestId: id,
            decision: "approved" as const
        }));
        if (items.length === 0) return;

        setBatchActing(true);
        try {
            const res = await fetch(`${getApiBase()}/api/reviews`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items })
            });
            const data = await res.json();
            if (data.success) {
                addToast(`Batch approved ${data.successCount}/${data.totalCount} reviews`);
                setSelectedIds(new Set());
                fetchReviews(tab === "audit" ? "all" : tab);
                fetchMetrics();
            } else {
                addToast("Batch operation failed", "error");
            }
        } catch {
            addToast("Network error", "error");
        } finally {
            setBatchActing(false);
        }
    }

    /* ─── Learning actions ───────────────────────────────────────────── */

    async function handleLearningApprove(sessionId: string) {
        setLearningActingId(sessionId);
        try {
            const res = await fetch(`${getApiBase()}/api/reviews`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "learning",
                    sessionId,
                    decision: "approve"
                })
            });
            const data = await res.json();
            if (data.success) {
                addToast("Learning proposal approved — version promotion in progress");
                setLearningProposals((prev) => prev.filter((p) => p.id !== sessionId));
            } else {
                addToast(data.error || "Approval failed", "error");
            }
        } catch {
            addToast("Network error", "error");
        } finally {
            setLearningActingId(null);
        }
    }

    async function handleLearningReject(sessionId: string) {
        setLearningActingId(sessionId);
        try {
            const res = await fetch(`${getApiBase()}/api/reviews`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "learning",
                    sessionId,
                    decision: "reject"
                })
            });
            const data = await res.json();
            if (data.success) {
                addToast("Learning proposal rejected");
                setLearningProposals((prev) => prev.filter((p) => p.id !== sessionId));
            } else {
                addToast(data.error || "Rejection failed", "error");
            }
        } catch {
            addToast("Network error", "error");
        } finally {
            setLearningActingId(null);
        }
    }

    /* ─── Cancel run ─────────────────────────────────────────────────── */

    async function handleCancelRun(review: ReviewItem) {
        setActingId(review.id);
        try {
            const res = await fetch(`${getApiBase()}/api/reviews/${review.id}/cancel`, {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            });
            const data = await res.json();
            if (data.success) {
                addToast(
                    `Run cancelled — ${data.workflowName || review.workflowName || review.workflowSlug || "workflow"}`
                );
                setReviews((prev) => prev.filter((r) => r.id !== review.id));
                setSelectedIds((prev) => {
                    const next = new Set(prev);
                    next.delete(review.id);
                    return next;
                });
                fetchMetrics();
            } else {
                addToast(data.error || "Cancel failed", "error");
            }
        } catch {
            addToast("Network error", "error");
        } finally {
            setActingId(null);
        }
    }

    /* ─── Retry step ────────────────────────────────────────────────── */

    async function handleRetryStep(reviewId: string, stepId: string) {
        setActingId(reviewId);
        try {
            const res = await fetch(`${getApiBase()}/api/reviews/${reviewId}/retry`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ stepId })
            });
            const data = await res.json();
            if (data.success) {
                addToast("Step retried successfully");
                fetchReviews(tab === "audit" ? "all" : tab);
                fetchMetrics();
            } else {
                addToast(data.error || "Retry failed", "error");
            }
        } catch {
            addToast("Network error", "error");
        } finally {
            setActingId(null);
        }
    }

    /* ─── Skip step ─────────────────────────────────────────────────── */

    async function handleSkipStep(reviewId: string, stepId: string, reason?: string) {
        setActingId(reviewId);
        try {
            const res = await fetch(`${getApiBase()}/api/reviews/${reviewId}/skip`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ stepId, reason })
            });
            const data = await res.json();
            if (data.success) {
                addToast("Step skipped — workflow continuing");
                fetchReviews(tab === "audit" ? "all" : tab);
                fetchMetrics();
            } else {
                addToast(data.error || "Skip failed", "error");
            }
        } catch {
            addToast("Network error", "error");
        } finally {
            setActingId(null);
        }
    }

    /* ─── Misc helpers ───────────────────────────────────────────────── */

    function dismissNewReviews() {
        setNewReviewCount(0);
        setHighlightedIds(new Set());
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    /* ─── Derived values ─────────────────────────────────────────────── */

    const pendingInFiltered = filteredReviews.filter((r) => r.status === "pending");
    const allPendingSelected =
        pendingInFiltered.length > 0 && pendingInFiltered.every((r) => selectedIds.has(r.id));

    return {
        tab,
        changeTab,
        reviews,
        filteredReviews,
        loading,
        metrics,
        connectionError,

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

        newReviewCount,
        highlightedIds,

        filterWorkflow,
        setFilterWorkflow,
        filterRisk,
        setFilterRisk,
        sortBy,
        setSortBy,

        toasts,
        addToast,

        feedbackInputRef,

        workflowSlugs,
        riskLevels,
        pendingInFiltered,
        allPendingSelected,

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
        toggleExpand,
        dismissNewReviews
    };
}
