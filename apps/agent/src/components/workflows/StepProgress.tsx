"use client";

import { cn } from "@repo/ui";

interface StepInfo {
    id: string;
    label: string;
    status: "pending" | "running" | "completed" | "error" | "suspended";
    timing?: number; // milliseconds
    description?: string;
}

interface StepProgressProps {
    steps: StepInfo[];
    className?: string;
}

/**
 * StepProgress - Shows per-step execution status with timing
 */
export function StepProgress({ steps, className }: StepProgressProps) {
    const formatTiming = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    const getStatusIcon = (status: StepInfo["status"]) => {
        switch (status) {
            case "completed":
                return (
                    <svg
                        className="h-4 w-4 text-green-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                        />
                    </svg>
                );
            case "running":
                return (
                    <svg
                        className="h-4 w-4 animate-spin text-blue-500"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                    </svg>
                );
            case "error":
                return (
                    <svg
                        className="h-4 w-4 text-red-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                );
            case "suspended":
                return (
                    <svg
                        className="h-4 w-4 text-amber-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                );
            default:
                return <div className="border-muted-foreground/30 h-4 w-4 rounded-full border-2" />;
        }
    };

    const getStatusText = (status: StepInfo["status"]) => {
        switch (status) {
            case "completed":
                return "Completed";
            case "running":
                return "Running...";
            case "error":
                return "Error";
            case "suspended":
                return "Suspended";
            default:
                return "Pending";
        }
    };

    const totalTime = steps.reduce((sum, step) => sum + (step.timing || 0), 0);

    return (
        <div className={cn("bg-card rounded-lg border p-4", className)}>
            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-medium">Step Execution</h3>
                {totalTime > 0 && (
                    <span className="text-muted-foreground text-xs">
                        Total: {formatTiming(totalTime)}
                    </span>
                )}
            </div>

            <div className="space-y-3">
                {steps.map((step, index) => (
                    <div key={step.id} className="flex items-start gap-3">
                        {/* Status icon with connector line */}
                        <div className="flex flex-col items-center">
                            {getStatusIcon(step.status)}
                            {index < steps.length - 1 && (
                                <div
                                    className={cn(
                                        "mt-1 h-6 w-px",
                                        step.status === "completed"
                                            ? "bg-green-500/50"
                                            : "bg-border"
                                    )}
                                />
                            )}
                        </div>

                        {/* Step details */}
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                                <span
                                    className={cn(
                                        "text-sm font-medium",
                                        step.status === "running" && "text-blue-500",
                                        step.status === "completed" && "text-foreground",
                                        step.status === "error" && "text-red-500",
                                        step.status === "suspended" && "text-amber-500",
                                        step.status === "pending" && "text-muted-foreground"
                                    )}
                                >
                                    {step.label}
                                </span>
                                <div className="flex items-center gap-2">
                                    {step.timing && step.status === "completed" && (
                                        <span className="text-muted-foreground text-xs">
                                            {formatTiming(step.timing)}
                                        </span>
                                    )}
                                    <span
                                        className={cn(
                                            "text-xs",
                                            step.status === "completed" && "text-green-500",
                                            step.status === "running" && "text-blue-500",
                                            step.status === "error" && "text-red-500",
                                            step.status === "suspended" && "text-amber-500",
                                            step.status === "pending" && "text-muted-foreground"
                                        )}
                                    >
                                        {getStatusText(step.status)}
                                    </span>
                                </div>
                            </div>
                            {step.description && (
                                <p className="text-muted-foreground mt-0.5 truncate text-xs">
                                    {step.description}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * TimingComparison - Shows parallel vs sequential timing comparison
 */
interface TimingComparisonProps {
    parallelTime: number;
    sequentialTime: number;
    className?: string;
}

export function TimingComparison({
    parallelTime,
    sequentialTime,
    className
}: TimingComparisonProps) {
    const formatTime = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    const savings = sequentialTime - parallelTime;
    const savingsPercent = Math.round((savings / sequentialTime) * 100);

    return (
        <div className={cn("bg-card rounded-lg border p-4", className)}>
            <h3 className="mb-3 text-sm font-medium">Timing Comparison</h3>

            <div className="space-y-3">
                {/* Parallel timing bar */}
                <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-green-600 dark:text-green-400">
                            Parallel
                        </span>
                        <span>{formatTime(parallelTime)}</span>
                    </div>
                    <div className="bg-muted h-2 overflow-hidden rounded-full">
                        <div
                            className="h-full rounded-full bg-green-500 transition-all"
                            style={{ width: `${(parallelTime / sequentialTime) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Sequential timing bar */}
                <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Sequential</span>
                        <span className="text-muted-foreground">{formatTime(sequentialTime)}</span>
                    </div>
                    <div className="bg-muted h-2 overflow-hidden rounded-full">
                        <div
                            className="bg-muted-foreground/50 h-full rounded-full"
                            style={{ width: "100%" }}
                        />
                    </div>
                </div>
            </div>

            {/* Savings callout */}
            <div className="mt-4 rounded-md bg-green-50 p-2 text-center dark:bg-green-950">
                <span className="text-sm text-green-700 dark:text-green-300">
                    Saved {formatTime(savings)} ({savingsPercent}% faster)
                </span>
            </div>
        </div>
    );
}
