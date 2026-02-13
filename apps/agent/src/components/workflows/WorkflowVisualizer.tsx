"use client";

import { useMemo } from "react";
import { Node, Edge, NodeTypes } from "@xyflow/react";
import { cn } from "@repo/ui";
import { WorkflowCanvas } from "./WorkflowCanvas";
import {
    WorkflowNode,
    DecisionNode,
    LoopNode,
    HumanNode,
    WorkflowNodeStatus
} from "./WorkflowNode";
import { workflowEdgeTypes } from "./WorkflowEdge";

interface WorkflowStep {
    id: string;
    label: string;
    status: WorkflowNodeStatus;
    description?: string;
    content?: string;
    footer?: string;
    timing?: number;
}

interface WorkflowVisualizerProps {
    type: "parallel" | "branch" | "foreach" | "approval";
    steps: WorkflowStep[];
    currentBranch?: string;
    className?: string;
}

// Node types registry
const nodeTypes: NodeTypes = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    workflow: WorkflowNode as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    decision: DecisionNode as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    loop: LoopNode as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    human: HumanNode as any
};

// Helper to format timing
const formatTiming = (ms?: number) => {
    if (!ms) return undefined;
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
};

// Helper to get edge type based on status
const getEdgeType = (sourceStatus: WorkflowNodeStatus, targetStatus: WorkflowNodeStatus) => {
    if (sourceStatus === "completed" && targetStatus === "completed") return "completed";
    if (sourceStatus === "running" || targetStatus === "running") return "animated";
    if (sourceStatus === "error" || targetStatus === "error") return "error";
    return "temporary";
};

/**
 * Generate nodes and edges for PARALLEL workflow
 * Input → [Sentiment, Priority, Suggestions] (parallel) → Combine
 */
function generateParallelFlow(steps: WorkflowStep[]): { nodes: Node[]; edges: Edge[] } {
    const getStep = (id: string) =>
        steps.find((s) => s.id === id) || { id, label: id, status: "pending" as const };

    const inputStep = getStep("input");
    const sentimentStep = getStep("sentiment");
    const priorityStep = getStep("priority");
    const suggestionsStep = getStep("suggestions");
    const combineStep = getStep("combine");

    const nodes: Node[] = [
        {
            id: "input",
            type: "workflow",
            position: { x: 250, y: 0 },
            data: {
                label: inputStep.label || "Input",
                description: "Receive customer message",
                content: inputStep.content || "Parsing incoming support ticket...",
                footer: inputStep.timing
                    ? `Completed in ${formatTiming(inputStep.timing)}`
                    : undefined,
                status: inputStep.status,
                handles: { top: false, bottom: true }
            }
        },
        {
            id: "sentiment",
            type: "workflow",
            position: { x: 0, y: 150 },
            data: {
                label: sentimentStep.label || "Sentiment",
                description: "Analyze emotional tone",
                content: sentimentStep.content || "Running sentiment classifier...",
                footer: sentimentStep.timing ? formatTiming(sentimentStep.timing) : undefined,
                status: sentimentStep.status,
                handles: { top: true, bottom: true }
            }
        },
        {
            id: "priority",
            type: "workflow",
            position: { x: 250, y: 150 },
            data: {
                label: priorityStep.label || "Priority",
                description: "Determine urgency level",
                content: priorityStep.content || "Evaluating priority factors...",
                footer: priorityStep.timing ? formatTiming(priorityStep.timing) : undefined,
                status: priorityStep.status,
                handles: { top: true, bottom: true }
            }
        },
        {
            id: "suggestions",
            type: "workflow",
            position: { x: 500, y: 150 },
            data: {
                label: suggestionsStep.label || "Suggestions",
                description: "Generate response options",
                content: suggestionsStep.content || "Generating AI suggestions...",
                footer: suggestionsStep.timing ? formatTiming(suggestionsStep.timing) : undefined,
                status: suggestionsStep.status,
                handles: { top: true, bottom: true }
            }
        },
        {
            id: "combine",
            type: "workflow",
            position: { x: 250, y: 320 },
            data: {
                label: combineStep.label || "Combine",
                description: "Merge all analysis results",
                content: combineStep.content || "Aggregating parallel results...",
                footer: combineStep.timing ? formatTiming(combineStep.timing) : undefined,
                status: combineStep.status,
                handles: { top: true, bottom: false }
            }
        }
    ];

    const edges: Edge[] = [
        {
            id: "input-sentiment",
            source: "input",
            target: "sentiment",
            type: getEdgeType(inputStep.status, sentimentStep.status)
        },
        {
            id: "input-priority",
            source: "input",
            target: "priority",
            type: getEdgeType(inputStep.status, priorityStep.status)
        },
        {
            id: "input-suggestions",
            source: "input",
            target: "suggestions",
            type: getEdgeType(inputStep.status, suggestionsStep.status)
        },
        {
            id: "sentiment-combine",
            source: "sentiment",
            target: "combine",
            type: getEdgeType(sentimentStep.status, combineStep.status)
        },
        {
            id: "priority-combine",
            source: "priority",
            target: "combine",
            type: getEdgeType(priorityStep.status, combineStep.status)
        },
        {
            id: "suggestions-combine",
            source: "suggestions",
            target: "combine",
            type: getEdgeType(suggestionsStep.status, combineStep.status)
        }
    ];

    return { nodes, edges };
}

/**
 * Generate nodes and edges for BRANCH workflow
 * Classify → Decision → [Billing, Support, Product, Help Desk] → Finalize
 */
function generateBranchFlow(
    steps: WorkflowStep[],
    currentBranch?: string
): { nodes: Node[]; edges: Edge[] } {
    const getStep = (id: string) =>
        steps.find((s) => s.id === id) || { id, label: id, status: "pending" as const };

    const classifyStep = getStep("classify");
    const refundStep = getStep("handle-refund");
    const technicalStep = getStep("handle-technical");
    const featureStep = getStep("handle-feature");
    const generalStep = getStep("handle-general");
    const finalizeStep = getStep("finalize");

    const branchMap: Record<string, { step: WorkflowStep; label: string; x: number }> = {
        refund: { step: refundStep, label: "Billing", x: 0 },
        technical: { step: technicalStep, label: "Support", x: 200 },
        feature: { step: featureStep, label: "Product", x: 400 },
        general: { step: generalStep, label: "Help Desk", x: 600 }
    };

    const nodes: Node[] = [
        {
            id: "classify",
            type: "workflow",
            position: { x: 300, y: 0 },
            data: {
                label: classifyStep.label || "Classify",
                description: "Analyze ticket type",
                content: classifyStep.content || "Classifying customer inquiry...",
                footer: classifyStep.timing ? formatTiming(classifyStep.timing) : undefined,
                status: classifyStep.status,
                handles: { top: false, bottom: true }
            }
        },
        {
            id: "decision",
            type: "decision",
            position: { x: 338, y: 120 },
            data: {
                label: "Route",
                status: classifyStep.status === "completed" ? "completed" : "pending",
                handles: { top: true, bottom: true, left: true, right: true }
            }
        }
    ];

    // Add branch nodes
    Object.entries(branchMap).forEach(([branch, { step, label, x }]) => {
        const isBranchInactive = currentBranch && currentBranch !== branch;

        nodes.push({
            id: step.id,
            type: "workflow",
            position: { x, y: 260 },
            data: {
                label: label,
                description: `Handle ${branch} requests`,
                content: step.content || `Processing ${branch} ticket...`,
                footer: step.timing ? formatTiming(step.timing) : undefined,
                status: isBranchInactive ? "pending" : step.status,
                handles: { top: true, bottom: true }
            }
        });
    });

    // Add finalize node
    nodes.push({
        id: "finalize",
        type: "workflow",
        position: { x: 300, y: 420 },
        data: {
            label: finalizeStep.label || "Finalize",
            description: "Complete ticket processing",
            content: finalizeStep.content || "Generating response...",
            footer: finalizeStep.timing ? formatTiming(finalizeStep.timing) : undefined,
            status: finalizeStep.status,
            handles: { top: true, bottom: false }
        }
    });

    // Create edges
    const edges: Edge[] = [
        {
            id: "classify-decision",
            source: "classify",
            target: "decision",
            type: classifyStep.status === "completed" ? "completed" : "animated"
        }
    ];

    // Add branch edges
    Object.entries(branchMap).forEach(([branch, { step }]) => {
        const isActive = currentBranch === branch;
        const isInactive = currentBranch && currentBranch !== branch;

        edges.push({
            id: `decision-${step.id}`,
            source: "decision",
            target: step.id,
            type: isActive
                ? getEdgeType("completed" as WorkflowNodeStatus, step.status)
                : "temporary",
            data: isActive ? { label: branch } : undefined
        });

        edges.push({
            id: `${step.id}-finalize`,
            source: step.id,
            target: "finalize",
            type: isInactive ? "temporary" : getEdgeType(step.status, finalizeStep.status)
        });
    });

    return { nodes, edges };
}

/**
 * Generate nodes and edges for FOREACH workflow
 * Prepare → [Loop: Process Lead 1, 2, 3...] → Aggregate
 */
function generateForeachFlow(steps: WorkflowStep[]): { nodes: Node[]; edges: Edge[] } {
    const getStep = (id: string) =>
        steps.find((s) => s.id === id) || { id, label: id, status: "pending" as const };

    const prepareStep = getStep("prepare");
    const processStep = getStep("process-lead");
    const aggregateStep = getStep("aggregate");

    // Determine iteration progress
    let currentIteration = 0;
    if (processStep.status === "running") currentIteration = 2;
    else if (processStep.status === "completed") currentIteration = 5;

    const nodes: Node[] = [
        {
            id: "prepare",
            type: "workflow",
            position: { x: 150, y: 0 },
            data: {
                label: prepareStep.label || "Prepare",
                description: "Fetch leads to process",
                content: prepareStep.content || "Loading lead data from CRM...",
                footer: prepareStep.timing ? formatTiming(prepareStep.timing) : undefined,
                status: prepareStep.status,
                handles: { top: false, bottom: true }
            }
        },
        {
            id: "process-lead",
            type: "loop",
            position: { x: 100, y: 130 },
            data: {
                label: "Process Leads",
                description: "Enrich and score each lead",
                status: processStep.status,
                iterationCount: 5,
                currentIteration: currentIteration,
                concurrency: 3,
                handles: { top: true, bottom: true }
            }
        },
        {
            id: "aggregate",
            type: "workflow",
            position: { x: 150, y: 300 },
            data: {
                label: aggregateStep.label || "Aggregate",
                description: "Compile final results",
                content: aggregateStep.content || "Merging processed lead data...",
                footer: aggregateStep.timing ? formatTiming(aggregateStep.timing) : undefined,
                status: aggregateStep.status,
                handles: { top: true, bottom: false }
            }
        }
    ];

    const edges: Edge[] = [
        {
            id: "prepare-process",
            source: "prepare",
            target: "process-lead",
            type: getEdgeType(prepareStep.status, processStep.status)
        },
        {
            id: "process-aggregate",
            source: "process-lead",
            target: "aggregate",
            type: getEdgeType(processStep.status, aggregateStep.status)
        }
    ];

    return { nodes, edges };
}

/**
 * Generate nodes and edges for APPROVAL workflow
 * Generate → Prepare → Human Review → Publish
 */
function generateApprovalFlow(steps: WorkflowStep[]): { nodes: Node[]; edges: Edge[] } {
    const getStep = (id: string) =>
        steps.find((s) => s.id === id) || { id, label: id, status: "pending" as const };

    const generateStep = getStep("generate-draft");
    const prepareStep = getStep("prepare-review");
    const approvalStep = getStep("human-approval");
    const publishStep = getStep("publish");

    const nodes: Node[] = [
        {
            id: "generate-draft",
            type: "workflow",
            position: { x: 150, y: 0 },
            data: {
                label: generateStep.label || "Generate",
                description: "Create initial content",
                content: generateStep.content || "Generating draft with AI...",
                footer: generateStep.timing ? formatTiming(generateStep.timing) : undefined,
                status: generateStep.status,
                handles: { top: false, bottom: true }
            }
        },
        {
            id: "prepare-review",
            type: "workflow",
            position: { x: 150, y: 130 },
            data: {
                label: prepareStep.label || "Prepare",
                description: "Format for review",
                content: prepareStep.content || "Preparing content for review...",
                footer: prepareStep.timing ? formatTiming(prepareStep.timing) : undefined,
                status: prepareStep.status,
                handles: { top: true, bottom: true }
            }
        },
        {
            id: "human-approval",
            type: "human",
            position: { x: 150, y: 260 },
            data: {
                label: approvalStep.label || "Human Review",
                description: "Requires manual approval",
                content:
                    approvalStep.status === "suspended"
                        ? "Awaiting human approval..."
                        : approvalStep.content || "Review and approve content",
                status: approvalStep.status,
                handles: { top: true, bottom: true }
            }
        },
        {
            id: "publish",
            type: "workflow",
            position: { x: 150, y: 400 },
            data: {
                label: publishStep.label || "Publish",
                description: "Deploy approved content",
                content: publishStep.content || "Publishing to destination...",
                footer: publishStep.timing ? formatTiming(publishStep.timing) : undefined,
                status: publishStep.status,
                handles: { top: true, bottom: false }
            }
        }
    ];

    const edges: Edge[] = [
        {
            id: "generate-prepare",
            source: "generate-draft",
            target: "prepare-review",
            type: getEdgeType(generateStep.status, prepareStep.status)
        },
        {
            id: "prepare-approval",
            source: "prepare-review",
            target: "human-approval",
            type: getEdgeType(prepareStep.status, approvalStep.status)
        },
        {
            id: "approval-publish",
            source: "human-approval",
            target: "publish",
            type: getEdgeType(approvalStep.status, publishStep.status)
        }
    ];

    return { nodes, edges };
}

/**
 * WorkflowVisualizer - Interactive flow diagram using React Flow
 */
export function WorkflowVisualizer({
    type,
    steps,
    currentBranch,
    className
}: WorkflowVisualizerProps) {
    const { nodes, edges } = useMemo(() => {
        switch (type) {
            case "parallel":
                return generateParallelFlow(steps);
            case "branch":
                return generateBranchFlow(steps, currentBranch);
            case "foreach":
                return generateForeachFlow(steps);
            case "approval":
                return generateApprovalFlow(steps);
            default:
                return { nodes: [], edges: [] };
        }
    }, [type, steps, currentBranch]);

    return (
        <div className={cn("relative", className)}>
            {/* Legend */}
            <div className="bg-background/80 absolute top-2 left-2 z-10 flex gap-3 rounded-md border px-3 py-1.5 text-xs backdrop-blur-sm">
                <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-green-500" /> Completed
                </span>
                <span className="flex items-center gap-1">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" /> Running
                </span>
                <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-amber-500" /> Suspended
                </span>
                <span className="flex items-center gap-1">
                    <span className="bg-muted-foreground/50 h-2 w-2 rounded-full" /> Pending
                </span>
            </div>

            <WorkflowCanvas
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={workflowEdgeTypes}
                className="h-[300px] md:h-[450px]"
                showMiniMap={type === "branch"}
            />
        </div>
    );
}
