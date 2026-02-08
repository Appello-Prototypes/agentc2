import { describe, it, expect } from "vitest";
import { recommendWorkspaceSystem } from "../../packages/mastra/src/workspace/intent";

describe("workspace intent recommendation", () => {
    it("defaults to agent for a single outcome", () => {
        const result = recommendWorkspaceSystem({
            trigger: "event",
            outcomes: ["review"]
        });

        expect(result.system).toBe("agent");
        expect(result.normalized.trigger).toBe("event");
    });

    it("selects workflow for multiple outcomes", () => {
        const result = recommendWorkspaceSystem({
            trigger: "schedule",
            outcomes: ["review", "notify"]
        });

        expect(result.system).toBe("workflow");
        expect(result.reason).toContain("Multiple");
    });

    it("selects workflow for chained steps", () => {
        const result = recommendWorkspaceSystem({
            trigger: "on-demand",
            outcomes: ["chain"],
            steps: 3
        });

        expect(result.system).toBe("workflow");
        expect(result.normalized.steps).toBe(3);
    });

    it("selects network when routing is requested", () => {
        const result = recommendWorkspaceSystem({
            trigger: "event",
            outcomes: ["categorize", "notify"],
            needsRouting: true
        });

        expect(result.system).toBe("network");
        expect(result.reason).toContain("Routing");
    });

    it("selects network for parallel paths", () => {
        const result = recommendWorkspaceSystem({
            trigger: "event",
            outcomes: ["analyze", "notify"],
            needsParallel: true
        });

        expect(result.system).toBe("network");
    });
});
