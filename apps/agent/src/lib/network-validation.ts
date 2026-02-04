const VALID_PRIMITIVE_TYPES = ["agent", "workflow", "tool"];

export function validateNetworkDefinition(input: { topologyJson?: unknown; primitives?: unknown }) {
    const errors: string[] = [];

    if (!input.topologyJson || typeof input.topologyJson !== "object") {
        errors.push("Topology JSON must be an object");
    } else {
        const topology = input.topologyJson as { nodes?: unknown; edges?: unknown };
        if (!Array.isArray(topology.nodes)) {
            errors.push("Topology JSON must include nodes array");
        }
        if (!Array.isArray(topology.edges)) {
            errors.push("Topology JSON must include edges array");
        }
    }

    if (input.primitives !== undefined) {
        if (!Array.isArray(input.primitives)) {
            errors.push("Primitives must be an array");
        } else {
            input.primitives.forEach((primitive, index) => {
                if (!primitive || typeof primitive !== "object") {
                    errors.push(`Primitive ${index + 1} must be an object`);
                    return;
                }
                const data = primitive as {
                    primitiveType?: string;
                    agentId?: string;
                    workflowId?: string;
                    toolId?: string;
                };
                if (!data.primitiveType || !VALID_PRIMITIVE_TYPES.includes(data.primitiveType)) {
                    errors.push(`Primitive ${index + 1} has invalid type`);
                }
                if (data.primitiveType === "agent" && !data.agentId) {
                    errors.push(`Primitive ${index + 1} missing agentId`);
                }
                if (data.primitiveType === "workflow" && !data.workflowId) {
                    errors.push(`Primitive ${index + 1} missing workflowId`);
                }
                if (data.primitiveType === "tool" && !data.toolId) {
                    errors.push(`Primitive ${index + 1} missing toolId`);
                }
            });
        }
    }

    return { valid: errors.length === 0, errors };
}
