import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Turn Complete Tool
 *
 * Explicit termination signal for agentic loops. When an agent has this tool
 * in its tool set, the chat route enables the "finish tool" pattern:
 *   - toolChoice: "required" (model must call a tool every step)
 *   - stopWhen: hasToolCall("turn-complete") (loop ends on explicit signal)
 *   - prepareStep: forces turn-complete on the final step as a safety net
 *
 * The tool is a no-op in execution. Its value is structural:
 *   (a) prevents premature text-only termination
 *   (b) captures structured metadata (reason, next action, summary)
 */
export const turnCompleteTool = createTool({
    id: "turn-complete",
    description:
        "Signal that you have completed all useful work for this turn. " +
        "Call this ONLY when you have: (a) exhausted all productive tool calls, " +
        "(b) hit a genuine blocker requiring human input, or " +
        "(c) completed all queued work. " +
        "You MUST continue calling work tools until one of these conditions is met. " +
        "Do NOT call this just to report status -- do more work first.",
    inputSchema: z.object({
        reason: z
            .enum(["work_complete", "blocked", "needs_input"])
            .describe("Why this turn is ending"),
        nextAction: z
            .string()
            .describe(
                "Concrete proposal for what to do next, e.g. 'I will [X]. Say go to continue.'"
            ),
        summary: z.string().optional().describe("Brief summary of work accomplished this turn")
    }),
    outputSchema: z.object({
        completed: z.boolean()
    }),
    execute: async () => {
        return { completed: true };
    }
});
