"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    Checkbox,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Skeleton,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Textarea
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

/* ─── Types ───────────────────────────────────────────────────────────── */

interface ReviewContext {
    summary?: string;
    issueUrl?: string;
    issueNumber?: number;
    repository?: string;
    analysisUrl?: string;
    riskLevel?: string;
    filesChanged?: string[];
    prompt?: string;
}

interface ReviewItem {
    id: string;
    status: string;
    workflowSlug?: string;
    workflowName?: string;
    runId?: string;
    runStatus?: string;
    suspendedStep?: string;
    reviewContext?: ReviewContext;
    githubRepo?: string;
    githubIssueNumber?: number;
    notifiedChannels: string[];
    responseChannel?: string;
    feedbackRound: number;
    feedbackText?: string;
    decidedBy?: string;
    decidedAt?: string;
    decisionReason?: string;
    orgName?: string;
    createdAt: string;
}

interface LearningProposal {
    id: string;
    status: string;
    agentId: string;
    agentSlug: string;
    agentName: string;
    agentVersion: number;
    triggerReason: string;
    riskTier: string;
    proposal: {
        id: string;
        title: string;
        description: string;
        changeDescription?: string;
        candidateInstructions?: string;
        candidateVersionId?: string;
    } | null;
    experiment: {
        id: string;
        status: string;
        winRate: number | null;
        gatingDecision: string | null;
        baselineRuns: number;
        candidateRuns: number;
    } | null;
    approval: {
        id: string;
        status: string;
        decidedBy?: string;
        decidedAt?: string;
    } | null;
    createdAt: string;
    updatedAt: string;
}

interface MetricsData {
    pendingCount: number;
    avgWaitMinutes: number;
    approvalRate7d: number;
    decisionsToday: number;
    avgDecisionMinutes: number;
    resolved24h: number;
    queueTrend: number;
}

interface ToastItem {
    id: string;
    message: string;
    type: "success" | "error" | "info";
}

/* ─── Constants ───────────────────────────────────────────────────────── */

const POLL_INTERVAL_MS = 15_000;
const TIME_UPDATE_INTERVAL_MS = 30_000;
const TOAST_DURATION_MS = 3000;

const RISK_COLORS: Record<string, string> = {
    trivial: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    low: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    critical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
};

const URGENCY_THRESHOLDS = [
    { maxMinutes: 30, className: "text-green-600 dark:text-green-400" },
    { maxMinutes: 120, className: "text-amber-600 dark:text-amber-400" },
    { maxMinutes: 480, className: "text-orange-600 dark:text-orange-400" }
];

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function formatTimeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function formatDuration(minutes: number): string {
    if (minutes < 1) return "<1m";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function getUrgencyClass(dateStr: string): string {
    const minutes = (Date.now() - new Date(dateStr).getTime()) / 60_000;
    for (const t of URGENCY_THRESHOLDS) {
        if (minutes < t.maxMinutes) return t.className;
    }
    return "text-red-600 dark:text-red-400";
}

function getRiskLevel(review: ReviewItem): string {
    return review.reviewContext?.riskLevel || "unknown";
}

function getDecisionPrompt(review: ReviewItem): string {
    const ctx = review.reviewContext;
    if (ctx?.prompt) return ctx.prompt;

    const step = review.suspendedStep || "action";
    const workflow = review.workflowName || review.workflowSlug || "workflow";

    if (ctx?.summary) {
        const firstSentence = ctx.summary.split(/[.!?\n]/)[0]?.trim();
        if (firstSentence && firstSentence.length > 10 && firstSentence.length < 200) {
            return firstSentence.endsWith("?") ? firstSentence : `${firstSentence}?`;
        }
    }

    return `Approve ${step} in ${workflow}?`;
}

/* ─── MetricsSummaryBar ───────────────────────────────────────────────── */

function MetricsSummaryBar({ metrics }: { metrics: MetricsData | null }) {
    if (!metrics) {
        return (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-[84px] rounded-xl" />
                ))}
            </div>
        );
    }

    const trendIcon = metrics.queueTrend > 0 ? "↑" : metrics.queueTrend < 0 ? "↓" : "→";
    const trendClass =
        metrics.queueTrend > 0
            ? "text-red-500"
            : metrics.queueTrend < 0
              ? "text-green-500"
              : "text-muted-foreground";

    const stats = [
        {
            label: "Pending",
            value: String(metrics.pendingCount),
            detail: (
                <span className={trendClass}>
                    {trendIcon} {Math.abs(metrics.queueTrend)} vs resolved/24h
                </span>
            )
        },
        {
            label: "Avg Wait",
            value: formatDuration(metrics.avgWaitMinutes),
            detail: <span className="text-muted-foreground">current pending</span>
        },
        {
            label: "Approval Rate",
            value: `${metrics.approvalRate7d}%`,
            detail: <span className="text-muted-foreground">last 7 days</span>
        },
        {
            label: "Decided Today",
            value: String(metrics.decisionsToday),
            detail: <span className="text-muted-foreground">decisions resolved</span>
        },
        {
            label: "Avg Decision Time",
            value: formatDuration(metrics.avgDecisionMinutes),
            detail: <span className="text-muted-foreground">last 7 days</span>
        }
    ];

    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {stats.map((stat) => (
                <Card key={stat.label}>
                    <CardContent className="p-4">
                        <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                            {stat.label}
                        </div>
                        <div className="mt-1 text-2xl font-bold tabular-nums">{stat.value}</div>
                        <div className="mt-0.5 text-xs">{stat.detail}</div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

/* ─── ShortcutHelpDialog ──────────────────────────────────────────────── */

function ShortcutHelpDialog({
    open,
    onOpenChange
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const shortcuts = [
        { keys: "j / k", action: "Navigate between cards" },
        { keys: "Enter", action: "Expand / collapse card details" },
        { keys: "a", action: "Approve focused card" },
        { keys: "r", action: "Reject focused card" },
        { keys: "f", action: "Open feedback on focused card" },
        { keys: "x", action: "Toggle select on focused card" },
        { keys: "Shift + a", action: "Approve all selected" },
        { keys: "Escape", action: "Clear selection / cancel" },
        { keys: "?", action: "Show this help" }
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Keyboard Shortcuts</DialogTitle>
                    <DialogDescription>
                        Navigate and act on decisions without touching the mouse.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                    {shortcuts.map((s) => (
                        <div key={s.keys} className="flex items-center justify-between py-1">
                            <span className="text-muted-foreground text-sm">{s.action}</span>
                            <kbd className="bg-muted rounded px-2 py-0.5 font-mono text-xs">
                                {s.keys}
                            </kbd>
                        </div>
                    ))}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/* ─── Main Page ───────────────────────────────────────────────────────── */

export default function CommandPage() {
    const [reviews, setReviews] = useState<ReviewItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState("pending");
    const [metrics, setMetrics] = useState<MetricsData | null>(null);

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
    const [connectionError, setConnectionError] = useState(false);
    const [, setTimeTick] = useState(0);

    const [filterWorkflow, setFilterWorkflow] = useState<string>("all");
    const [filterRisk, setFilterRisk] = useState<string>("all");

    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const [showShortcuts, setShowShortcuts] = useState(false);

    const [learningProposals, setLearningProposals] = useState<LearningProposal[]>([]);
    const [learningLoading, setLearningLoading] = useState(false);
    const [learningActingId, setLearningActingId] = useState<string | null>(null);

    const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const feedbackInputRef = useRef<HTMLTextAreaElement | null>(null);

    /* ─── Toast notifications ────────────────────────────────────────── */

    const addToast = useCallback((message: string, type: ToastItem["type"] = "success") => {
        const id = Math.random().toString(36).slice(2);
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((n) => n.id !== id));
        }, TOAST_DURATION_MS);
    }, []);

    /* ─── Filtering ──────────────────────────────────────────────────── */

    const workflowSlugs = [
        ...new Set(reviews.map((r) => r.workflowSlug).filter(Boolean) as string[])
    ];
    const riskLevels = [...new Set(reviews.map(getRiskLevel).filter((r) => r !== "unknown"))];

    const filteredReviews = reviews.filter((r) => {
        if (filterWorkflow !== "all" && r.workflowSlug !== filterWorkflow) return false;
        if (filterRisk !== "all" && getRiskLevel(r) !== filterRisk) return false;
        return true;
    });

    const filteredCount = filteredReviews.length;

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

    /* ─── Effects ─────────────────────────────────────────────────────── */

    useEffect(() => {
        if (tab === "learning") {
            fetchLearningProposals();
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

    useEffect(() => {
        setFocusedIndex((prev) => Math.min(prev, Math.max(0, filteredCount - 1)));
    }, [filteredCount]);

    /* ─── Keyboard shortcuts ─────────────────────────────────────────── */

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
                    setFocusedIndex((prev) => {
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
                    setFocusedIndex((prev) => {
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
                case "?": {
                    e.preventDefault();
                    setShowShortcuts(true);
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
    }, [
        focusedIndex,
        selectedIds,
        confirmingRejectId,
        feedbackForId,
        reviews,
        filterWorkflow,
        filterRisk
    ]);

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

    /* ─── Actions ─────────────────────────────────────────────────────── */

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
        if (!feedbackText.trim()) return;
        setActingId(review.id);
        try {
            const res = await fetch(`${getApiBase()}/api/reviews`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    approvalRequestId: review.id,
                    decision: "feedback",
                    message: feedbackText
                })
            });
            const data = await res.json();
            if (data.success) {
                addToast("Feedback sent — agent will re-analyze");
                setFeedbackForId(null);
                setFeedbackText("");
                fetchReviews(tab);
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
                fetchReviews(tab);
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

    function dismissNewReviews() {
        setNewReviewCount(0);
        setHighlightedIds(new Set());
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    /* ─── Card renderer ──────────────────────────────────────────────── */

    function renderCard(review: ReviewItem, index: number) {
        const isFocused = focusedIndex === index;
        const isSelected = selectedIds.has(review.id);
        const isExpanded = expandedIds.has(review.id);
        const isConfirmingReject = confirmingRejectId === review.id;
        const isFeedbackMode = feedbackForId === review.id;
        const isActing = actingId === review.id;
        const isNew = highlightedIds.has(review.id);
        const isPending = review.status === "pending";
        const risk = getRiskLevel(review);
        const prompt = getDecisionPrompt(review);

        return (
            <div
                key={review.id}
                ref={(el) => {
                    if (el) cardRefs.current.set(index, el);
                }}
                className={[
                    "transition-all duration-150",
                    isFocused ? "ring-primary rounded-xl ring-2" : "rounded-xl",
                    isNew ? "animate-pulse" : ""
                ].join(" ")}
            >
                <Card className={isSelected ? "border-primary" : ""}>
                    <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                                {isPending && (
                                    <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => toggleSelect(review.id)}
                                        />
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span
                                            className={`font-mono text-sm font-semibold ${getUrgencyClass(review.createdAt)}`}
                                        >
                                            {formatTimeAgo(review.createdAt)}
                                        </span>
                                        <Badge
                                            className={RISK_COLORS[risk] || ""}
                                            variant={risk === "unknown" ? "outline" : "secondary"}
                                        >
                                            {risk}
                                        </Badge>
                                        <span className="text-muted-foreground text-sm">
                                            {review.workflowName ||
                                                review.workflowSlug ||
                                                "workflow"}
                                        </span>
                                        {review.feedbackRound > 1 && (
                                            <Badge variant="outline" className="text-xs">
                                                round {review.feedbackRound}
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="mt-1.5 text-base font-medium">{prompt}</p>
                                </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                                {review.githubRepo && review.githubIssueNumber && (
                                    <a
                                        href={`https://github.com/${review.githubRepo}/issues/${review.githubIssueNumber}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-muted-foreground hover:text-foreground text-sm"
                                    >
                                        #{review.githubIssueNumber}
                                    </a>
                                )}
                                {review.notifiedChannels.map((ch) => (
                                    <Badge key={ch} variant="outline" className="text-xs">
                                        {ch}
                                    </Badge>
                                ))}
                                {!isPending && (
                                    <Badge
                                        variant={
                                            review.status === "approved"
                                                ? "default"
                                                : review.status === "rejected"
                                                  ? "destructive"
                                                  : "secondary"
                                        }
                                    >
                                        {review.status}
                                    </Badge>
                                )}
                                {!isPending && review.decidedBy && (
                                    <span className="text-muted-foreground text-xs">
                                        by {review.decidedBy} via {review.responseChannel}
                                    </span>
                                )}
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-3 pt-0">
                        {/* Expandable details */}
                        <Collapsible open={isExpanded} onOpenChange={() => toggleExpand(review.id)}>
                            <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 text-xs">
                                <span
                                    className="inline-block transition-transform duration-150"
                                    style={{
                                        transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)"
                                    }}
                                >
                                    ▶
                                </span>
                                {isExpanded ? "Hide details" : "Show details"}
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <div className="bg-muted/50 mt-2 space-y-2 rounded-lg p-3">
                                    {review.reviewContext?.summary && (
                                        <div>
                                            <div className="text-muted-foreground mb-1 text-xs font-medium">
                                                Summary
                                            </div>
                                            <p className="text-sm whitespace-pre-wrap">
                                                {review.reviewContext.summary}
                                            </p>
                                        </div>
                                    )}
                                    {review.reviewContext?.analysisUrl && (
                                        <div>
                                            <a
                                                href={review.reviewContext.analysisUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm text-blue-600 hover:underline"
                                            >
                                                View full analysis
                                            </a>
                                        </div>
                                    )}
                                    {review.reviewContext?.filesChanged &&
                                        review.reviewContext.filesChanged.length > 0 && (
                                            <div>
                                                <div className="text-muted-foreground mb-1 text-xs font-medium">
                                                    Files changed
                                                </div>
                                                <div className="flex flex-wrap gap-1">
                                                    {review.reviewContext.filesChanged.map((f) => (
                                                        <code
                                                            key={f}
                                                            className="bg-muted rounded px-1.5 py-0.5 text-xs"
                                                        >
                                                            {f}
                                                        </code>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    <div className="text-muted-foreground flex gap-3 text-xs">
                                        <span>
                                            Step: <code>{review.suspendedStep || "—"}</code>
                                        </span>
                                        {review.runId && (
                                            <span>
                                                Run: <code>{review.runId.slice(0, 12)}…</code>
                                            </span>
                                        )}
                                    </div>
                                    {review.feedbackText && (
                                        <div>
                                            <div className="text-muted-foreground mb-1 text-xs font-medium">
                                                Previous feedback
                                            </div>
                                            <p className="text-sm italic">{review.feedbackText}</p>
                                        </div>
                                    )}
                                </div>
                            </CollapsibleContent>
                        </Collapsible>

                        {/* Inline reject confirmation */}
                        {isConfirmingReject && (
                            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
                                <span className="text-sm font-medium">
                                    Reject this review? The workflow will be cancelled.
                                </span>
                                <div className="ml-auto flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setConfirmingRejectId(null)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => handleReject(review)}
                                        disabled={isActing}
                                    >
                                        {isActing ? "Rejecting…" : "Yes, reject"}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Inline feedback form */}
                        {isFeedbackMode && (
                            <div className="space-y-2 rounded-lg border p-3">
                                <Textarea
                                    ref={(el: HTMLTextAreaElement | null) => {
                                        feedbackInputRef.current = el;
                                    }}
                                    placeholder="Describe what changes or additional analysis you want…"
                                    value={feedbackText}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                                        setFeedbackText(e.target.value)
                                    }
                                    rows={3}
                                    onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                            e.preventDefault();
                                            handleFeedback(review);
                                        }
                                        if (e.key === "Escape") {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setFeedbackForId(null);
                                        }
                                    }}
                                />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground text-xs">
                                        Cmd+Enter to submit
                                    </span>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setFeedbackForId(null)}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={() => handleFeedback(review)}
                                            disabled={isActing || !feedbackText.trim()}
                                        >
                                            {isActing ? "Sending…" : "Send feedback"}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Action buttons */}
                        {isPending && !isConfirmingReject && !isFeedbackMode && (
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    onClick={() => handleApprove(review)}
                                    disabled={isActing}
                                >
                                    {isActing ? "Approving…" : "Approve"}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => setConfirmingRejectId(review.id)}
                                    disabled={isActing}
                                >
                                    Reject
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        setFeedbackForId(review.id);
                                        setFeedbackText("");
                                        setTimeout(() => feedbackInputRef.current?.focus(), 100);
                                    }}
                                    disabled={isActing}
                                >
                                    Feedback
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }

    /* ─── Derived values ─────────────────────────────────────────────── */

    const pendingInFiltered = filteredReviews.filter((r) => r.status === "pending");
    const allPendingSelected =
        pendingInFiltered.length > 0 && pendingInFiltered.every((r) => selectedIds.has(r.id));

    /* ─── Render ──────────────────────────────────────────────────────── */

    return (
        <div className="container mx-auto max-w-6xl space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Command</h1>
                    <p className="text-muted-foreground">Your agents await decisions</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowShortcuts(true)}>
                    <kbd className="mr-1 font-mono text-xs">?</kbd> Shortcuts
                </Button>
            </div>

            {/* Metrics summary bar */}
            <MetricsSummaryBar metrics={metrics} />

            {/* Connection error banner */}
            {connectionError && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    Connection lost — retrying automatically
                </div>
            )}

            {/* New reviews banner */}
            {newReviewCount > 0 && (
                <button
                    onClick={dismissNewReviews}
                    className="w-full rounded-lg bg-blue-50 px-4 py-2 text-center text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50"
                >
                    {newReviewCount} new decision
                    {newReviewCount > 1 ? "s" : ""} awaiting your authority
                </button>
            )}

            {/* Tabs + content */}
            <Tabs
                defaultValue="pending"
                value={tab}
                onValueChange={(v) => {
                    setTab(v);
                    setSelectedIds(new Set());
                    setFocusedIndex(0);
                    setConfirmingRejectId(null);
                    setFeedbackForId(null);
                    setNewReviewCount(0);
                    setHighlightedIds(new Set());
                    prevReviewIds.current = new Set();
                }}
            >
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
                    <TabsTrigger value="all">All</TabsTrigger>
                </TabsList>

                {/* Learning tab content */}
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

                {/* Workflow review tabs */}
                <TabsContent value={tab} className="space-y-4">
                    {/* Filter bar + bulk actions */}
                    {!loading && reviews.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3">
                            {workflowSlugs.length > 1 && (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-muted-foreground text-xs">Workflow:</span>
                                    <select
                                        value={filterWorkflow}
                                        onChange={(e) => setFilterWorkflow(e.target.value)}
                                        className="border-input bg-background rounded-md border px-2 py-1 text-xs"
                                    >
                                        <option value="all">All</option>
                                        {workflowSlugs.map((slug) => (
                                            <option key={slug} value={slug}>
                                                {slug}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            {riskLevels.length > 1 && (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-muted-foreground text-xs">Risk:</span>
                                    <select
                                        value={filterRisk}
                                        onChange={(e) => setFilterRisk(e.target.value)}
                                        className="border-input bg-background rounded-md border px-2 py-1 text-xs"
                                    >
                                        <option value="all">All</option>
                                        {riskLevels.map((level) => (
                                            <option key={level} value={level}>
                                                {level}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {tab === "pending" && pendingInFiltered.length > 0 && (
                                <>
                                    <div className="flex items-center gap-1.5">
                                        <Checkbox
                                            checked={allPendingSelected}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                        <span className="text-muted-foreground text-xs">
                                            Select all
                                        </span>
                                    </div>
                                    {selectedIds.size > 0 && (
                                        <Button
                                            size="sm"
                                            onClick={handleBatchApprove}
                                            disabled={batchActing}
                                        >
                                            {batchActing
                                                ? "Processing…"
                                                : `Approve selected (${selectedIds.size})`}
                                        </Button>
                                    )}
                                </>
                            )}

                            <span className="text-muted-foreground ml-auto text-xs">
                                {filteredReviews.length} decision
                                {filteredReviews.length !== 1 ? "s" : ""}
                            </span>
                        </div>
                    )}

                    {/* Card grid */}
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-32 w-full rounded-xl" />
                            ))}
                        </div>
                    ) : filteredReviews.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <p className="text-muted-foreground">
                                    No {tab === "all" ? "" : tab} decisions found
                                    {filterWorkflow !== "all" || filterRisk !== "all"
                                        ? " matching filters"
                                        : ""}
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {filteredReviews.map((review, index) => renderCard(review, index))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Toast notifications */}
            {toasts.length > 0 && (
                <div className="fixed right-4 bottom-4 z-50 space-y-2">
                    {toasts.map((t) => (
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

            {/* Keyboard shortcuts dialog */}
            <ShortcutHelpDialog open={showShortcuts} onOpenChange={setShowShortcuts} />
        </div>
    );
}
