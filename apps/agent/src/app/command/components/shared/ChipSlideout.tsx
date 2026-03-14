"use client";

import {
    Badge,
    Button,
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription
} from "@repo/ui";
import { StepMiniTimeline } from "./StepMiniTimeline";
import type { ReviewItem, StepData } from "../../types";
import { formatTimeAgo, getRiskLevel, RISK_COLORS, getDecisionPrompt } from "../../types";

interface ChipSlideoutProps {
    review: ReviewItem | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    steps: StepData[];
    onApprove?: (review: ReviewItem) => void;
    onReject?: (review: ReviewItem) => void;
    onFeedback?: (review: ReviewItem) => void;
    onCancelRun?: (review: ReviewItem) => void;
    onRetryStep?: (reviewId: string, stepId: string) => void;
    onSkipStep?: (reviewId: string, stepId: string, reason?: string) => void;
}

function extractLinksFromSteps(steps: StepData[]): { url: string; label: string }[] {
    const links: { url: string; label: string }[] = [];
    const seen = new Set<string>();
    const urlRe = /^https?:\/\//;

    for (const step of steps) {
        if (!step.outputJson || typeof step.outputJson !== "object") continue;
        const obj = step.outputJson as Record<string, unknown>;
        for (const [key, val] of Object.entries(obj)) {
            if (typeof val === "string" && urlRe.test(val) && !seen.has(val)) {
                seen.add(val);
                links.push({
                    url: val,
                    label: key
                        .replace(/([A-Z])/g, " $1")
                        .replace(/Url$/, "")
                        .replace(/^./, (c) => c.toUpperCase())
                        .trim()
                });
            }
        }
    }
    return links;
}

const RISK_DOT_COLORS: Record<string, string> = {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-amber-500",
    low: "bg-green-500",
    trivial: "bg-gray-400",
    unknown: "bg-gray-400"
};

const STATUS_BAR_COLORS: Record<string, string> = {
    COMPLETED: "bg-green-500",
    RUNNING: "bg-blue-500",
    FAILED: "bg-red-500",
    SUSPENDED: "bg-amber-500",
    QUEUED: "bg-gray-400"
};

function getProgressColor(steps: StepData[]): string {
    const hasRunning = steps.some((s) => s.status.toUpperCase() === "RUNNING");
    const hasFailed = steps.some((s) => s.status.toUpperCase() === "FAILED");
    const hasSuspended = steps.some((s) => s.status.toUpperCase() === "SUSPENDED");
    if (hasFailed) return "bg-red-500";
    if (hasSuspended) return "bg-amber-500";
    if (hasRunning) return "bg-blue-500";
    return "bg-green-500";
}

export function ChipSlideout({
    review,
    open,
    onOpenChange,
    steps,
    onApprove,
    onReject,
    onFeedback,
    onCancelRun,
    onRetryStep,
    onSkipStep
}: ChipSlideoutProps) {
    if (!review) return null;

    const risk = getRiskLevel(review);
    const riskClass = RISK_COLORS[risk] || RISK_COLORS.unknown || "";
    const riskDot = RISK_DOT_COLORS[risk] || RISK_DOT_COLORS.unknown!;
    const links = extractLinksFromSteps(steps);
    const isPending = review.status === "pending";
    const prompt = getDecisionPrompt(review);

    const completedSteps = steps.filter((s) => s.status.toUpperCase() === "COMPLETED").length;
    const totalSteps = steps.length;
    const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
    const progressColor = getProgressColor(steps);

    const currentStep = steps.find(
        (s) =>
            s.stepId === review.suspendedStep ||
            s.status.toUpperCase() === "RUNNING" ||
            s.status.toUpperCase() === "SUSPENDED"
    );

    const issueId = review.reviewContext?.issueNumber
        ? `#${review.reviewContext.issueNumber}`
        : review.id.slice(0, 8);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-[480px] sm:max-w-[480px]">
                <SheetHeader>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="shrink-0 font-mono text-[11px]">
                            {issueId}
                        </Badge>
                        <SheetTitle className="min-w-0 flex-1 truncate">
                            {review.workflowName || review.workflowSlug || "Workflow"}
                        </SheetTitle>
                        <Badge className={riskClass} variant="secondary">
                            {risk}
                        </Badge>
                    </div>
                    <SheetDescription className="truncate">{prompt}</SheetDescription>
                </SheetHeader>

                <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
                    {/* Context section */}
                    <div className="space-y-2 rounded-lg border bg-gray-50/50 p-3 dark:bg-gray-900/50">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                                <span className="text-muted-foreground">Pipeline</span>
                                <div className="font-medium">
                                    {review.workflowName || review.workflowSlug || "—"}
                                </div>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Risk</span>
                                <div className="flex items-center gap-1.5">
                                    <div className={`h-2 w-2 rounded-full ${riskDot}`} />
                                    <span className="font-medium capitalize">{risk}</span>
                                </div>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Age</span>
                                <div className="font-medium">{formatTimeAgo(review.createdAt)}</div>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Current Step</span>
                                <div className="font-medium text-fuchsia-600 dark:text-fuchsia-400">
                                    {currentStep
                                        ? `${currentStep.stepName || currentStep.stepId}${review.suspendedStep ? " (Gate)" : ""}`
                                        : "—"}
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            <Badge variant="outline" className="text-[10px]">
                                {review.status}
                            </Badge>
                            {review.runStatus && (
                                <Badge variant="outline" className="text-[10px]">
                                    {review.runStatus}
                                </Badge>
                            )}
                            {review.originChannel && (
                                <Badge variant="outline" className="text-[10px]">
                                    {review.originChannel}
                                </Badge>
                            )}
                            {review.feedbackRound > 0 && (
                                <Badge variant="outline" className="text-[10px]">
                                    Round {review.feedbackRound}
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Progress bar */}
                    {totalSteps > 0 && (
                        <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Progress</span>
                                <span className="font-mono">
                                    {completedSteps}/{totalSteps} steps ({progressPct}%)
                                </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                                <div
                                    className={`h-full rounded-full transition-all ${progressColor}`}
                                    style={{ width: `${progressPct}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Summary */}
                    {review.reviewContext?.summary && (
                        <div className="space-y-1">
                            <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                                Summary
                            </div>
                            <p className="text-sm leading-relaxed">
                                {review.reviewContext.summary}
                            </p>
                        </div>
                    )}

                    {/* Links */}
                    {links.length > 0 && (
                        <div className="space-y-1">
                            <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                                Links
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {links.map((link) => (
                                    <a
                                        key={link.url}
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 rounded-md border bg-gray-50 px-2 py-0.5 text-xs text-blue-600 transition-colors hover:bg-gray-100 dark:bg-gray-800 dark:text-blue-400 dark:hover:bg-gray-700"
                                    >
                                        🔗 {link.label}
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step timeline */}
                    {totalSteps > 0 && (
                        <div className="space-y-1">
                            <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                                Workflow Steps ({totalSteps})
                            </div>
                            <StepMiniTimeline
                                steps={steps}
                                suspendedStep={review.suspendedStep}
                                onRetryStep={
                                    onRetryStep
                                        ? (stepId) => onRetryStep(review.id, stepId)
                                        : undefined
                                }
                                onSkipStep={
                                    onSkipStep
                                        ? (stepId, reason) => onSkipStep(review.id, stepId, reason)
                                        : undefined
                                }
                            />
                        </div>
                    )}

                    {/* Files changed */}
                    {review.reviewContext?.filesChanged &&
                        review.reviewContext.filesChanged.length > 0 && (
                            <div className="space-y-1">
                                <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                                    Files Changed ({review.reviewContext.filesChanged.length})
                                </div>
                                <div className="max-h-32 overflow-y-auto rounded border bg-gray-50 p-2 dark:bg-gray-900">
                                    {review.reviewContext.filesChanged.map((f) => (
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
                </div>

                {/* Actions footer */}
                <div className="border-t p-4">
                    <div className="flex gap-2">
                        {isPending && onApprove && (
                            <Button
                                size="sm"
                                className="flex-1 bg-green-600 text-white hover:bg-green-700"
                                onClick={() => onApprove(review)}
                            >
                                Approve
                            </Button>
                        )}
                        {isPending && onReject && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
                                onClick={() => onReject(review)}
                            >
                                Reject
                            </Button>
                        )}
                        {isPending && onFeedback && (
                            <Button size="sm" variant="outline" onClick={() => onFeedback(review)}>
                                Feedback
                            </Button>
                        )}
                        {!isPending && onCancelRun && (
                            <Button size="sm" variant="outline" onClick={() => onCancelRun(review)}>
                                Cancel Run
                            </Button>
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
