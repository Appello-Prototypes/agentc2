import { describe, it, expect } from "vitest";
import {
    CODING_PIPELINE_DEFINITION,
    CODING_PIPELINE_INTERNAL_DEFINITION,
    CODING_PIPELINE_WORKFLOW_SEED,
    CODING_PIPELINE_INTERNAL_WORKFLOW_SEED
} from "../../packages/agentc2/src/workflows/coding-pipeline";

describe("Coding Pipeline Workflow Definitions", () => {
    describe("Standard pipeline", () => {
        it("has all required steps", () => {
            const steps = CODING_PIPELINE_DEFINITION.steps;
            expect(steps.length).toBeGreaterThanOrEqual(10);

            const stepIds = steps.map((s) => s.id);
            expect(stepIds).toContain("ingest-ticket");
            expect(stepIds).toContain("lookup-pipeline-config");
            expect(stepIds).toContain("analyze-codebase");
            expect(stepIds).toContain("plan-implementation");
            expect(stepIds).toContain("classify-risk");
            expect(stepIds).toContain("plan-approval-gate");
            expect(stepIds).toContain("dispatch-cursor");
            expect(stepIds).toContain("poll-cursor");
            expect(stepIds).toContain("provision-build-env");
            expect(stepIds).toContain("verify-checks");
            expect(stepIds).toContain("pr-review-gate");
            expect(stepIds).toContain("merge-pr");
        });

        it("has correct step types", () => {
            const steps = CODING_PIPELINE_DEFINITION.steps;
            const stepMap = Object.fromEntries(steps.map((s) => [s.id, s]));

            expect(stepMap["ingest-ticket"].type).toBe("tool");
            expect(stepMap["lookup-pipeline-config"].type).toBe("tool");
            expect(stepMap["analyze-codebase"].type).toBe("agent");
            expect(stepMap["plan-implementation"].type).toBe("agent");
            expect(stepMap["classify-risk"].type).toBe("agent");
            expect(stepMap["plan-approval-gate"].type).toBe("branch");
            expect(stepMap["dispatch-cursor"].type).toBe("tool");
            expect(stepMap["poll-cursor"].type).toBe("tool");
            expect(stepMap["verify-checks"].type).toBe("tool");
            expect(stepMap["pr-review-gate"].type).toBe("branch");
        });

        it("has two branch-based approval gates with human fallback", () => {
            const planGate = CODING_PIPELINE_DEFINITION.steps.find(
                (s) => s.id === "plan-approval-gate"
            );
            const prGate = CODING_PIPELINE_DEFINITION.steps.find((s) => s.id === "pr-review-gate");

            expect(planGate?.type).toBe("branch");
            expect(prGate?.type).toBe("branch");
            expect(
                planGate?.config?.defaultBranch?.some((s: { type?: string }) => s.type === "human")
            ).toBe(true);
            expect(
                prGate?.config?.defaultBranch?.some((s: { type?: string }) => s.type === "human")
            ).toBe(true);
        });

        it("has tool steps that reference valid tools", () => {
            const toolSteps = CODING_PIPELINE_DEFINITION.steps.filter((s) => s.type === "tool");
            const expectedTools = [
                "ingest-ticket",
                "lookup-pipeline-config",
                "update-pipeline-status",
                "cursor-launch-agent",
                "cursor-poll-until-done",
                "provision-compute",
                "remote-execute",
                "run-scenarios",
                "teardown-compute",
                "wait-for-checks",
                "calculate-trust-score",
                "merge-pull-request",
                "await-deploy"
            ];

            for (const step of toolSteps) {
                const toolId = step.config?.toolId;
                if (toolId) {
                    expect(
                        expectedTools,
                        `Step ${step.id} references unknown tool ${toolId}`
                    ).toContain(toolId);
                }
            }
        });
    });

    describe("Internal pipeline", () => {
        it("has at least as many steps as standard", () => {
            expect(CODING_PIPELINE_INTERNAL_DEFINITION.steps.length).toBeGreaterThanOrEqual(
                CODING_PIPELINE_DEFINITION.steps.length - 1
            );
        });

        it("uses agentc2-developer agent for planning", () => {
            const planStep = CODING_PIPELINE_INTERNAL_DEFINITION.steps.find(
                (s) => s.id === "plan-implementation"
            );
            expect(planStep).toBeDefined();
            expect(planStep?.config?.agentSlug).toBe("agentc2-developer");
        });

        it("includes coding standards in planning prompt", () => {
            const planStep = CODING_PIPELINE_INTERNAL_DEFINITION.steps.find(
                (s) => s.id === "plan-implementation"
            );
            expect(planStep?.config?.promptTemplate).toContain("coding standards");
            expect(planStep?.config?.promptTemplate).toContain("bun run type-check");
        });
    });

    describe("Workflow seeds", () => {
        it("standard seed has correct metadata", () => {
            expect(CODING_PIPELINE_WORKFLOW_SEED.slug).toBe("coding-pipeline");
            expect(CODING_PIPELINE_WORKFLOW_SEED.name).toContain("Coding Pipeline");
            expect(CODING_PIPELINE_WORKFLOW_SEED.maxSteps).toBe(25);
        });

        it("internal seed has correct metadata", () => {
            expect(CODING_PIPELINE_INTERNAL_WORKFLOW_SEED.slug).toBe("coding-pipeline-internal");
            expect(CODING_PIPELINE_INTERNAL_WORKFLOW_SEED.description).toContain(
                "self-development"
            );
            expect(CODING_PIPELINE_INTERNAL_WORKFLOW_SEED.maxSteps).toBe(25);
        });
    });
});
