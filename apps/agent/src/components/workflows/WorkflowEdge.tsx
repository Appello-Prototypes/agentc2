"use client";

import { memo } from "react";
import { EdgeProps, getSmoothStepPath, EdgeLabelRenderer } from "@xyflow/react";

interface AnimatedEdgeProps extends EdgeProps {
    data?: {
        label?: string;
        status?: "active" | "completed" | "pending" | "error";
    };
}

// Animated edge for active data flow
function AnimatedEdgeComponent({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    markerEnd
}: AnimatedEdgeProps) {
    const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 8
    });

    const status = data?.status || "active";

    const strokeColor = {
        active: "#3b82f6",
        completed: "#22c55e",
        pending: "#71717a",
        error: "#ef4444"
    }[status];

    return (
        <>
            {/* Background path */}
            <path
                id={`${id}-bg`}
                className="react-flow__edge-path"
                d={edgePath}
                strokeWidth={3}
                stroke={strokeColor}
                strokeOpacity={0.2}
                fill="none"
            />
            {/* Animated foreground path */}
            <path
                id={id}
                className="react-flow__edge-path"
                d={edgePath}
                strokeWidth={2}
                stroke={strokeColor}
                fill="none"
                strokeDasharray="8 4"
                style={{
                    animation: status === "active" ? "flow 1s linear infinite" : "none"
                }}
                markerEnd={markerEnd}
            />
            {/* Label */}
            {data?.label && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: "absolute",
                            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                            pointerEvents: "all"
                        }}
                        className="bg-background border-border text-muted-foreground rounded border px-1.5 py-0.5 text-xs"
                    >
                        {data.label}
                    </div>
                </EdgeLabelRenderer>
            )}
            <style>{`
                @keyframes flow {
                    from {
                        stroke-dashoffset: 24;
                    }
                    to {
                        stroke-dashoffset: 0;
                    }
                }
            `}</style>
        </>
    );
}

export const AnimatedEdge = memo(AnimatedEdgeComponent);

// Completed edge (solid green)
function CompletedEdgeComponent({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    markerEnd
}: AnimatedEdgeProps) {
    const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 8
    });

    return (
        <>
            <path
                id={id}
                className="react-flow__edge-path"
                d={edgePath}
                strokeWidth={2}
                stroke="#22c55e"
                fill="none"
                markerEnd={markerEnd}
            />
            {data?.label && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: "absolute",
                            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                            pointerEvents: "all"
                        }}
                        className="rounded border border-green-500 bg-green-500/10 px-1.5 py-0.5 text-xs text-green-700 dark:text-green-300"
                    >
                        {data.label}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
}

export const CompletedEdge = memo(CompletedEdgeComponent);

// Temporary/conditional edge (dashed, muted)
function TemporaryEdgeComponent({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    markerEnd
}: AnimatedEdgeProps) {
    const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 8
    });

    return (
        <>
            <path
                id={id}
                className="react-flow__edge-path"
                d={edgePath}
                strokeWidth={1.5}
                stroke="#71717a"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                fill="none"
                markerEnd={markerEnd}
            />
            {data?.label && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: "absolute",
                            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                            pointerEvents: "all"
                        }}
                        className="bg-muted border-border text-muted-foreground rounded border px-1.5 py-0.5 text-xs"
                    >
                        {data.label}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
}

export const TemporaryEdge = memo(TemporaryEdgeComponent);

// Error edge (red, animated)
function ErrorEdgeComponent({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    markerEnd
}: AnimatedEdgeProps) {
    const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 8
    });

    return (
        <>
            <path
                id={id}
                className="react-flow__edge-path"
                d={edgePath}
                strokeWidth={2}
                stroke="#ef4444"
                fill="none"
                strokeDasharray="6 3"
                markerEnd={markerEnd}
            />
            {data?.label && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: "absolute",
                            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                            pointerEvents: "all"
                        }}
                        className="rounded border border-red-500 bg-red-500/10 px-1.5 py-0.5 text-xs text-red-700 dark:text-red-300"
                    >
                        {data.label}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
}

export const ErrorEdge = memo(ErrorEdgeComponent);

// Export all edge types as a single object
export const workflowEdgeTypes = {
    animated: AnimatedEdge,
    completed: CompletedEdge,
    temporary: TemporaryEdge,
    error: ErrorEdge
};
