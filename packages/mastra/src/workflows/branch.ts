import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

const classifyStep = createStep({
    id: "classify",
    description: "Classify the input request type",
    inputSchema: z.object({
        request: z.string()
    }),
    outputSchema: z.object({
        request: z.string(),
        type: z.enum(["question", "command", "statement"]),
        confidence: z.number()
    }),
    execute: async ({ inputData }) => {
        const request = inputData.request.toLowerCase();
        let type: "question" | "command" | "statement" = "statement";

        if (
            request.includes("?") ||
            request.startsWith("what") ||
            request.startsWith("how") ||
            request.startsWith("why")
        ) {
            type = "question";
        } else if (
            request.startsWith("do") ||
            request.startsWith("please") ||
            request.includes("need to") ||
            request.includes("want to")
        ) {
            type = "command";
        }

        return { request: inputData.request, type, confidence: 0.85 };
    }
});

const handleQuestionStep = createStep({
    id: "handle-question",
    inputSchema: z.object({
        request: z.string(),
        type: z.enum(["question", "command", "statement"]),
        confidence: z.number()
    }),
    outputSchema: z.object({
        response: z.string(),
        action: z.string()
    }),
    execute: async ({ inputData }) => ({
        response: `I understand you're asking: "${inputData.request}". Let me find the answer...`,
        action: "search_and_answer"
    })
});

const handleCommandStep = createStep({
    id: "handle-command",
    inputSchema: z.object({
        request: z.string(),
        type: z.enum(["question", "command", "statement"]),
        confidence: z.number()
    }),
    outputSchema: z.object({
        response: z.string(),
        action: z.string()
    }),
    execute: async ({ inputData }) => ({
        response: `I'll help you with: "${inputData.request}". Processing your request...`,
        action: "execute_command"
    })
});

const handleStatementStep = createStep({
    id: "handle-statement",
    inputSchema: z.object({
        request: z.string(),
        type: z.enum(["question", "command", "statement"]),
        confidence: z.number()
    }),
    outputSchema: z.object({
        response: z.string(),
        action: z.string()
    }),
    execute: async ({ inputData }) => ({
        response: `I acknowledge: "${inputData.request}". How can I help further?`,
        action: "acknowledge_and_prompt"
    })
});

const finalizeStep = createStep({
    id: "finalize",
    inputSchema: z.object({
        "handle-question": z.object({ response: z.string(), action: z.string() }).optional(),
        "handle-command": z.object({ response: z.string(), action: z.string() }).optional(),
        "handle-statement": z.object({ response: z.string(), action: z.string() }).optional()
    }),
    outputSchema: z.object({
        response: z.string(),
        action: z.string(),
        branch: z.string()
    }),
    execute: async ({ inputData }) => {
        const result =
            inputData["handle-question"] ||
            inputData["handle-command"] ||
            inputData["handle-statement"];

        const branch = inputData["handle-question"]
            ? "question"
            : inputData["handle-command"]
              ? "command"
              : "statement";

        return {
            response: result?.response || "Unknown request type",
            action: result?.action || "none",
            branch
        };
    }
});

export const branchWorkflow = createWorkflow({
    id: "conditional-branch",
    description: "Route requests to different handlers based on type",
    inputSchema: z.object({
        request: z.string().describe("User request to process")
    }),
    outputSchema: z.object({
        response: z.string(),
        action: z.string(),
        branch: z.string()
    })
})
    .then(classifyStep)
    .branch([
        [async ({ inputData }) => inputData.type === "question", handleQuestionStep],
        [async ({ inputData }) => inputData.type === "command", handleCommandStep],
        [async ({ inputData }) => inputData.type === "statement", handleStatementStep]
    ])
    .then(finalizeStep)
    .commit();
