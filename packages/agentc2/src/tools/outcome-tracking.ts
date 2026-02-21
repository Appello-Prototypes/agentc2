import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { recordOutcome, getAgentROI } from "../budget/outcomes";

export const recordOutcomeTool = createTool({
    id: "record-outcome",
    description:
        "Record a measurable outcome from an agent run. Use to track ticket resolutions, leads qualified, documents generated, etc. for cost-per-outcome analytics.",
    inputSchema: z.object({
        agentId: z.string().describe("The agent that produced the outcome"),
        runId: z.string().optional().describe("The run that produced the outcome"),
        outcomeType: z
            .string()
            .describe(
                "Type of outcome (e.g. 'ticket_resolved', 'lead_qualified', 'document_generated')"
            ),
        valueUsd: z.number().optional().describe("Monetary value of this outcome, if quantifiable"),
        success: z
            .boolean()
            .optional()
            .default(true)
            .describe("Whether the outcome was successful"),
        metadata: z.record(z.unknown()).optional().describe("Additional outcome-specific data")
    }),
    outputSchema: z.object({
        outcomeId: z.string(),
        recorded: z.boolean()
    }),
    execute: async ({ agentId, runId, outcomeType, valueUsd, success, metadata }) => {
        const outcome = await recordOutcome({
            agentId,
            runId,
            outcomeType,
            valueUsd,
            success,
            metadata: metadata as Record<string, unknown> | undefined
        });
        return { outcomeId: outcome.id, recorded: true };
    }
});

export const agentROITool = createTool({
    id: "agent-roi",
    description:
        "Get ROI metrics for an agent: total cost, total outcome value, cost-per-outcome, and ROI percentage.",
    inputSchema: z.object({
        agentId: z.string().describe("The agent to get ROI for"),
        periodDays: z.number().optional().default(30).describe("Period to calculate over (days)")
    }),
    outputSchema: z.object({
        totalCostUsd: z.number(),
        totalOutcomeValueUsd: z.number(),
        outcomeCount: z.number(),
        costPerOutcome: z.number().nullable(),
        roi: z.number().nullable()
    }),
    execute: async ({ agentId, periodDays }) => {
        return getAgentROI(agentId, periodDays);
    }
});
