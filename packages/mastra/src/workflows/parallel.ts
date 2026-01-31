import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

const formatStep = createStep({
    id: "format",
    description: "Format the input text to uppercase",
    inputSchema: z.object({
        text: z.string()
    }),
    outputSchema: z.object({
        formatted: z.string()
    }),
    execute: async ({ inputData }) => ({
        formatted: inputData.text.toUpperCase()
    })
});

const analyzeStep = createStep({
    id: "analyze",
    description: "Analyze text statistics",
    inputSchema: z.object({
        text: z.string()
    }),
    outputSchema: z.object({
        wordCount: z.number(),
        charCount: z.number(),
        avgWordLength: z.number()
    }),
    execute: async ({ inputData }) => {
        const words = inputData.text.split(/\s+/).filter((w) => w.length > 0);
        const wordCount = words.length;
        const charCount = inputData.text.length;
        const avgWordLength =
            wordCount > 0 ? words.reduce((sum, w) => sum + w.length, 0) / wordCount : 0;

        return {
            wordCount,
            charCount,
            avgWordLength: Math.round(avgWordLength * 10) / 10
        };
    }
});

const detectLanguageStep = createStep({
    id: "detect-language",
    description: "Detect the language of the text",
    inputSchema: z.object({
        text: z.string()
    }),
    outputSchema: z.object({
        language: z.string(),
        confidence: z.number()
    }),
    execute: async ({ inputData }) => {
        const hasEnglishPattern = /^[a-zA-Z\s.,!?]+$/.test(inputData.text);
        return {
            language: hasEnglishPattern ? "English" : "Unknown",
            confidence: hasEnglishPattern ? 0.95 : 0.5
        };
    }
});

const combineStep = createStep({
    id: "combine",
    description: "Combine results from parallel processing",
    inputSchema: z.object({
        format: z.object({ formatted: z.string() }),
        analyze: z.object({
            wordCount: z.number(),
            charCount: z.number(),
            avgWordLength: z.number()
        }),
        "detect-language": z.object({
            language: z.string(),
            confidence: z.number()
        })
    }),
    outputSchema: z.object({
        formatted: z.string(),
        stats: z.object({
            words: z.number(),
            characters: z.number(),
            avgWordLength: z.number()
        }),
        language: z.object({
            detected: z.string(),
            confidence: z.number()
        })
    }),
    execute: async ({ inputData }) => ({
        formatted: inputData["format"].formatted,
        stats: {
            words: inputData["analyze"].wordCount,
            characters: inputData["analyze"].charCount,
            avgWordLength: inputData["analyze"].avgWordLength
        },
        language: {
            detected: inputData["detect-language"].language,
            confidence: inputData["detect-language"].confidence
        }
    })
});

export const parallelWorkflow = createWorkflow({
    id: "parallel-processing",
    description: "Process text with parallel operations: format, analyze, and detect language",
    inputSchema: z.object({
        text: z.string().describe("Text to process")
    }),
    outputSchema: z.object({
        formatted: z.string(),
        stats: z.object({
            words: z.number(),
            characters: z.number(),
            avgWordLength: z.number()
        }),
        language: z.object({
            detected: z.string(),
            confidence: z.number()
        })
    })
})
    .parallel([formatStep, analyzeStep, detectLanguageStep])
    .then(combineStep)
    .commit();
