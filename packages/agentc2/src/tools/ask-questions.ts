import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Ask Questions Tool
 *
 * Presents structured questions to the user with clickable numbered options.
 * Supports multiple questions that paginate as "1 of 3".
 *
 * This is a "display" tool -- it returns its own input as the result.
 * The frontend detects this tool invocation and renders an interactive
 * question widget (InteractiveQuestions component) instead of a standard
 * tool call display.
 *
 * After calling this tool, the agent should STOP and wait for the user's
 * responses, which arrive as a new user message containing the selections.
 */
export const askQuestionsTool = createTool({
    id: "ask_questions",
    description:
        "Present structured questions to the user with clickable numbered options. " +
        "Use this instead of listing options in text when you need the user to choose " +
        "between specific options. Supports multiple questions that paginate as '1 of 3'. " +
        "After calling this tool, STOP and wait for the user's responses.",
    inputSchema: z.object({
        questions: z
            .array(
                z.object({
                    id: z.string().describe("Unique ID for this question (e.g., 'dashboard_type')"),
                    question: z.string().describe("The question text to display"),
                    options: z
                        .array(
                            z.object({
                                label: z.string().describe("Display label for the option"),
                                value: z.string().describe("Value returned when selected"),
                                recommended: z
                                    .boolean()
                                    .optional()
                                    .describe("Mark as recommended option")
                            })
                        )
                        .min(2)
                        .max(8)
                        .describe("Array of options (2-8)"),
                    allowFreeform: z
                        .boolean()
                        .default(true)
                        .describe("Whether to show a 'Something else' freeform input"),
                    allowSkip: z.boolean().default(true).describe("Whether to show a Skip button")
                })
            )
            .min(1)
            .max(5)
            .describe("Array of questions to present (1-5, paginated)")
    }),
    outputSchema: z.object({
        presented: z.boolean(),
        questionCount: z.number(),
        awaitingResponses: z.boolean()
    }),
    execute: async ({ questions }) => {
        // Display tool -- returns metadata indicating questions were presented.
        // The actual rendering happens client-side via InteractiveQuestions component.
        // The agent should stop after this and wait for the user's selection message.
        return {
            presented: true,
            questionCount: questions.length,
            awaitingResponses: true
        };
    }
});
