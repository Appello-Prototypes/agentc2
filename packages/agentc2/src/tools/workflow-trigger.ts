import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Workflow Trigger Tool
 *
 * Allows an agent to trigger and execute workflows.
 * Demonstrates agent-workflow integration.
 */
export const workflowTriggerTool = createTool({
    id: "trigger-workflow",
    description:
        "Trigger a workflow to perform complex multi-step operations. Use for tasks that require structured, multi-step processing.",
    inputSchema: z.object({
        workflowId: z.string().describe("The workflow ID to run"),
        input: z.record(z.any()).describe("Input data for the workflow")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        workflowId: z.string(),
        runId: z.string().optional(),
        status: z.string(),
        result: z.any().optional(),
        error: z.string().optional()
    }),
    execute: async ({ workflowId, input }, context) => {
        try {
            const mastra = context?.mastra;
            if (!mastra) {
                throw new Error("Mastra context not available");
            }

            const workflow = mastra.getWorkflow(workflowId);
            if (!workflow) {
                throw new Error(`Workflow "${workflowId}" not found`);
            }

            const run = await workflow.createRun();
            const result = await run.start({ inputData: input });

            return {
                success: result.status === "success",
                workflowId,
                runId: run.runId,
                status: result.status,
                result: result.status === "success" ? result.result : undefined,
                error: result.status === "failed" ? result.error?.message : undefined
            };
        } catch (error) {
            return {
                success: false,
                workflowId,
                status: "error",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }
});
