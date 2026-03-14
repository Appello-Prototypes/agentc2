"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, CardContent, Skeleton } from "@repo/ui";
import { ChipSlideout } from "../shared/ChipSlideout";
import type { CommandViewProps, ReviewItem, StepData } from "../../types";
import { getRiskLevel } from "../../types";

/* ─── Types ────────────────────────────────────────────────────────── */

type ZoomLevel = "1h" | "6h" | "24h";
type SortMode = "start-time" | "wait-time" | "risk";

const ZOOM_MS: Record<ZoomLevel, number> = {
    "1h": 3_600_000,
    "6h": 21_600_000,
    "24h": 86_400_000
};

/* ─── Segment colors ────────────────────────────────────────────────── */

const STEP_STATUS_COLORS: Record<string, string> = {
    COMPLETED: "bg-emerald-400 dark:bg-emerald-500",
    FAILED: "bg-red-400 dark:bg-red-500",
    RUNNING: "bg-blue-400 dark:bg-blue-500",
    SUSPENDED: "bg-amber-400 dark:bg-amber-500",
    QUEUED: "bg-gray-300 dark:bg-gray-600",
    PENDING: "bg-gray-300 dark:bg-gray-600"
};

const STEP_STATUS_LABELS: Record<string, string> = {
    COMPLETED: "DONE",
    FAILED: "FAIL",
    RUNNING: "RUN",
    SUSPENDED: "WAIT",
    QUEUED: "QUEUE",
    PENDING: "QUEUE"
};

/* ─── Risk dot colors ────────────────────────────────────────────── */

const RISK_DOT: Record<string, string> = {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-amber-400",
    low: "bg-green-500",
    trivial: "bg-gray-400",
    unknown: "bg-gray-400"
};

const RISK_SORT: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    trivial: 4,
    unknown: 5
};

/* ─── Timeline layout hook ──────────────────────────────────────── */

interface TimelineSegment {
    step: StepData;
    startPct: number;
    widthPct: number;
    color: string;
    label: string;
}

interface TimelineTrack {
    review: ReviewItem;
    steps: StepData[];
    segments: TimelineSegment[];
    markers: { type: "waiting" | "running" | "failed"; pct: number }[];
}

function useTimelineLayout(
    reviews: ReviewItem[],
    stepCache: Map<string, StepData[]>,
    zoom: ZoomLevel,
    now: number,
    sortMode: SortMode
): { tracks: TimelineTrack[]; tickLabels: string[] } {
    return useMemo(() => {
        const windowMs = ZOOM_MS[zoom];
        const rangeStart = now - windowMs;

        const tracks: TimelineTrack[] = reviews
            .map((review) => {
                const steps = stepCache.get(review.id) || [];
                const segments: TimelineSegment[] = [];
                const markers: TimelineTrack["markers"] = [];

                for (const step of steps) {
                    if (!step.startedAt) {
                        segments.push({
                            step,
                            startPct: 0,
                            widthPct: 1,
                            color: "bg-gray-400/30 dark:bg-gray-600/30 border border-dashed border-gray-400",
                            label: step.stepName || step.stepId
                        });
                        continue;
                    }

                    const start = new Date(step.startedAt).getTime();
                    const end = step.completedAt ? new Date(step.completedAt).getTime() : now;
                    const duration = Math.max(end - start, windowMs * 0.01);
                    const startPct = Math.max(0, ((start - rangeStart) / windowMs) * 100);
                    const widthPct = Math.min(
                        100 - startPct,
                        Math.max(1, (duration / windowMs) * 100)
                    );
                    const statusKey = step.status.toUpperCase();
                    const label = STEP_STATUS_LABELS[statusKey] || statusKey;

                    segments.push({
                        step,
                        startPct,
                        widthPct,
                        color: STEP_STATUS_COLORS[statusKey] || STEP_STATUS_COLORS.PENDING!,
                        label
                    });

                    if (statusKey === "RUNNING") {
                        markers.push({ type: "running", pct: Math.min(startPct + widthPct, 99) });
                    } else if (statusKey === "FAILED") {
                        markers.push({ type: "failed", pct: Math.min(startPct + widthPct, 99) });
                    }
                }

                if (review.suspendedStep) {
                    const suspSeg = segments.find((s) => s.step.stepId === review.suspendedStep);
                    if (suspSeg) {
                        markers.push({
                            type: "waiting",
                            pct: Math.min(suspSeg.startPct + suspSeg.widthPct, 99)
                        });
                    }
                }

                return { review, steps, segments, markers };
            })
            .filter((t) => t.segments.length > 0);

        tracks.sort((a, b) => {
            switch (sortMode) {
                case "wait-time": {
                    const aWait = a.review.suspendedStep ? 1 : 0;
                    const bWait = b.review.suspendedStep ? 1 : 0;
                    if (aWait !== bWait) return bWait - aWait;
                    return (
                        new Date(a.review.createdAt).getTime() -
                        new Date(b.review.createdAt).getTime()
                    );
                }
                case "risk":
                    return (
                        (RISK_SORT[getRiskLevel(a.review)] ?? 5) -
                        (RISK_SORT[getRiskLevel(b.review)] ?? 5)
                    );
                default:
                    return (
                        new Date(a.review.createdAt).getTime() -
                        new Date(b.review.createdAt).getTime()
                    );
            }
        });

        const tickCount = 6;
        const tickLabels: string[] = [];
        for (let i = 0; i <= tickCount; i++) {
            if (i === tickCount) {
                tickLabels.push("Now");
            } else {
                const msAgo = windowMs - (windowMs * i) / tickCount;
                const h = Math.floor(msAgo / 3_600_000);
                const m = Math.floor((msAgo % 3_600_000) / 60_000);
                tickLabels.push(h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""} ago` : `${m}m ago`);
            }
        }

        return { tracks, tickLabels };
    }, [reviews, stepCache, zoom, now, sortMode]);
}

/* ─── Custom tooltip component ──────────────────────────────────── */

interface TooltipData {
    title: string;
    status: string;
    duration: string;
    x: number;
    y: number;
}

/* ─── Marker colors ─────────────────────────────────────────────── */

const MARKER_COLORS: Record<string, { bg: string; border: string }> = {
    waiting: { bg: "bg-amber-400", border: "border-amber-600" },
    running: { bg: "bg-blue-400", border: "border-blue-600" },
    failed: { bg: "bg-red-400", border: "border-red-600" }
};

/* ─── Main component ──────────────────────────────────────────────── */

export function TimelineWaterfall({
    filteredReviews,
    loading,
    stepCache,
    onApprove,
    onReject,
    onFeedback,
    onCancelRun,
    onRetryStep,
    onSkipStep
}: CommandViewProps) {
    const [zoom, setZoom] = useState<ZoomLevel>("6h");
    const [sortMode, setSortMode] = useState<SortMode>("start-time");
    const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null);
    const [tooltip, setTooltip] = useState<TooltipData | null>(null);
    const [now, setNow] = useState(() => Date.now());
    const tooltipRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 30_000);
        return () => clearInterval(interval);
    }, []);

    const { tracks, tickLabels } = useTimelineLayout(
        filteredReviews,
        stepCache,
        zoom,
        now,
        sortMode
    );

    function handleSegmentHover(e: React.MouseEvent, step: StepData) {
        const durationMs = step.durationMs || 0;
        const secs = Math.floor(durationMs / 1000);
        const duration = secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`;

        setTooltip({
            title: step.stepName || step.stepId,
            status: step.status,
            duration,
            x: e.clientX + 12,
            y: e.clientY - 10
        });
    }

    if (loading) {
        return (
            <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
            </div>
        );
    }

    if (filteredReviews.length === 0) {
        return (
            <Card>
                <CardContent className="py-16 text-center">
                    <div className="mx-auto mb-3 text-5xl opacity-30">🏁</div>
                    <p className="text-base font-semibold">No races in progress</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Workflow runs will appear as tracks when they start.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-3">
            {/* Controls bar */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-xs">
                        {tracks.length} active track{tracks.length !== 1 ? "s" : ""}
                    </span>
                    <div className="bg-border h-4 w-px" />
                    <div className="flex items-center gap-1">
                        <span className="text-muted-foreground text-[10px] font-medium">Sort:</span>
                        {(
                            [
                                { id: "start-time", label: "Time" },
                                { id: "wait-time", label: "Wait" },
                                { id: "risk", label: "Risk" }
                            ] as { id: SortMode; label: string }[]
                        ).map((s) => (
                            <button
                                key={s.id}
                                className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                                    sortMode === s.id
                                        ? "bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100"
                                        : "text-muted-foreground hover:text-gray-600 dark:hover:text-gray-300"
                                }`}
                                onClick={() => setSortMode(s.id)}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
                    {(["1h", "6h", "24h"] as ZoomLevel[]).map((z) => (
                        <button
                            key={z}
                            className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                                zoom === z
                                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                                    : "text-muted-foreground hover:text-gray-700 dark:hover:text-gray-300"
                            }`}
                            onClick={() => setZoom(z)}
                        >
                            {z}
                        </button>
                    ))}
                </div>
            </div>

            {/* Timeline chart */}
            <div className="relative rounded-lg border">
                {/* Sticky time axis header */}
                <div className="sticky top-0 z-10 flex border-b bg-gray-50/95 backdrop-blur-sm dark:bg-gray-900/95">
                    <div className="w-[200px] shrink-0 border-r px-3 py-2">
                        <span className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">
                            Run
                        </span>
                    </div>
                    <div className="relative flex flex-1">
                        {tickLabels.map((label, i) => (
                            <div
                                key={i}
                                className="flex-1 border-r border-dashed border-gray-200 px-1 py-2 text-center last:border-r-0 dark:border-gray-700"
                            >
                                <span
                                    className={`text-[9px] font-semibold tracking-wider uppercase ${
                                        label === "Now"
                                            ? "text-violet-500"
                                            : "text-muted-foreground"
                                    }`}
                                >
                                    {label}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="w-[140px] shrink-0 border-l px-3 py-2 text-center">
                        <span className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">
                            Actions
                        </span>
                    </div>
                </div>

                {/* Track rows */}
                <div>
                    {tracks.map((track) => {
                        const risk = getRiskLevel(track.review);
                        const riskDot = RISK_DOT[risk] || RISK_DOT.unknown!;
                        const isPending = track.review.status === "pending";
                        const hasFailed = track.steps.some(
                            (s) => s.status.toUpperCase() === "FAILED"
                        );
                        const isSelected = selectedReview?.id === track.review.id;

                        const issueId = track.review.reviewContext?.issueNumber
                            ? `#${track.review.reviewContext.issueNumber}`
                            : track.review.id.slice(0, 8);

                        return (
                            <div
                                key={track.review.id}
                                className={`flex min-h-[56px] cursor-pointer border-b transition-colors last:border-b-0 ${
                                    isSelected
                                        ? "bg-violet-50/30 dark:bg-violet-950/10"
                                        : "hover:bg-gray-50/50 dark:hover:bg-gray-800/20"
                                }`}
                                onClick={() => setSelectedReview(track.review)}
                            >
                                {/* Label column */}
                                <div className="flex w-[200px] shrink-0 items-center gap-1.5 border-r px-3">
                                    <div
                                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${riskDot}`}
                                    />
                                    <span className="font-mono text-xs font-bold">{issueId}</span>
                                    <span className="text-muted-foreground min-w-0 truncate text-[10px]">
                                        {track.review.workflowName || track.review.workflowSlug}
                                    </span>
                                </div>

                                {/* Track area */}
                                <div className="relative flex-1 overflow-hidden">
                                    {/* Dashed gridlines */}
                                    {tickLabels.map((_, i) => (
                                        <div
                                            key={i}
                                            className="absolute top-0 bottom-0 border-r border-dashed border-gray-200/50 dark:border-gray-700/50"
                                            style={{
                                                left: `${(i / tickLabels.length) * 100}%`
                                            }}
                                        />
                                    ))}

                                    {/* Now line */}
                                    <div
                                        className="pointer-events-none absolute top-0 bottom-0 z-10 w-[2px] bg-violet-500/60"
                                        style={{ right: 0 }}
                                    />

                                    {/* Segments */}
                                    <div className="relative h-full py-3">
                                        {track.segments.map((seg, i) => (
                                            <div
                                                key={seg.step.id || i}
                                                className={`absolute top-3 bottom-3 rounded ${seg.color} ${
                                                    seg.step.status.toUpperCase() === "RUNNING"
                                                        ? "rounded-r-none opacity-80"
                                                        : ""
                                                }`}
                                                style={{
                                                    left: `${seg.startPct}%`,
                                                    width: `${seg.widthPct}%`
                                                }}
                                                onMouseEnter={(e) =>
                                                    handleSegmentHover(e, seg.step)
                                                }
                                                onMouseLeave={() => setTooltip(null)}
                                            >
                                                {seg.widthPct > 4 && (
                                                    <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white/80">
                                                        {seg.label}
                                                    </span>
                                                )}
                                            </div>
                                        ))}

                                        {/* Markers */}
                                        {track.markers.map((marker, i) => {
                                            const mc =
                                                MARKER_COLORS[marker.type] ||
                                                MARKER_COLORS.waiting!;
                                            return (
                                                <div
                                                    key={i}
                                                    className="absolute top-1/2 z-20 -translate-y-1/2"
                                                    style={{
                                                        left: `${marker.pct}%`
                                                    }}
                                                >
                                                    <div
                                                        className={`h-2.5 w-2.5 rounded-full border-2 ${mc.bg} ${mc.border} ${
                                                            marker.type === "waiting"
                                                                ? "animate-pulse"
                                                                : ""
                                                        }`}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Actions column */}
                                <div className="flex w-[140px] shrink-0 items-center justify-center gap-1 border-l px-2">
                                    {isPending && (
                                        <>
                                            <Button
                                                size="sm"
                                                className="h-6 bg-green-600 px-2 text-[10px] text-white hover:bg-green-700"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onApprove(track.review);
                                                }}
                                            >
                                                Approve
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-6 border-red-300 px-2 text-[10px] text-red-600"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onReject(track.review);
                                                }}
                                            >
                                                Reject
                                            </Button>
                                        </>
                                    )}
                                    {hasFailed && !isPending && (
                                        <>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-6 border-amber-300 px-2 text-[10px] text-amber-600"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const failedStep = track.steps.find(
                                                        (s) => s.status.toUpperCase() === "FAILED"
                                                    );
                                                    if (failedStep)
                                                        onRetryStep(
                                                            track.review.id,
                                                            failedStep.stepId
                                                        );
                                                }}
                                            >
                                                Retry
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-6 border-cyan-300 px-2 text-[10px] text-cyan-600"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const failedStep = track.steps.find(
                                                        (s) => s.status.toUpperCase() === "FAILED"
                                                    );
                                                    if (failedStep)
                                                        onSkipStep(
                                                            track.review.id,
                                                            failedStep.stepId
                                                        );
                                                }}
                                            >
                                                Skip
                                            </Button>
                                        </>
                                    )}
                                    {!isPending &&
                                        !hasFailed &&
                                        track.review.runStatus === "RUNNING" && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-6 px-2 text-[10px]"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onCancelRun(track.review);
                                                }}
                                            >
                                                Cancel
                                            </Button>
                                        )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-4 border-t px-4 py-2">
                    {Object.entries(STEP_STATUS_COLORS).map(([status, color]) => (
                        <div key={status} className="flex items-center gap-1.5">
                            <div
                                className={`h-2 w-4 rounded-sm ${color.replace(/animate-\S+/, "")}`}
                            />
                            <span className="text-muted-foreground text-[10px] capitalize">
                                {status.toLowerCase()}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Custom tooltip */}
            {tooltip && (
                <div
                    ref={tooltipRef}
                    className="pointer-events-none fixed z-50 max-w-[220px] rounded-lg border bg-gray-900 p-2.5 shadow-xl"
                    style={{ left: tooltip.x, top: tooltip.y }}
                >
                    <div className="text-xs font-bold text-white">{tooltip.title}</div>
                    <div className="text-muted-foreground mt-0.5 font-mono text-[10px]">
                        {tooltip.status} · {tooltip.duration}
                    </div>
                </div>
            )}

            <ChipSlideout
                review={selectedReview}
                open={!!selectedReview}
                onOpenChange={(open) => {
                    if (!open) setSelectedReview(null);
                }}
                steps={selectedReview ? stepCache.get(selectedReview.id) || [] : []}
                onApprove={onApprove}
                onReject={onReject}
                onFeedback={onFeedback}
                onCancelRun={onCancelRun}
                onRetryStep={onRetryStep}
                onSkipStep={onSkipStep}
            />
        </div>
    );
}
