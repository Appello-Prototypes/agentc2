"use client";

import { useMemo } from "react";
import { ReactFlow, Background, type Node, type Edge, Position } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { NetworkIcon } from "lucide-react";

interface NetworkPrimitive {
    primitiveType: string;
    agentSlug: string | null;
    workflowSlug: string | null;
    toolId: string | null;
    description: string | null;
}

interface NetworkSnapshot {
    slug: string;
    name: string;
    description: string | null;
    primitives: NetworkPrimitive[];
}

interface NetworkTopologyPreviewProps {
    network: NetworkSnapshot;
}

const NODE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
    ROUTER: { bg: "#1e1b4b", border: "#6366f1", text: "#a5b4fc" },
    AGENT: { bg: "#0c1e1e", border: "#14b8a6", text: "#5eead4" },
    TOOL: { bg: "#1a1a0e", border: "#eab308", text: "#fde047" },
    WORKFLOW: { bg: "#1a0e1e", border: "#a855f7", text: "#d8b4fe" }
};

function formatLabel(prim: NetworkPrimitive): string {
    if (prim.agentSlug) return prim.agentSlug.replace(/-/g, " ");
    if (prim.workflowSlug) return prim.workflowSlug.replace(/-/g, " ");
    if (prim.toolId) return prim.toolId.replace(/-/g, " ");
    return "unknown";
}

function getTypeEmoji(type: string): string {
    switch (type) {
        case "AGENT":
            return "🤖";
        case "TOOL":
            return "🔧";
        case "WORKFLOW":
            return "⚡";
        default:
            return "📦";
    }
}

export function NetworkTopologyPreview({ network }: NetworkTopologyPreviewProps) {
    const { nodes, edges } = useMemo(() => {
        const result: { nodes: Node[]; edges: Edge[] } = {
            nodes: [],
            edges: []
        };

        const routerNode: Node = {
            id: "router",
            position: { x: 250, y: 0 },
            data: {
                label: `🧭 ${network.name}`
            },
            style: {
                background: NODE_COLORS.ROUTER.bg,
                border: `1.5px solid ${NODE_COLORS.ROUTER.border}`,
                color: NODE_COLORS.ROUTER.text,
                borderRadius: "12px",
                padding: "10px 16px",
                fontSize: "13px",
                fontWeight: 600,
                textTransform: "capitalize" as const
            },
            sourcePosition: Position.Bottom,
            targetPosition: Position.Top
        };
        result.nodes.push(routerNode);

        const primitives = network.primitives || [];
        const totalWidth = Math.max(primitives.length * 200, 400);
        const startX = (600 - totalWidth) / 2;

        primitives.forEach((prim, idx) => {
            const colors = NODE_COLORS[prim.primitiveType] ?? NODE_COLORS.TOOL;
            const nodeId = `prim-${idx}`;

            result.nodes.push({
                id: nodeId,
                position: {
                    x: startX + idx * 200,
                    y: 120
                },
                data: {
                    label: `${getTypeEmoji(prim.primitiveType)} ${formatLabel(prim)}`
                },
                style: {
                    background: colors.bg,
                    border: `1.5px solid ${colors.border}`,
                    color: colors.text,
                    borderRadius: "10px",
                    padding: "8px 14px",
                    fontSize: "12px",
                    fontWeight: 500,
                    textTransform: "capitalize" as const
                },
                sourcePosition: Position.Top,
                targetPosition: Position.Top
            });

            result.edges.push({
                id: `e-router-${nodeId}`,
                source: "router",
                target: nodeId,
                style: { stroke: "#404040", strokeWidth: 1.5 },
                animated: true
            });
        });

        return result;
    }, [network]);

    const graphHeight = 240;

    return (
        <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <NetworkIcon className="h-5 w-5 text-indigo-400" />
                    {network.name}
                </CardTitle>
                {network.description && (
                    <p className="text-muted-foreground mt-1 text-sm">{network.description}</p>
                )}
            </CardHeader>
            <CardContent>
                <div
                    className="overflow-hidden rounded-lg border border-zinc-800"
                    style={{ height: graphHeight }}
                >
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        fitView
                        fitViewOptions={{ padding: 0.3 }}
                        nodesDraggable={false}
                        nodesConnectable={false}
                        elementsSelectable={false}
                        panOnDrag={false}
                        zoomOnScroll={false}
                        zoomOnPinch={false}
                        zoomOnDoubleClick={false}
                        preventScrolling={false}
                        proOptions={{ hideAttribution: true }}
                    >
                        <Background color="#222" gap={20} />
                    </ReactFlow>
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                    {network.primitives?.map((prim, idx) => (
                        <div
                            key={idx}
                            className="text-muted-foreground flex items-center gap-1.5 text-xs"
                        >
                            <span>{getTypeEmoji(prim.primitiveType)}</span>
                            <span className="capitalize">{formatLabel(prim)}</span>
                            <span className="text-zinc-600">
                                ({prim.primitiveType.toLowerCase()})
                            </span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
