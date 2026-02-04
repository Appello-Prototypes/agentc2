import { describe, it, expect } from "vitest";
import { validateWorkflowDefinition } from "../../apps/agent/src/lib/workflow-validation";

describe("Workflow Validation", () => {
    it("accepts a minimal workflow definition", () => {
        const definition = {
            steps: [
                {
                    id: "step-1",
                    type: "transform",
                    config: {}
                }
            ]
        };

        const result = validateWorkflowDefinition(definition);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it("rejects missing steps", () => {
        const result = validateWorkflowDefinition({});
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it("requires agentSlug and promptTemplate for agent steps", () => {
        const definition = {
            steps: [
                {
                    id: "step-1",
                    type: "agent",
                    config: {}
                }
            ]
        };

        const result = validateWorkflowDefinition(definition);
        expect(result.valid).toBe(false);
        expect(result.errors.join(" ")).toContain("agentSlug");
        expect(result.errors.join(" ")).toContain("promptTemplate");
    });
});
