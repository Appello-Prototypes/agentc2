"use client";

import {
    type ReactNode,
    useCallback,
    useMemo,
    useRef,
    type MouseEvent,
    type DragEvent
} from "react";
import {
    ReactFlow,
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    ConnectionLineType,
    ConnectionMode,
    ReactFlowProvider,
    useReactFlow,
    type Node,
    type Edge,
    type NodeTypes,
    type EdgeTypes,
    type OnNodesChange,
    type OnEdgesChange,
    type OnConnect,
    type Connection,
    type Viewport,
    type OnSelectionChangeFunc
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@repo/ui";

export interface BuilderCanvasProps {
    nodes: Node[];
    edges: Edge[];
    onNodesChange: OnNodesChange;
    onEdgesChange: OnEdgesChange;
    onConnect?: OnConnect;
    onNodeDragStop?: (event: MouseEvent, node: Node) => void;
    onDrop?: (event: DragEvent) => void;
    onDragOver?: (event: DragEvent) => void;
    onSelectionChange?: OnSelectionChangeFunc;
    onPaneClick?: () => void;
    onNodeClick?: (event: MouseEvent, node: Node) => void;
    onEdgeClick?: (event: MouseEvent, edge: Edge) => void;
    onNodeContextMenu?: (event: React.MouseEvent, node: Node) => void;
    onEdgeContextMenu?: (event: React.MouseEvent, edge: Edge) => void;
    onPaneContextMenu?: (event: React.MouseEvent) => void;
    onNodeDoubleClick?: (event: React.MouseEvent, node: Node) => void;
    onPaneDoubleClick?: (event: React.MouseEvent) => void;
    onViewportChange?: (viewport: Viewport) => void;
    nodeTypes: NodeTypes;
    edgeTypes?: EdgeTypes;
    isValidConnection?: (connection: Connection) => boolean;
    defaultViewport?: Viewport;
    className?: string;
    children?: ReactNode;
}

function BuilderCanvasInner({
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeDragStop,
    onDrop,
    onDragOver,
    onSelectionChange,
    onPaneClick,
    onNodeClick,
    onEdgeClick,
    onNodeContextMenu,
    onEdgeContextMenu,
    onPaneContextMenu,
    onNodeDoubleClick,
    onViewportChange,
    nodeTypes,
    edgeTypes,
    isValidConnection,
    defaultViewport,
    className,
    children
}: BuilderCanvasProps) {
    const reactFlowRef = useRef<HTMLDivElement>(null);

    const handleDragOver = useCallback(
        (event: DragEvent) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            onDragOver?.(event);
        },
        [onDragOver]
    );

    if (nodes.length === 0) {
        return (
            <div className={cn("flex h-full w-full items-center justify-center", className)}>
                <div className="text-muted-foreground flex flex-col items-center gap-3 text-center">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="opacity-30"
                    >
                        <rect width="18" height="18" x="3" y="3" rx="2" />
                        <path d="M3 9h18" />
                        <path d="M9 21V9" />
                    </svg>
                    <p className="text-sm font-medium">Empty canvas</p>
                    <p className="max-w-[260px] text-xs opacity-70">
                        Drag a step from the palette, double-click the canvas, or use Cmd+K to add
                        your first node.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div ref={reactFlowRef} className={cn("h-full w-full", className)}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeDragStop={onNodeDragStop}
                onDrop={onDrop}
                onDragOver={handleDragOver}
                onSelectionChange={onSelectionChange}
                onPaneClick={onPaneClick}
                onNodeClick={onNodeClick}
                onEdgeClick={onEdgeClick}
                onNodeContextMenu={onNodeContextMenu}
                onEdgeContextMenu={onEdgeContextMenu}
                onPaneContextMenu={onPaneContextMenu as never}
                onNodeDoubleClick={onNodeDoubleClick}
                onMoveEnd={(_event, viewport) => onViewportChange?.(viewport)}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                isValidConnection={isValidConnection as never}
                defaultViewport={defaultViewport}
                connectionLineType={ConnectionLineType.SmoothStep}
                connectionMode={ConnectionMode.Loose}
                fitView={!defaultViewport}
                fitViewOptions={{ padding: 0.15 }}
                nodesDraggable
                nodesConnectable
                elementsSelectable
                selectionOnDrag
                multiSelectionKeyCode="Shift"
                deleteKeyCode={["Delete", "Backspace"]}
                snapToGrid
                snapGrid={[20, 20]}
                panOnDrag
                panOnScroll
                zoomOnScroll
                minZoom={0.1}
                maxZoom={4}
                proOptions={{ hideAttribution: true }}
            >
                <Background
                    variant={BackgroundVariant.Dots}
                    gap={20}
                    size={1}
                    className="!bg-background"
                />
                <Controls
                    showInteractive={false}
                    className="!bg-background !border-border !shadow-lg"
                />
                <MiniMap
                    className="!bg-background/90 !border-border !rounded-lg !shadow-lg"
                    maskColor="rgba(0, 0, 0, 0.1)"
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
                    pannable
                    zoomable
                />
                {children}
            </ReactFlow>
        </div>
    );
}

export function BuilderCanvas(props: BuilderCanvasProps) {
    return (
        <ReactFlowProvider>
            <BuilderCanvasInner {...props} />
        </ReactFlowProvider>
    );
}

export function useBuilderReactFlow() {
    return useReactFlow();
}
