"use client";

import { useState } from "react";
import { Badge, Button } from "@repo/ui";
import type { StepData } from "../../types";

function formatDuration(ms?: number | null) {
    if (!ms || ms <= 0) return "--";
    if (ms < 1000) return `${Math.round(ms)}ms`;
    const s = ms / 1000;
    if (s < 60) return `${s.toFixed(1)}s`;
    const m = Math.floor(s / 60);
    return `${m}m ${Math.round(s % 60)}s`;
}

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
                const hasOutput =
                    step.outputJson !== null &&
                    step.outputJson !== undefined &&
                    (typeof step.outputJson !== "object" ||
                        Object.keys(step.outputJson as Record<string, unknown>).length > 0);

                return (
                    <div key={step.id || `${step.stepId}-${idx}`}>
                        <button
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                            onClick={() => setExpandedStep(isExpanded ? null : step.stepId)}
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
                            <span className="text-muted-foreground shrink-0 text-[10px]">
                                {formatDuration(step.durationMs)}
                            </span>
                        </button>

                        {isExpanded && (
                            <div className="ml-6 border-l border-gray-200 py-1 pl-3 dark:border-gray-700">
                                {hasOutput && typeof step.outputJson === "object" && (
                                    <pre className="max-h-40 overflow-auto rounded border bg-gray-50 p-2 text-[10px] dark:bg-gray-900">
                                        {JSON.stringify(step.outputJson, null, 2)}
                                    </pre>
                                )}
                                {hasOutput && typeof step.outputJson === "string" && (
                                    <pre className="max-h-40 overflow-auto rounded border bg-gray-50 p-2 text-[10px] whitespace-pre-wrap dark:bg-gray-900">
                                        {step.outputJson}
                                    </pre>
                                )}
                                {step.errorJson != null && (
                                    <pre className="max-h-32 overflow-auto rounded border border-red-200 bg-red-50 p-2 text-[10px] text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-300">
                                        {typeof step.errorJson === "string"
                                            ? step.errorJson
                                            : JSON.stringify(step.errorJson, null, 2)}
                                    </pre>
                                )}
                                {!hasOutput && !step.errorJson && (
                                    <div className="text-muted-foreground py-1 text-[10px] italic">
                                        No output
                                    </div>
                                )}
                                {(isFailed || isSuspended) && (onRetryStep || onSkipStep) && (
                                    <div className="mt-1.5 flex gap-1.5">
                                        {isFailed && onRetryStep && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-6 px-2 text-[10px] text-amber-600 hover:text-amber-700"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onRetryStep(step.stepId);
                                                }}
                                            >
                                                ↻ Retry
                                            </Button>
                                        )}
                                        {onSkipStep && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-6 px-2 text-[10px] text-cyan-600 hover:text-cyan-700"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSkipStep(step.stepId);
                                                }}
                                            >
                                                ⏭ Skip
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
