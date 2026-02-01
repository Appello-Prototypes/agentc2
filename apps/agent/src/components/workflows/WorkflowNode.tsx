"use client";

import { memo, ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";
import { cn } from "@repo/ui";

export type WorkflowNodeStatus = "pending" | "running" | "completed" | "error" | "suspended";

export interface WorkflowNodeData {
    label: string;
    description?: string;
    content?: string;
    footer?: string;
    status?: WorkflowNodeStatus;
    handles?: {
        top?: boolean;
        bottom?: boolean;
        left?: boolean;
        right?: boolean;
    };
    variant?: "default" | "decision" | "loop" | "human";
    icon?: ReactNode;
}

// Props for node components - simplified to avoid ReactFlow generic issues
interface WorkflowNodeProps {
    data: WorkflowNodeData;
}

const statusStyles: Record<WorkflowNodeStatus, string> = {
    pending: "border-muted-foreground/30 bg-muted/50",
    running: "border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/20",
    completed: "border-green-500 bg-green-500/10",
    error: "border-red-500 bg-red-500/10",
    suspended: "border-amber-500 bg-amber-500/10 border-dashed"
};

const statusDotStyles: Record<WorkflowNodeStatus, string> = {
    pending: "bg-muted-foreground/50",
    running: "bg-blue-500 animate-pulse",
    completed: "bg-green-500",
    error: "bg-red-500",
    suspended: "bg-amber-500"
};

function WorkflowNodeComponent({ data }: WorkflowNodeProps) {
    const {
        label,
        description,
        content,
        footer,
        status = "pending",
        handles = { top: true, bottom: true },
        variant = "default",
        icon
    } = data;

    const isDecision = variant === "decision";
    const isLoop = variant === "loop";
    const isHuman = variant === "human";

    return (
        <>
            {/* Handles */}
            {handles.top && (
                <Handle
                    type="target"
                    position={Position.Top}
                    className="!bg-muted-foreground/50 !h-2 !w-2 !border-0"
                />
            )}
            {handles.left && (
                <Handle
                    type="target"
                    position={Position.Left}
                    className="!bg-muted-foreground/50 !h-2 !w-2 !border-0"
                />
            )}

            {/* Node Content */}
            <div
                className={cn(
                    "max-w-[280px] min-w-[180px] rounded-lg border-2 shadow-sm transition-all",
                    statusStyles[status],
                    isDecision && "rotate-0", // Could make diamond shape with CSS transform
                    isLoop && "border-dashed",
                    isHuman && "border-amber-500"
                )}
            >
                {/* Header */}
                <div className="flex items-center gap-2 border-b border-inherit px-3 py-2">
                    <div className={cn("h-2 w-2 shrink-0 rounded-full", statusDotStyles[status])} />
                    {icon && <div className="shrink-0">{icon}</div>}
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{label}</div>
                        {description && (
                            <div className="text-muted-foreground truncate text-xs">
                                {description}
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                {content && (
                    <div className="text-muted-foreground border-b border-inherit px-3 py-2 text-xs">
                        {content}
                    </div>
                )}

                {/* Footer */}
                {footer && (
                    <div className="text-muted-foreground bg-muted/30 rounded-b-lg px-3 py-1.5 text-xs">
                        {footer}
                    </div>
                )}
            </div>

            {/* Output Handles */}
            {handles.bottom && (
                <Handle
                    type="source"
                    position={Position.Bottom}
                    className="!bg-muted-foreground/50 !h-2 !w-2 !border-0"
                />
            )}
            {handles.right && (
                <Handle
                    type="source"
                    position={Position.Right}
                    className="!bg-muted-foreground/50 !h-2 !w-2 !border-0"
                />
            )}
        </>
    );
}

export const WorkflowNode = memo(WorkflowNodeComponent);

// Decision node variant (diamond-shaped indicator)
function DecisionNodeComponent({ data }: WorkflowNodeProps) {
    const { label, status = "pending", handles = { top: true, bottom: true } } = data;

    return (
        <>
            {handles.top && (
                <Handle
                    type="target"
                    position={Position.Top}
                    className="!bg-muted-foreground/50 !h-2 !w-2 !border-0"
                />
            )}

            <div
                className={cn(
                    "flex h-24 w-24 rotate-45 items-center justify-center rounded-lg border-2 shadow-sm",
                    statusStyles[status]
                )}
            >
                <div className="-rotate-45 text-center">
                    <div
                        className={cn("mx-auto mb-1 h-2 w-2 rounded-full", statusDotStyles[status])}
                    />
                    <div className="text-xs font-medium">{label}</div>
                </div>
            </div>

            {handles.bottom && (
                <Handle
                    type="source"
                    position={Position.Bottom}
                    className="!bg-muted-foreground/50 !h-2 !w-2 !border-0"
                />
            )}
            {handles.left && (
                <Handle
                    type="source"
                    position={Position.Left}
                    id="left"
                    className="!bg-muted-foreground/50 !h-2 !w-2 !border-0"
                />
            )}
            {handles.right && (
                <Handle
                    type="source"
                    position={Position.Right}
                    id="right"
                    className="!bg-muted-foreground/50 !h-2 !w-2 !border-0"
                />
            )}
        </>
    );
}

export const DecisionNode = memo(DecisionNodeComponent);

// Loop container node (shows iteration context)
export interface LoopNodeData extends WorkflowNodeData {
    iterationCount?: number;
    currentIteration?: number;
    concurrency?: number;
}

interface LoopNodeProps {
    data: LoopNodeData;
}

function LoopNodeComponent({ data }: LoopNodeProps) {
    const {
        label,
        description,
        status = "pending",
        handles = { top: true, bottom: true },
        iterationCount,
        currentIteration,
        concurrency
    } = data;

    return (
        <>
            {handles.top && (
                <Handle
                    type="target"
                    position={Position.Top}
                    className="!bg-muted-foreground/50 !h-2 !w-2 !border-0"
                />
            )}

            <div
                className={cn(
                    "min-w-[220px] rounded-lg border-2 border-dashed p-3 shadow-sm",
                    statusStyles[status]
                )}
            >
                {/* Loop header */}
                <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={cn("h-2 w-2 rounded-full", statusDotStyles[status])} />
                        <span className="text-sm font-medium">{label}</span>
                    </div>
                    {concurrency && (
                        <span className="bg-muted rounded px-1.5 py-0.5 text-xs">
                            concurrency: {concurrency}
                        </span>
                    )}
                </div>

                {description && (
                    <div className="text-muted-foreground mb-2 text-xs">{description}</div>
                )}

                {/* Iteration indicators */}
                {iterationCount && (
                    <div className="flex flex-wrap gap-1">
                        {Array.from({ length: Math.min(iterationCount, 5) }).map((_, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "flex h-6 w-8 items-center justify-center rounded border text-xs",
                                    currentIteration !== undefined && i < currentIteration
                                        ? "border-green-500 bg-green-500/20 text-green-700 dark:text-green-300"
                                        : currentIteration !== undefined && i === currentIteration
                                          ? "animate-pulse border-blue-500 bg-blue-500/20 text-blue-700 dark:text-blue-300"
                                          : "bg-muted border-muted-foreground/30 text-muted-foreground"
                                )}
                            >
                                {i + 1}
                            </div>
                        ))}
                        {iterationCount > 5 && (
                            <span className="text-muted-foreground self-center text-xs">
                                +{iterationCount - 5} more
                            </span>
                        )}
                    </div>
                )}
            </div>

            {handles.bottom && (
                <Handle
                    type="source"
                    position={Position.Bottom}
                    className="!bg-muted-foreground/50 !h-2 !w-2 !border-0"
                />
            )}
        </>
    );
}

export const LoopNode = memo(LoopNodeComponent);

// Human-in-the-loop node
function HumanNodeComponent({ data }: WorkflowNodeProps) {
    const {
        label,
        description,
        content,
        status = "pending",
        handles = { top: true, bottom: true }
    } = data;

    const isSuspended = status === "suspended";

    return (
        <>
            {handles.top && (
                <Handle
                    type="target"
                    position={Position.Top}
                    className="!bg-muted-foreground/50 !h-2 !w-2 !border-0"
                />
            )}

            <div
                className={cn(
                    "max-w-[280px] min-w-[200px] rounded-lg border-2 shadow-sm",
                    isSuspended
                        ? "border-dashed border-amber-500 bg-amber-500/10"
                        : statusStyles[status]
                )}
            >
                {/* Header with human icon */}
                <div className="flex items-center gap-2 border-b border-inherit bg-amber-500/5 px-3 py-2">
                    <div className={cn("h-2 w-2 rounded-full", statusDotStyles[status])} />
                    <svg
                        className="h-4 w-4 text-amber-600 dark:text-amber-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                    </svg>
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{label}</div>
                        {description && (
                            <div className="text-muted-foreground text-xs">{description}</div>
                        )}
                    </div>
                </div>

                {/* Status message */}
                {content && (
                    <div className="px-3 py-2 text-xs">
                        {isSuspended ? (
                            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                                <svg
                                    className="h-4 w-4"
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
                                {content}
                            </div>
                        ) : (
                            <span className="text-muted-foreground">{content}</span>
                        )}
                    </div>
                )}
            </div>

            {handles.bottom && (
                <Handle
                    type="source"
                    position={Position.Bottom}
                    className="!bg-muted-foreground/50 !h-2 !w-2 !border-0"
                />
            )}
        </>
    );
}

export const HumanNode = memo(HumanNodeComponent);
