import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { recommendWorkspaceSystem } from "../workspace/intent";

const intentSchema = z.object({
    trigger: z.enum(["event", "schedule", "on-demand"]).optional(),
    outcomes: z
        .array(z.enum(["review", "categorize", "analyze", "action", "notify", "chain"]))
        .optional(),
    steps: z.number().optional(),
    needsRouting: z.boolean().optional(),
    needsParallel: z.boolean().optional()
});

export const workspaceIntentRecommendationTool = createTool({
    id: "workspace-intent-recommendation",
    description: "Recommend whether to use a single automation, workflow, or network.",
    inputSchema: intentSchema,
    outputSchema: z.object({
        system: z.enum(["agent", "workflow", "network"]),
        reason: z.string(),
        normalized: z.object({
            trigger: z.enum(["event", "schedule", "on-demand"]).nullable(),
            outcomes: z.array(
                z.enum(["review", "categorize", "analyze", "action", "notify", "chain"])
            ),
            steps: z.number(),
            needsRouting: z.boolean(),
            needsParallel: z.boolean()
        })
    }),
    execute: async (input) => {
        return recommendWorkspaceSystem(input);
    }
});
