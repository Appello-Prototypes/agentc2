"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, CardContent, Skeleton } from "@repo/ui";
import { ChipSlideout } from "../shared/ChipSlideout";
import type { CommandViewProps, ReviewItem, StepData } from "../../types";
import { getRiskLevel, RISK_COLORS } from "../../types";

type ZoomLevel = "1h" | "6h" | "24h";

const ZOOM_MS: Record<ZoomLevel, number> = {
    "1h": 3_600_000,
    "6h": 21_600_000,
    "24h": 86_400_000
};

const STEP_STATUS_COLORS: Record<string, string> = {
    COMPLETED: "bg-green-400 dark:bg-green-600",
    FAILED: "bg-red-400 dark:bg-red-600",
    RUNNING: "bg-blue-400 dark:bg-blue-500 animate-pulse",
    SUSPENDED: "bg-amber-400 dark:bg-amber-500",
    QUEUED: "bg-gray-300 dark:bg-gray-600",
    PENDING: "bg-gray-300 dark:bg-gray-600"
};

interface TimelineTrack {
    review: ReviewItem;
    steps: StepData[];
    segments: {
        step: StepData;
        startPct: number;
        widthPct: number;
        color: string;
    }[];
}

function useTimelineLayout(
    reviews: ReviewItem[],
    stepCache: Map<string, StepData[]>,
    zoom: ZoomLevel,
    now: number
): { tracks: TimelineTrack[]; timeRange: { start: number; end: number }; tickLabels: string[] } {
    return useMemo(() => {
        const windowMs = ZOOM_MS[zoom];
        const rangeStart = now - windowMs;
        const rangeEnd = now;

        const tracks: TimelineTrack[] = reviews
            .map((review) => {
                const steps = stepCache.get(review.id) || [];
                const segments = steps
                    .filter((s) => s.startedAt)
                    .map((step) => {
                        const start = new Date(step.startedAt!).getTime();
                        const end = step.completedAt ? new Date(step.completedAt).getTime() : now;
                        const duration = Math.max(end - start, windowMs * 0.01);
                        const startPct = Math.max(0, ((start - rangeStart) / windowMs) * 100);
                        const widthPct = Math.min(
                            100 - startPct,
                            Math.max(1, (duration / windowMs) * 100)
                        );
                        const statusKey = step.status.toUpperCase();
                        return {
                            step,
                            startPct,
                            widthPct,
                            color: STEP_STATUS_COLORS[statusKey] || STEP_STATUS_COLORS.PENDING!
                        };
                    });

                return { review, steps, segments };
            })
            .filter((t) => t.segments.length > 0)
            .sort(
                (a, b) =>
                    new Date(a.review.createdAt).getTime() - new Date(b.review.createdAt).getTime()
            );

        const tickCount = 6;
        const tickLabels: string[] = [];
        for (let i = 0; i <= tickCount; i++) {
            const t = rangeStart + (windowMs * i) / tickCount;
            const d = new Date(t);
            tickLabels.push(d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        }

        return { tracks, timeRange: { start: rangeStart, end: rangeEnd }, tickLabels };
    }, [reviews, stepCache, zoom, now]);
}

export function TimelineWaterfall({
    filteredReviews,
    loading,
    stepCache,
    onApprove,
    onReject,
    onCancelRun,
    onRetryStep,
    onSkipStep
}: CommandViewProps) {
    const [zoom, setZoom] = useState<ZoomLevel>("6h");
    const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null);
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 30_000);
        return () => clearInterval(interval);
    }, []);
    const { tracks, tickLabels } = useTimelineLayout(filteredReviews, stepCache, zoom, now);

    if (loading) {
        return (
            <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
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
        <div className="space-y-4">
            {/* Zoom controls */}
            <div className="flex items-center justify-between">
                <div className="text-muted-foreground text-xs">
                    Showing {tracks.length} active tracks
                </div>
                <div className="flex items-center gap-1 rounded-lg border p-0.5">
                    {(["1h", "6h", "24h"] as ZoomLevel[]).map((z) => (
                        <Button
                            key={z}
                            variant={zoom === z ? "default" : "ghost"}
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => setZoom(z)}
                        >
                            {z}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Time axis */}
            <div className="relative">
                <div className="flex justify-between border-b pb-1">
                    {tickLabels.map((label, i) => (
                        <span key={i} className="text-muted-foreground text-[10px]">
                            {label}
                        </span>
                    ))}
                </div>

                {/* Now line */}
                <div
                    className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-red-500"
                    style={{ right: 0 }}
                >
                    <div className="absolute -top-4 -right-2 rounded bg-red-500 px-1 text-[9px] font-bold text-white">
                        Now
                    </div>
                </div>

                {/* Tracks */}
                <div className="mt-2 space-y-1">
                    {tracks.map((track) => {
                        const risk = getRiskLevel(track.review);
                        const riskClass = RISK_COLORS[risk] || "";
                        const isPending = track.review.status === "pending";

                        return (
                            <div
                                key={track.review.id}
                                className="group flex items-center gap-2 rounded-md py-1 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                            >
                                {/* Label */}
                                <div className="flex w-48 shrink-0 items-center gap-1.5 truncate">
                                    <Badge
                                        className={`${riskClass} shrink-0 px-1 py-0 text-[9px]`}
                                        variant="secondary"
                                    >
                                        {risk}
                                    </Badge>
                                    <button
                                        className="min-w-0 truncate text-left text-xs font-medium hover:underline"
                                        onClick={() => setSelectedReview(track.review)}
                                    >
                                        {track.review.workflowName ||
                                            track.review.workflowSlug ||
                                            track.review.id.slice(0, 8)}
                                    </button>
                                </div>

                                {/* Track bar */}
                                <div className="relative h-5 flex-1 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                                    {track.segments.map((seg, i) => (
                                        <div
                                            key={seg.step.id || i}
                                            className={`absolute top-0.5 bottom-0.5 rounded-sm ${seg.color}`}
                                            style={{
                                                left: `${seg.startPct}%`,
                                                width: `${seg.widthPct}%`
                                            }}
                                            title={`${seg.step.stepName || seg.step.stepId} (${seg.step.status})`}
                                        />
                                    ))}

                                    {/* Suspended marker */}
                                    {track.review.suspendedStep && (
                                        <div
                                            className="absolute top-0 bottom-0 flex items-center"
                                            style={{ right: "2%" }}
                                        >
                                            <div className="h-3 w-3 animate-pulse rounded-full border-2 border-amber-500 bg-amber-300" />
                                        </div>
                                    )}
                                </div>

                                {/* Inline actions */}
                                {isPending && (
                                    <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                        <Button
                                            size="sm"
                                            className="h-5 px-1.5 text-[9px]"
                                            onClick={() => onApprove(track.review)}
                                        >
                                            ✓
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-5 px-1.5 text-[9px]"
                                            onClick={() => onReject(track.review)}
                                        >
                                            ✗
                                        </Button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="mt-3 flex flex-wrap gap-3 border-t pt-2">
                    {Object.entries(STEP_STATUS_COLORS).map(([status, color]) => (
                        <div key={status} className="flex items-center gap-1">
                            <div
                                className={`h-2 w-4 rounded-sm ${color.replace("animate-pulse", "")}`}
                            />
                            <span className="text-muted-foreground text-[10px]">{status}</span>
                        </div>
                    ))}
                </div>
            </div>

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
        </div>
    );
}
