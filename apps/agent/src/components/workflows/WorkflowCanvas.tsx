"use client";

import { ReactNode } from "react";
import {
    ReactFlow,
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    Node,
    Edge,
    NodeTypes,
    EdgeTypes,
    ConnectionLineType,
    Panel,
    ReactFlowProvider
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@repo/ui";

interface WorkflowCanvasProps {
    nodes: Node[];
    edges: Edge[];
    nodeTypes: NodeTypes;
    edgeTypes?: EdgeTypes;
    className?: string;
    children?: ReactNode;
    fitView?: boolean;
    showMiniMap?: boolean;
    showBackground?: boolean;
    panOnScroll?: boolean;
    zoomOnScroll?: boolean;
}

function WorkflowCanvasInner({
    nodes: initialNodes,
    edges: initialEdges,
    nodeTypes,
    edgeTypes,
    className,
    children,
    fitView = true,
    showMiniMap = false,
    showBackground = true,
    panOnScroll = true,
    zoomOnScroll = true
}: WorkflowCanvasProps) {
    const [nodes, , onNodesChange] = useNodesState(initialNodes);
    const [edges, , onEdgesChange] = useEdgesState(initialEdges);

    const proOptions = { hideAttribution: true };

    return (
        <div className={cn("bg-background h-[400px] w-full rounded-lg border", className)}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                connectionLineType={ConnectionLineType.SmoothStep}
                fitView={fitView}
                fitViewOptions={{ padding: 0.2 }}
                panOnScroll={panOnScroll}
                zoomOnScroll={zoomOnScroll}
                minZoom={0.5}
                maxZoom={2}
                proOptions={proOptions}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
            >
                {showBackground && (
                    <Background
                        variant={BackgroundVariant.Dots}
                        gap={16}
                        size={1}
                        className="bg-muted/30"
                    />
                )}
                <Controls
                    showInteractive={false}
                    className="!bg-background !border-border !shadow-lg"
                />
                {showMiniMap && (
                    <MiniMap
                        className="!bg-background !border-border"
                        nodeColor={(node) => {
                            const status = node.data?.status as string;
                            switch (status) {
                                case "completed":
                                    return "#22c55e";
                                case "running":
                                    return "#3b82f6";
                                case "error":
                                    return "#ef4444";
                                case "suspended":
                                    return "#f59e0b";
                                default:
                                    return "#71717a";
                            }
                        }}
                    />
                )}
                {children}
            </ReactFlow>
        </div>
    );
}

export function WorkflowCanvas(props: WorkflowCanvasProps) {
    return (
        <ReactFlowProvider>
            <WorkflowCanvasInner {...props} />
        </ReactFlowProvider>
    );
}

// Panel component for custom controls
interface WorkflowPanelProps {
    position:
        | "top-left"
        | "top-right"
        | "bottom-left"
        | "bottom-right"
        | "top-center"
        | "bottom-center";
    children: ReactNode;
    className?: string;
}

export function WorkflowPanel({ position, children, className }: WorkflowPanelProps) {
    return (
        <Panel position={position} className={cn("flex gap-2", className)}>
            {children}
        </Panel>
    );
}
