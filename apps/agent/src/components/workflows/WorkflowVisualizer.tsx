"use client";

import { cn } from "@repo/ui";

interface WorkflowStep {
    id: string;
    label: string;
    status: "pending" | "running" | "completed" | "error" | "suspended";
}

interface WorkflowVisualizerProps {
    type: "parallel" | "branch" | "foreach" | "approval";
    steps: WorkflowStep[];
    currentBranch?: string;
    className?: string;
}

/**
 * WorkflowVisualizer - Visual flow diagram showing workflow execution
 *
 * Displays different workflow patterns with highlighted current/completed steps
 */
export function WorkflowVisualizer({
    type,
    steps,
    currentBranch,
    className
}: WorkflowVisualizerProps) {
    const getStepColor = (status: WorkflowStep["status"]) => {
        switch (status) {
            case "completed":
                return "bg-green-500 text-white border-green-600";
            case "running":
                return "bg-blue-500 text-white border-blue-600 animate-pulse";
            case "error":
                return "bg-red-500 text-white border-red-600";
            case "suspended":
                return "bg-amber-500 text-white border-amber-600";
            default:
                return "bg-muted text-muted-foreground border-border";
        }
    };

    const getStepById = (id: string) => steps.find((s) => s.id === id);

    const renderParallelFlow = () => {
        const inputStep = getStepById("input") || {
            id: "input",
            label: "Input",
            status: "pending" as const
        };
        const sentimentStep = getStepById("sentiment") || {
            id: "sentiment",
            label: "Sentiment",
            status: "pending" as const
        };
        const priorityStep = getStepById("priority") || {
            id: "priority",
            label: "Priority",
            status: "pending" as const
        };
        const suggestionsStep = getStepById("suggestions") || {
            id: "suggestions",
            label: "Suggestions",
            status: "pending" as const
        };
        const combineStep = getStepById("combine") || {
            id: "combine",
            label: "Combine",
            status: "pending" as const
        };

        return (
            <div className="flex flex-col items-center gap-2">
                {/* Input */}
                <div
                    className={cn(
                        "rounded-md border px-4 py-2 text-sm font-medium",
                        getStepColor(inputStep.status)
                    )}
                >
                    {inputStep.label}
                </div>

                {/* Arrow down */}
                <div className="bg-border h-4 w-px" />

                {/* Parallel branches */}
                <div className="flex items-start gap-8">
                    {[sentimentStep, priorityStep, suggestionsStep].map((step) => (
                        <div key={step.id} className="flex flex-col items-center">
                            <div className="bg-border h-4 w-px" />
                            <div
                                className={cn(
                                    "rounded-md border px-3 py-1.5 text-xs font-medium",
                                    getStepColor(step.status)
                                )}
                            >
                                {step.label}
                            </div>
                            <div className="bg-border h-4 w-px" />
                        </div>
                    ))}
                </div>

                {/* Horizontal connector */}
                <div className="flex items-center">
                    <div className="bg-border h-px w-16" />
                    <div className="bg-border h-4 w-px" />
                    <div className="bg-border h-px w-16" />
                </div>

                {/* Combine */}
                <div
                    className={cn(
                        "rounded-md border px-4 py-2 text-sm font-medium",
                        getStepColor(combineStep.status)
                    )}
                >
                    {combineStep.label}
                </div>
            </div>
        );
    };

    const renderBranchFlow = () => {
        const classifyStep = getStepById("classify") || {
            id: "classify",
            label: "Classify",
            status: "pending" as const
        };
        const refundStep = getStepById("handle-refund") || {
            id: "handle-refund",
            label: "Billing",
            status: "pending" as const
        };
        const technicalStep = getStepById("handle-technical") || {
            id: "handle-technical",
            label: "Support",
            status: "pending" as const
        };
        const featureStep = getStepById("handle-feature") || {
            id: "handle-feature",
            label: "Product",
            status: "pending" as const
        };
        const generalStep = getStepById("handle-general") || {
            id: "handle-general",
            label: "Help Desk",
            status: "pending" as const
        };
        const finalizeStep = getStepById("finalize") || {
            id: "finalize",
            label: "Finalize",
            status: "pending" as const
        };

        const branches = [
            { step: refundStep, branch: "refund" },
            { step: technicalStep, branch: "technical" },
            { step: featureStep, branch: "feature" },
            { step: generalStep, branch: "general" }
        ];

        return (
            <div className="flex flex-col items-center gap-2">
                {/* Classify */}
                <div
                    className={cn(
                        "rounded-md border px-4 py-2 text-sm font-medium",
                        getStepColor(classifyStep.status)
                    )}
                >
                    {classifyStep.label}
                </div>

                <div className="bg-border h-4 w-px" />

                {/* Decision diamond */}
                <div className="border-border bg-muted rotate-45 rounded border p-2">
                    <span className="block -rotate-45 text-xs">Type?</span>
                </div>

                <div className="bg-border h-4 w-px" />

                {/* Branch handlers */}
                <div className="flex items-start gap-4">
                    {branches.map(({ step, branch }) => {
                        const isActive = currentBranch === branch;
                        const isInactive = currentBranch && currentBranch !== branch;

                        return (
                            <div
                                key={step.id}
                                className={cn(
                                    "flex flex-col items-center",
                                    isInactive && "opacity-30"
                                )}
                            >
                                <div className="bg-border h-4 w-px" />
                                <div
                                    className={cn(
                                        "rounded-md border px-2 py-1 text-xs font-medium",
                                        isActive
                                            ? getStepColor(step.status)
                                            : "bg-muted text-muted-foreground border-border"
                                    )}
                                >
                                    {step.label}
                                </div>
                                <div className="bg-border h-4 w-px" />
                            </div>
                        );
                    })}
                </div>

                {/* Finalize */}
                <div
                    className={cn(
                        "rounded-md border px-4 py-2 text-sm font-medium",
                        getStepColor(finalizeStep.status)
                    )}
                >
                    {finalizeStep.label}
                </div>
            </div>
        );
    };

    const renderForeachFlow = () => {
        const prepareStep = getStepById("prepare") || {
            id: "prepare",
            label: "Prepare",
            status: "pending" as const
        };
        const processStep = getStepById("process-lead") || {
            id: "process-lead",
            label: "Process",
            status: "pending" as const
        };
        const aggregateStep = getStepById("aggregate") || {
            id: "aggregate",
            label: "Aggregate",
            status: "pending" as const
        };

        return (
            <div className="flex flex-col items-center gap-2">
                {/* Prepare */}
                <div
                    className={cn(
                        "rounded-md border px-4 py-2 text-sm font-medium",
                        getStepColor(prepareStep.status)
                    )}
                >
                    {prepareStep.label}
                </div>

                <div className="bg-border h-4 w-px" />

                {/* Foreach loop */}
                <div className="border-border relative rounded-lg border-2 border-dashed p-4">
                    <span className="bg-background text-muted-foreground absolute -top-3 left-2 px-2 text-xs">
                        foreach (concurrency: 3)
                    </span>
                    <div className="flex gap-2">
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className={cn(
                                    "rounded border px-3 py-1.5 text-xs",
                                    processStep.status === "running"
                                        ? "animate-pulse border-blue-500 bg-blue-500/20"
                                        : processStep.status === "completed"
                                          ? "border-green-500 bg-green-500/20"
                                          : "bg-muted border-border"
                                )}
                            >
                                Lead {i}
                            </div>
                        ))}
                        <span className="text-muted-foreground">...</span>
                    </div>
                </div>

                <div className="bg-border h-4 w-px" />

                {/* Aggregate */}
                <div
                    className={cn(
                        "rounded-md border px-4 py-2 text-sm font-medium",
                        getStepColor(aggregateStep.status)
                    )}
                >
                    {aggregateStep.label}
                </div>
            </div>
        );
    };

    const renderApprovalFlow = () => {
        const generateStep = getStepById("generate-draft") || {
            id: "generate-draft",
            label: "Generate",
            status: "pending" as const
        };
        const prepareStep = getStepById("prepare-review") || {
            id: "prepare-review",
            label: "Prepare",
            status: "pending" as const
        };
        const approvalStep = getStepById("human-approval") || {
            id: "human-approval",
            label: "Review",
            status: "pending" as const
        };
        const publishStep = getStepById("publish") || {
            id: "publish",
            label: "Publish",
            status: "pending" as const
        };

        return (
            <div className="flex flex-col items-center gap-2">
                {/* Generate */}
                <div
                    className={cn(
                        "rounded-md border px-4 py-2 text-sm font-medium",
                        getStepColor(generateStep.status)
                    )}
                >
                    {generateStep.label}
                </div>

                <div className="bg-border h-4 w-px" />

                {/* Prepare */}
                <div
                    className={cn(
                        "rounded-md border px-4 py-2 text-sm font-medium",
                        getStepColor(prepareStep.status)
                    )}
                >
                    {prepareStep.label}
                </div>

                <div className="bg-border h-4 w-px" />

                {/* Approval - special styling for suspended */}
                <div
                    className={cn(
                        "rounded-md border-2 border-dashed px-4 py-2 text-sm font-medium",
                        approvalStep.status === "suspended"
                            ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            : getStepColor(approvalStep.status)
                    )}
                >
                    {approvalStep.status === "suspended" ? "⏸ Awaiting Review" : approvalStep.label}
                </div>

                <div className="bg-border h-4 w-px" />

                {/* Publish */}
                <div
                    className={cn(
                        "rounded-md border px-4 py-2 text-sm font-medium",
                        getStepColor(publishStep.status)
                    )}
                >
                    {publishStep.label}
                </div>
            </div>
        );
    };

    return (
        <div className={cn("bg-card rounded-lg border p-6", className)}>
            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-muted-foreground text-sm font-medium">Workflow Flow</h3>
                <div className="flex gap-2 text-xs">
                    <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-green-500" /> Completed
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" /> Running
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-amber-500" /> Suspended
                    </span>
                </div>
            </div>

            <div className="flex justify-center py-4">
                {type === "parallel" && renderParallelFlow()}
                {type === "branch" && renderBranchFlow()}
                {type === "foreach" && renderForeachFlow()}
                {type === "approval" && renderApprovalFlow()}
            </div>
        </div>
    );
}
