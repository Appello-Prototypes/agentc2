"use client";

import { useState } from "react";
import { Badge } from "@repo/ui";
import type { StepData } from "../../types";
import { StepDetailPanel, formatStepDuration } from "./StepDetailPanel";

const STATUS_ICONS: Record<string, { icon: string; color: string }> = {
    COMPLETED: { icon: "✓", color: "text-green-600 dark:text-green-400" },
    FAILED: { icon: "✗", color: "text-red-600 dark:text-red-400" },
    RUNNING: { icon: "◉", color: "text-blue-600 dark:text-blue-400" },
    SUSPENDED: { icon: "⏸", color: "text-cyan-600 dark:text-cyan-400" },
    QUEUED: { icon: "○", color: "text-gray-400 dark:text-gray-500" },
    PENDING: { icon: "○", color: "text-gray-400 dark:text-gray-500" }
};

interface StepMiniTimelineProps {
    steps: StepData[];
    suspendedStep?: string | null;
    onRetryStep?: (stepId: string) => void;
    onSkipStep?: (stepId: string, reason?: string) => void;
    compact?: boolean;
}

export function StepMiniTimeline({
    steps,
    suspendedStep,
    onRetryStep,
    onSkipStep,
    compact = false
}: StepMiniTimelineProps) {
    const [expandedStep, setExpandedStep] = useState<string | null>(null);
    const [retryingStepId, setRetryingStepId] = useState<string | null>(null);
    const [confirmRetryStepId, setConfirmRetryStepId] = useState<string | null>(null);
    const [skippingStepId, setSkippingStepId] = useState<string | null>(null);
    const [confirmSkipStepId, setConfirmSkipStepId] = useState<string | null>(null);
    const [skipReason, setSkipReason] = useState("");

    if (steps.length === 0) {
        return <div className="text-muted-foreground py-1 text-xs italic">No steps recorded</div>;
    }

    return (
        <div className="space-y-0.5">
            {steps.map((step, idx) => {
                const statusKey = step.status.toUpperCase();
                const isSuspended = suspendedStep === step.stepId;
                const effectiveStatus = isSuspended ? "SUSPENDED" : statusKey;
                const statusStyle = STATUS_ICONS[effectiveStatus] || STATUS_ICONS.PENDING!;
                const isExpanded = expandedStep === step.stepId;
                const isFailed = statusKey === "FAILED";
                const isExpandable =
                    statusKey === "COMPLETED" ||
                    isFailed ||
                    (isSuspended && statusKey !== "COMPLETED");
                const hasContent =
                    step.outputJson !== null &&
                    step.outputJson !== undefined &&
                    (typeof step.outputJson !== "object" ||
                        Object.keys(step.outputJson as Record<string, unknown>).length > 0);
                const canExpand =
                    isExpandable && (hasContent || step.errorJson != null || isSuspended);

                return (
                    <div key={step.id || `${step.stepId}-${idx}`}>
                        <button
                            className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-colors ${
                                canExpand
                                    ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                    : "cursor-default"
                            }`}
                            onClick={() => {
                                if (canExpand) setExpandedStep(isExpanded ? null : step.stepId);
                            }}
                        >
                            <div className="flex w-4 flex-col items-center">
                                <span className={`text-xs font-bold ${statusStyle.color}`}>
                                    {statusStyle.icon}
                                </span>
                                {idx < steps.length - 1 && (
                                    <div className="mt-0.5 h-3 w-px bg-gray-200 dark:bg-gray-700" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                    <span className="truncate text-xs font-medium">
                                        {step.stepName || step.stepId}
                                    </span>
                                    {!compact && (
                                        <Badge
                                            variant="outline"
                                            className="px-1 py-0 text-[10px] leading-tight"
                                        >
                                            {step.stepType}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                                <span className="text-muted-foreground text-[10px]">
                                    {formatStepDuration(step.durationMs)}
                                </span>
                                {canExpand && (
                                    <span
                                        className={`text-muted-foreground text-[10px] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                    >
                                        ▾
                                    </span>
                                )}
                            </div>
                        </button>

                        {isExpanded && canExpand && (
                            <div className="ml-6 border-l border-gray-200 py-1.5 pl-3 dark:border-gray-700">
                                <StepDetailPanel
                                    step={step}
                                    isSuspended={isSuspended}
                                    suspendedStep={suspendedStep}
                                    compact
                                    onRetryStep={onRetryStep}
                                    retryingStepId={retryingStepId}
                                    confirmRetryStepId={confirmRetryStepId}
                                    onConfirmRetry={setConfirmRetryStepId}
                                    onCancelRetry={() => setConfirmRetryStepId(null)}
                                    onExecuteRetry={async (sid) => {
                                        setRetryingStepId(sid);
                                        try {
                                            await onRetryStep?.(sid);
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
                                        } finally {
                                            setSkippingStepId(null);
                                            setConfirmSkipStepId(null);
                                            setSkipReason("");
                                        }
                                    }}
                                    skipReason={skipReason}
                                    onSkipReasonChange={setSkipReason}
                                />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
