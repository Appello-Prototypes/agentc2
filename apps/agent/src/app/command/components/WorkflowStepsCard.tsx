"use client";

import { useCallback, useState } from "react";
import { Button, Skeleton, Stepper, StepItem, type StepStatus } from "@repo/ui";
import { getApiBase } from "@/lib/utils";
import { StepDetailPanel, formatStepDuration } from "./shared/StepDetailPanel";
import type { StepData } from "../types";

function mapStepStatus(step: StepData, suspendedStep?: string | null): StepStatus {
    const status = step.status.toUpperCase();
    if (status === "COMPLETED") return "completed";
    if (status === "FAILED") return "failed";
    if (suspendedStep === step.stepId) return "suspended";
    if (status === "RUNNING") return "active";
    return "pending";
}

/* ---------- Stepper deduplication ---------- */

function deduplicateSteps(steps: StepData[]): StepData[] {
    const map = new Map<string, StepData>();
    const iterCounts = new Map<string, number>();
    for (const s of steps) {
        map.set(s.stepId, s);
        iterCounts.set(s.stepId, (iterCounts.get(s.stepId) || 0) + 1);
    }
    return Array.from(map.values()).map((s) => ({
        ...s,
        _iterCount: iterCounts.get(s.stepId) || 1
    }));
}

interface DeduplicatedStep extends StepData {
    _iterCount?: number;
}

/* ---------- Main component ---------- */

export interface WorkflowStepsCardProps {
    reviewId: string;
    onCancelRun?: () => void;
    cancellingRun?: boolean;
    runCancelled?: boolean;
    onRetryStep?: (stepId: string) => void;
    onSkipStep?: (stepId: string, reason?: string) => void;
}

export function WorkflowStepsCard({
    reviewId,
    onCancelRun,
    cancellingRun,
    runCancelled,
    onRetryStep,
    onSkipStep
}: WorkflowStepsCardProps) {
    const [steps, setSteps] = useState<StepData[]>([]);
    const [suspendedStep, setSuspendedStep] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fetched, setFetched] = useState(false);
    const [confirmingCancel, setConfirmingCancel] = useState(false);
    const [retryingStepId, setRetryingStepId] = useState<string | null>(null);
    const [confirmRetryStepId, setConfirmRetryStepId] = useState<string | null>(null);
    const [skippingStepId, setSkippingStepId] = useState<string | null>(null);
    const [confirmSkipStepId, setConfirmSkipStepId] = useState<string | null>(null);
    const [skipReason, setSkipReason] = useState("");

    const fetchSteps = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${getApiBase()}/api/reviews/${reviewId}/steps`);
            const data = await res.json();
            if (data.success) {
                setSteps(data.steps || []);
                setSuspendedStep(data.suspendedStep ?? null);
            } else {
                setError(data.error || "Failed to load steps");
            }
        } catch {
            setError("Network error");
        } finally {
            setLoading(false);
            setFetched(true);
        }
    }, [reviewId]);

    if (!fetched && !loading) {
        return (
            <div className="pt-2">
                <Button size="sm" variant="outline" onClick={fetchSteps}>
                    View workflow steps
                </Button>
            </div>
        );
    }

    if (loading) {
        return <Skeleton className="h-32 w-full rounded-lg" />;
    }

    if (error) {
        return <div className="text-muted-foreground text-xs">{error}</div>;
    }

    if (steps.length === 0) {
        return <div className="text-muted-foreground text-xs">No workflow steps recorded</div>;
    }

    const dedupSteps: DeduplicatedStep[] = deduplicateSteps(steps);

    return (
        <div className="space-y-3 pt-2">
            {/* Cancelled banner */}
            {runCancelled && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-800 dark:bg-red-950/30">
                    <span className="text-sm">✕</span>
                    <span className="text-sm font-medium text-red-700 dark:text-red-300">
                        Workflow run cancelled
                    </span>
                </div>
            )}

            {/* Header with cancel button */}
            <div className="flex items-center justify-between">
                <div className="text-muted-foreground text-xs font-medium">
                    Workflow Steps ({steps.length})
                </div>
                {onCancelRun && !runCancelled && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 border-red-200 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                        onClick={() => setConfirmingCancel(true)}
                        disabled={cancellingRun || confirmingCancel}
                    >
                        {cancellingRun ? (
                            <>
                                <span className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                Cancelling…
                            </>
                        ) : (
                            <>✕ Cancel Run</>
                        )}
                    </Button>
                )}
            </div>

            {/* Inline cancel confirmation */}
            {confirmingCancel && !runCancelled && (
                <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
                    <div className="flex items-start gap-2">
                        <span className="mt-0.5 text-sm">⚠️</span>
                        <div>
                            <span className="text-sm font-medium">Cancel this workflow run?</span>
                            <p className="text-muted-foreground mt-0.5 text-xs">
                                The run will be marked as CANCELLED. The linked review will be
                                rejected. This cannot be undone.
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2 self-end">
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => setConfirmingCancel(false)}
                        >
                            Keep Running
                        </Button>
                        <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs"
                            onClick={() => {
                                setConfirmingCancel(false);
                                onCancelRun?.();
                            }}
                            disabled={cancellingRun}
                        >
                            {cancellingRun ? "Cancelling…" : "Yes, Cancel Run"}
                        </Button>
                    </div>
                </div>
            )}

            <Stepper orientation="vertical">
                {dedupSteps.map((step, idx) => {
                    const iterCount = step._iterCount || 1;
                    const isSuspended = suspendedStep === step.stepId;
                    const stepStatus =
                        runCancelled && isSuspended
                            ? ("failed" as StepStatus)
                            : mapStepStatus(step, suspendedStep);
                    const isExpandable =
                        stepStatus === "completed" ||
                        stepStatus === "failed" ||
                        (stepStatus === "suspended" && !runCancelled);
                    return (
                        <StepItem
                            key={step.id}
                            status={stepStatus}
                            stepNumber={idx + 1}
                            label={step.stepName || step.stepId}
                            description={`${step.stepType} · ${formatStepDuration(step.durationMs)}`}
                            iterationBadge={iterCount > 1 ? `${iterCount}x` : undefined}
                            isLast={idx === dedupSteps.length - 1}
                            expandable={isExpandable}
                        >
                            {isExpandable && (
                                <StepDetailPanel
                                    step={step}
                                    isSuspended={isSuspended && !runCancelled}
                                    suspendedStep={suspendedStep}
                                    onRetryStep={onRetryStep}
                                    retryingStepId={retryingStepId}
                                    confirmRetryStepId={confirmRetryStepId}
                                    onConfirmRetry={setConfirmRetryStepId}
                                    onCancelRetry={() => setConfirmRetryStepId(null)}
                                    onExecuteRetry={async (sid) => {
                                        setRetryingStepId(sid);
                                        try {
                                            await onRetryStep?.(sid);
                                            await fetchSteps();
                                        } finally {
                                            setRetryingStepId(null);
                                            setConfirmRetryStepId(null);
                                        }
                                    }}
                                    onSkipStep={onSkipStep}
                                    skippingStepId={skippingStepId}
                                    confirmSkipStepId={confirmSkipStepId}
                                    onConfirmSkip={setConfirmSkipStepId}
                                    onCancelSkip={() => {
                                        setConfirmSkipStepId(null);
                                        setSkipReason("");
                                    }}
                                    onExecuteSkip={async (sid, reason) => {
                                        setSkippingStepId(sid);
                                        try {
                                            await onSkipStep?.(sid, reason);
                                            await fetchSteps();
                                        } finally {
                                            setSkippingStepId(null);
                                            setConfirmSkipStepId(null);
                                            setSkipReason("");
                                        }
                                    }}
                                    skipReason={skipReason}
                                    onSkipReasonChange={setSkipReason}
                                />
                            )}
                        </StepItem>
                    );
                })}
            </Stepper>
        </div>
    );
}
