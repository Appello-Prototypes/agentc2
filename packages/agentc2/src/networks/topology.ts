export type NetworkPrimitiveInput = {
    primitiveType?: string | null;
    agentId?: string | null;
    workflowId?: string | null;
    toolId?: string | null;
    description?: string | null;
    position?: unknown | null;
};

export type NetworkTopology = {
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
    viewport?: Record<string, unknown>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === "object" && !Array.isArray(value);

const sanitizeId = (value: string) =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

const resolvePrimitiveRef = (primitive: NetworkPrimitiveInput, index: number) =>
    primitive.agentId ||
    primitive.workflowId ||
    primitive.toolId ||
    `${primitive.primitiveType || "primitive"}-${index + 1}`;

const resolvePrimitivePosition = (primitive: NetworkPrimitiveInput, index: number) => {
    const position = primitive.position;
    if (isRecord(position) && typeof position.x === "number" && typeof position.y === "number") {
        return { x: position.x, y: position.y };
    }
    return { x: 320, y: index * 140 };
};

export const isNetworkTopologyEmpty = (topology: unknown): boolean => {
    if (!isRecord(topology)) return true;
    const nodes = topology.nodes;
    const edges = topology.edges;
    const hasNodes = Array.isArray(nodes) && nodes.length > 0;
    const hasEdges = Array.isArray(edges) && edges.length > 0;
    return !hasNodes && !hasEdges;
};

export const buildNetworkTopologyFromPrimitives = (
    primitives: NetworkPrimitiveInput[]
): NetworkTopology => {
    const nodes: Array<Record<string, unknown>> = [];
    const edges: Array<Record<string, unknown>> = [];

    if (primitives.length === 0) {
        return { nodes, edges };
    }

    const routerId = "router";
    nodes.push({
        id: routerId,
        type: "workflow",
        position: { x: 0, y: 0 },
        data: {
            label: "Router",
            description: "Routes requests to primitives",
            type: "router"
        }
    });

    primitives.forEach((primitive, index) => {
        const ref = resolvePrimitiveRef(primitive, index);
        const baseId = sanitizeId(`${primitive.primitiveType || "primitive"}-${ref}`);
        const nodeId = baseId ? `node-${baseId}-${index + 1}` : `node-${index + 1}`;
        const label = String(ref);
        const description =
            primitive.description ||
            (primitive.primitiveType ? `${primitive.primitiveType} primitive` : "primitive");

        nodes.push({
            id: nodeId,
            type: "workflow",
            position: resolvePrimitivePosition(primitive, index),
            data: {
                label,
                description,
                type: primitive.primitiveType || "primitive"
            }
        });

        edges.push({
            id: `edge-${routerId}-${nodeId}`,
            source: routerId,
            target: nodeId,
            type: "temporary",
            data: { label: "" }
        });
    });

    return { nodes, edges };
};
