import { beforeAll, describe, it, expect, vi } from "vitest";

vi.mock("../../packages/mastra/src/agents/resolver", () => ({
    agentResolver: { resolve: vi.fn() }
}));

vi.mock("../../packages/mastra/src/mastra", () => ({
    mastra: { getWorkflow: vi.fn() }
}));

vi.mock("../../packages/mastra/src/tools/registry", () => ({
    getToolsByNamesAsync: vi.fn()
}));

vi.mock("@repo/database", () => ({
    prisma: {
        workflow: {
            findFirst: vi.fn()
        }
    }
}));

let executeWorkflowDefinition: typeof import("../../packages/mastra/src/workflows/builder/runtime").executeWorkflowDefinition;

beforeAll(async () => {
    ({ executeWorkflowDefinition } =
        await import("../../packages/mastra/src/workflows/builder/runtime"));
});

describe("Workflow Runtime", () => {
    it("executes a transform step", async () => {
        const result = await executeWorkflowDefinition({
            definition: {
                steps: [
                    {
                        id: "transform",
                        type: "transform",
                        inputMapping: { value: "{{input.value}}" }
                    }
                ]
            },
            input: { value: 42 }
        });

        expect(result.status).toBe("success");
        expect(result.output).toEqual({ value: 42 });
    });

    it("executes branch conditions", async () => {
        const result = await executeWorkflowDefinition({
            definition: {
                steps: [
                    {
                        id: "branch",
                        type: "branch",
                        config: {
                            branches: [
                                {
                                    id: "yes",
                                    condition: "input.flag === true",
                                    steps: [
                                        {
                                            id: "yes-step",
                                            type: "transform",
                                            inputMapping: { result: "yes" }
                                        }
                                    ]
                                }
                            ],
                            defaultBranch: [
                                {
                                    id: "no-step",
                                    type: "transform",
                                    inputMapping: { result: "no" }
                                }
                            ]
                        }
                    }
                ]
            },
            input: { flag: true }
        });

        expect(result.status).toBe("success");
        expect(result.output).toEqual({ branchId: "yes", result: { result: "yes" } });
    });
});
