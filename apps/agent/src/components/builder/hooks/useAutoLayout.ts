"use client";

import { useCallback } from "react";
import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";

const DEFAULT_NODE_WIDTH = 240;
const DEFAULT_NODE_HEIGHT = 80;

interface LayoutOptions {
    direction?: "TB" | "LR";
    nodeWidth?: number;
    nodeHeight?: number;
    nodeSep?: number;
    rankSep?: number;
    forceAll?: boolean;
}

export function getLayoutedElements(nodes: Node[], edges: Edge[], options: LayoutOptions = {}) {
    const {
        direction = "TB",
        nodeWidth = DEFAULT_NODE_WIDTH,
        nodeHeight = DEFAULT_NODE_HEIGHT,
        nodeSep = 80,
        rankSep = 100,
        forceAll = false
    } = options;

    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: direction, nodesep: nodeSep, ranksep: rankSep, edgesep: 30 });

    const nodesToLayout: Node[] = [];
    const fixedNodes: Node[] = [];

    nodes.forEach((node) => {
        const w = (node.measured?.width ?? node.width ?? nodeWidth) as number;
        const h = (node.measured?.height ?? node.height ?? nodeHeight) as number;

        if (!forceAll && node.data?.manuallyPositioned) {
            fixedNodes.push(node);
            g.setNode(node.id, {
                width: w,
                height: h,
                x: node.position.x + w / 2,
                y: node.position.y + h / 2
            });
        } else {
            nodesToLayout.push(node);
            g.setNode(node.id, { width: w, height: h });
        }
    });

    edges.forEach((edge) => {
        g.setEdge(edge.source, edge.target);
    });

    dagre.layout(g);

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = g.node(node.id);
        if (!nodeWithPosition) return node;
        if (!forceAll && node.data?.manuallyPositioned) return node;

        const w = (node.measured?.width ?? node.width ?? nodeWidth) as number;
        const h = (node.measured?.height ?? node.height ?? nodeHeight) as number;

        return {
            ...node,
            position: {
                x: nodeWithPosition.x - w / 2,
                y: nodeWithPosition.y - h / 2
            }
        };
    });

    return layoutedNodes;
}

export function useAutoLayout() {
    const applyLayout = useCallback((nodes: Node[], edges: Edge[], options?: LayoutOptions) => {
        return getLayoutedElements(nodes, edges, options);
    }, []);

    return { applyLayout };
}
