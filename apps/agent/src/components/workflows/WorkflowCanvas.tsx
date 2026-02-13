"use client";

import { ReactNode, useEffect, useMemo, type MouseEvent } from "react";
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
    onNodeClick?: (event: MouseEvent, node: Node) => void;
    onEdgeClick?: (event: MouseEvent, edge: Edge) => void;
    selectedNodeIds?: string[];
    selectedEdgeIds?: string[];
    nodesDraggable?: boolean;
    nodesConnectable?: boolean;
    elementsSelectable?: boolean;
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
    zoomOnScroll = true,
    onNodeClick,
    onEdgeClick,
    selectedNodeIds,
    selectedEdgeIds,
    nodesDraggable = false,
    nodesConnectable = false,
    elementsSelectable = false
}: WorkflowCanvasProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // Sync state when props change (e.g., after data is fetched)
    useEffect(() => {
        setNodes(initialNodes);
    }, [initialNodes, setNodes]);

    useEffect(() => {
        setEdges(initialEdges);
    }, [initialEdges, setEdges]);

    const proOptions = { hideAttribution: true };
    const selectedNodeSet = useMemo(() => new Set(selectedNodeIds || []), [selectedNodeIds]);
    const selectedEdgeSet = useMemo(() => new Set(selectedEdgeIds || []), [selectedEdgeIds]);

    const displayNodes = useMemo(
        () =>
            nodes.map((node) => ({
                ...node,
                data: {
                    ...node.data,
                    selected: selectedNodeSet.has(node.id)
                }
            })),
        [nodes, selectedNodeSet]
    );

    const displayEdges = useMemo(
        () =>
            edges.map((edge) => ({
                ...edge,
                data: {
                    ...edge.data,
                    selected: selectedEdgeSet.has(edge.id)
                }
            })),
        [edges, selectedEdgeSet]
    );

    return (
        <div
            className={cn(
                "bg-background h-[300px] w-full rounded-lg border md:h-[400px]",
                className
            )}
        >
            <ReactFlow
                nodes={displayNodes}
                edges={displayEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                onEdgeClick={onEdgeClick}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                connectionLineType={ConnectionLineType.SmoothStep}
                fitView={fitView}
                fitViewOptions={{ padding: 0.2 }}
                panOnScroll={panOnScroll}
                zoomOnScroll={zoomOnScroll}
                panOnDrag
                minZoom={0.3}
                maxZoom={2}
                proOptions={proOptions}
                nodesDraggable={nodesDraggable}
                nodesConnectable={nodesConnectable}
                elementsSelectable={elementsSelectable}
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
