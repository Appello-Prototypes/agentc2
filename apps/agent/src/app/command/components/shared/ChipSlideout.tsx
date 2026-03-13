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

export function ChipSlideout({
    review,
    open,
    onOpenChange,
    steps,
    onApprove,
    onReject,
    onCancelRun,
    onRetryStep,
    onSkipStep
}: ChipSlideoutProps) {
    if (!review) return null;

    const risk = getRiskLevel(review);
    const riskClass = RISK_COLORS[risk] || RISK_COLORS.unknown || "";
    const links = extractLinksFromSteps(steps);
    const isPending = review.status === "pending";
    const prompt = getDecisionPrompt(review);

    const completedSteps = steps.filter((s) => s.status.toUpperCase() === "COMPLETED").length;
    const totalSteps = steps.length;
    const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-[480px] sm:max-w-[480px]">
                <SheetHeader>
                    <div className="flex items-center gap-2">
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
                    {/* Status & metadata */}
                    <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">{review.status}</Badge>
                            {review.runStatus && (
                                <Badge variant="outline">{review.runStatus}</Badge>
                            )}
                            {review.originChannel && (
                                <Badge variant="outline">{review.originChannel}</Badge>
                            )}
                        </div>
                        <div className="text-muted-foreground flex items-center gap-3 text-xs">
                            <span>{formatTimeAgo(review.createdAt)}</span>
                            {review.feedbackRound > 0 && <span>Round {review.feedbackRound}</span>}
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
                                    className="h-full rounded-full bg-green-500 transition-all"
                                    style={{ width: `${progressPct}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Summary */}
                    {review.reviewContext?.summary && (
                        <div className="space-y-1">
                            <div className="text-muted-foreground text-xs font-medium">Summary</div>
                            <p className="text-sm leading-relaxed">
                                {review.reviewContext.summary}
                            </p>
                        </div>
                    )}

                    {/* Links */}
                    {links.length > 0 && (
                        <div className="space-y-1">
                            <div className="text-muted-foreground text-xs font-medium">Links</div>
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
                            <div className="text-muted-foreground text-xs font-medium">Steps</div>
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
                                <div className="text-muted-foreground text-xs font-medium">
                                    Files Changed ({review.reviewContext.filesChanged.length})
                                </div>
                                <div className="max-h-32 overflow-y-auto">
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
                {isPending && (
                    <div className="border-t p-4">
                        <div className="flex gap-2">
                            {onApprove && (
                                <Button
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => onApprove(review)}
                                >
                                    Approve
                                </Button>
                            )}
                            {onReject && (
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    className="flex-1"
                                    onClick={() => onReject(review)}
                                >
                                    Reject
                                </Button>
                            )}
                            {onCancelRun && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onCancelRun(review)}
                                >
                                    Cancel Run
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
