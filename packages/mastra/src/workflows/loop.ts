import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

const processItemStep = createStep({
    id: "process-item",
    description: "Process a single item in the list",
    inputSchema: z.object({
        value: z.string(),
        index: z.number().optional()
    }),
    outputSchema: z.object({
        original: z.string(),
        processed: z.string(),
        length: z.number()
    }),
    execute: async ({ inputData }) => ({
        original: inputData.value,
        processed: inputData.value.toUpperCase().trim(),
        length: inputData.value.length
    })
});

const aggregateStep = createStep({
    id: "aggregate",
    description: "Aggregate all processed items",
    inputSchema: z.array(
        z.object({
            original: z.string(),
            processed: z.string(),
            length: z.number()
        })
    ),
    outputSchema: z.object({
        items: z.array(
            z.object({
                original: z.string(),
                processed: z.string()
            })
        ),
        count: z.number(),
        totalLength: z.number(),
        avgLength: z.number()
    }),
    execute: async ({ inputData }) => ({
        items: inputData.map((item) => ({
            original: item.original,
            processed: item.processed
        })),
        count: inputData.length,
        totalLength: inputData.reduce((sum, item) => sum + item.length, 0),
        avgLength:
            inputData.length > 0
                ? Math.round(
                      inputData.reduce((sum, item) => sum + item.length, 0) / inputData.length
                  )
                : 0
    })
});

const prepareStep = createStep({
    id: "prepare",
    description: "Prepare items for processing",
    inputSchema: z.object({
        items: z.array(z.string())
    }),
    outputSchema: z.array(
        z.object({
            value: z.string(),
            index: z.number()
        })
    ),
    execute: async ({ inputData }) => inputData.items.map((value, index) => ({ value, index }))
});

export const foreachWorkflow = createWorkflow({
    id: "foreach-loop",
    description: "Process each item in an array with optional parallel execution",
    inputSchema: z.object({
        items: z.array(z.string()).describe("Items to process")
    }),
    outputSchema: z.object({
        items: z.array(
            z.object({
                original: z.string(),
                processed: z.string()
            })
        ),
        count: z.number(),
        totalLength: z.number(),
        avgLength: z.number()
    })
})
    .then(prepareStep)
    .foreach(processItemStep, { concurrency: 3 })
    .then(aggregateStep)
    .commit();

const incrementStep = createStep({
    id: "increment",
    description: "Increment counter",
    inputSchema: z.object({
        count: z.number(),
        target: z.number()
    }),
    outputSchema: z.object({
        count: z.number(),
        target: z.number(),
        progress: z.number()
    }),
    execute: async ({ inputData }) => ({
        count: inputData.count + 1,
        target: inputData.target,
        progress: Math.round(((inputData.count + 1) / inputData.target) * 100)
    })
});

export const doWhileWorkflow = createWorkflow({
    id: "dowhile-loop",
    description: "Count up to a target using dowhile loop",
    inputSchema: z.object({
        count: z.number().default(0),
        target: z.number().describe("Target count to reach")
    }),
    outputSchema: z.object({
        count: z.number(),
        target: z.number(),
        progress: z.number()
    })
})
    .dowhile(incrementStep, async ({ inputData }) => inputData.count < inputData.target)
    .commit();
