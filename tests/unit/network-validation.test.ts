import { describe, it, expect } from "vitest";
import { validateNetworkDefinition } from "../../apps/agent/src/lib/network-validation";

describe("Network Validation", () => {
    it("accepts a minimal network definition", () => {
        const result = validateNetworkDefinition({
            topologyJson: { nodes: [], edges: [] },
            primitives: []
        });

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it("requires primitive identifiers", () => {
        const result = validateNetworkDefinition({
            topologyJson: { nodes: [], edges: [] },
            primitives: [{ primitiveType: "agent" }]
        });

        expect(result.valid).toBe(false);
        expect(result.errors.join(" ")).toContain("agentId");
    });
});
