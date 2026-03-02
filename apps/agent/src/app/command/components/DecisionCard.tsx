"use client";

import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    Checkbox,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from "@repo/ui";
import { getSeverity, getSeverityStyles } from "@repo/ui/lib/severity";
import {
    type ReviewItem,
    RISK_COLORS,
    RISK_BORDER_COLORS,
    SOURCE_TYPE_STYLES,
    formatTimeAgo,
    getUrgencyClass,
    getRiskLevel,
    getDecisionPrompt
} from "../types";
import { FeedbackForm } from "./FeedbackForm";
import { CodeDiffCard } from "./CodeDiffCard";

export interface DecisionCardProps {
    review: ReviewItem;
    index: number;
    isFocused: boolean;
    isSelected: boolean;
    isExpanded: boolean;
    isConfirmingReject: boolean;
    isFeedbackMode: boolean;
    isActing: boolean;
    isNew: boolean;
    feedbackText: string;
    onToggleSelect: (id: string) => void;
    onToggleExpand: (id: string) => void;
    onApprove: (review: ReviewItem) => void;
    onReject: (review: ReviewItem) => void;
    onConfirmReject: (id: string) => void;
    onCancelReject: () => void;
    onOpenFeedback: (id: string) => void;
    onCancelFeedback: () => void;
    onFeedback: (review: ReviewItem) => void;
    onFeedbackTextChange: (text: string) => void;
    onOpenConditional: (review: ReviewItem) => void;
    feedbackInputRef: React.RefObject<HTMLTextAreaElement | null>;
    cardRef: (el: HTMLDivElement | null) => void;
}

function StepTimeline({ step }: { step: string }) {
    return (
        <div className="flex items-center gap-1.5 text-xs">
            <div className="flex items-center gap-0.5">
                <div className="h-1.5 w-4 rounded-full bg-green-500/60" />
                <div className="h-1.5 w-4 animate-pulse rounded-full bg-amber-500" />
                <div className="bg-muted h-1.5 w-4 rounded-full" />
            </div>
            <span className="text-muted-foreground">
                Awaiting: <code className="bg-muted rounded px-1">{step}</code>
            </span>
        </div>
    );
}

export function DecisionCard({
    review,
    isFocused,
    isSelected,
    isExpanded,
    isConfirmingReject,
    isFeedbackMode,
    isActing,
    isNew,
    feedbackText,
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
    feedbackInputRef,
    cardRef
}: DecisionCardProps) {
    const isPending = review.status === "pending" || review.status === "conditional";
    const isConditional = review.status === "conditional";
    const risk = getRiskLevel(review);
    const prompt = getDecisionPrompt(review);
    const severity = getSeverity(risk);
    const severityStyles = getSeverityStyles(severity);
    const borderColor = RISK_BORDER_COLORS[risk] || "border-l-zinc-400";
    const sourceType = review.sourceType || "workflow";
    const sourceStyle = SOURCE_TYPE_STYLES[sourceType] || SOURCE_TYPE_STYLES.workflow;

    return (
        <div
            ref={cardRef}
            className={[
                "transition-all duration-150",
                isFocused ? "ring-primary rounded-xl ring-2" : "rounded-xl",
                isNew ? "animate-pulse" : ""
            ].join(" ")}
        >
            <Card
                className={["border-l-2", borderColor, isSelected ? "border-primary" : ""].join(
                    " "
                )}
            >
                <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                            {isPending && (
                                <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                                    <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => onToggleSelect(review.id)}
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
                                    <Badge className={sourceStyle} variant="secondary">
                                        {sourceType}
                                    </Badge>
                                    <span className="text-muted-foreground text-sm">
                                        {review.workflowName || review.workflowSlug || "workflow"}
                                    </span>
                                    {review.feedbackRound > 1 && (
                                        <Badge variant="outline" className="text-xs">
                                            round {review.feedbackRound}
                                        </Badge>
                                    )}
                                </div>
                                <p className="mt-1.5 text-base font-medium">{prompt}</p>

                                {/* Structured metadata row (C.1) */}
                                <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-3 text-xs">
                                    <span
                                        className={`flex items-center gap-1 ${severityStyles.text}`}
                                    >
                                        <span
                                            className={`inline-block h-1.5 w-1.5 rounded-full ${severityStyles.dot}`}
                                        />
                                        {risk} risk
                                    </span>
                                    {review.reviewContext?.filesChanged &&
                                        review.reviewContext.filesChanged.length > 0 && (
                                            <span>
                                                {review.reviewContext.filesChanged.length} files
                                                changed
                                            </span>
                                        )}
                                    {review.suspendedStep && (
                                        <StepTimeline step={review.suspendedStep} />
                                    )}
                                    {review.workflowSlug && (
                                        <span>
                                            via{" "}
                                            <code className="bg-muted rounded px-1">
                                                {review.workflowSlug}
                                            </code>
                                        </span>
                                    )}
                                </div>
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
                            {isConditional && (
                                <Badge
                                    variant="secondary"
                                    className="animate-pulse border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                                >
                                    Awaiting conditions
                                </Badge>
                            )}
                            {!isPending && !isConditional && (
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
                    <Collapsible open={isExpanded} onOpenChange={() => onToggleExpand(review.id)}>
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

                                {/* Code diff (C.2) */}
                                <CodeDiffCard reviewId={review.id} />
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
                                <Button size="sm" variant="outline" onClick={onCancelReject}>
                                    Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => onReject(review)}
                                    disabled={isActing}
                                >
                                    {isActing ? "Rejecting…" : "Yes, reject"}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Inline feedback form (C.2 — with category chips) */}
                    {isFeedbackMode && (
                        <FeedbackForm
                            feedbackText={feedbackText}
                            onFeedbackTextChange={onFeedbackTextChange}
                            onSubmit={() => onFeedback(review)}
                            onCancel={onCancelFeedback}
                            isActing={isActing}
                            feedbackInputRef={feedbackInputRef}
                        />
                    )}

                    {/* Action buttons */}
                    {isPending && !isConfirmingReject && !isFeedbackMode && !isConditional && (
                        <div className="flex gap-2">
                            <Button size="sm" onClick={() => onApprove(review)} disabled={isActing}>
                                {isActing ? "Approving…" : "Approve"}
                            </Button>
                            <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => onConfirmReject(review.id)}
                                disabled={isActing}
                            >
                                Reject
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onOpenFeedback(review.id)}
                                disabled={isActing}
                            >
                                Feedback
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onOpenConditional(review)}
                                disabled={isActing}
                            >
                                Conditional
                            </Button>
                        </div>
                    )}
                    {isConditional && !isConfirmingReject && !isFeedbackMode && (
                        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
                            <div className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                            <span className="text-sm">
                                Checking conditions... Auto-approves when CI passes.
                            </span>
                            <Button
                                size="sm"
                                variant="outline"
                                className="ml-auto"
                                onClick={() => onApprove(review)}
                                disabled={isActing}
                            >
                                Force Approve
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
