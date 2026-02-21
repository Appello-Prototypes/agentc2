import { z } from "zod";

export const modelConfigSchema = z
    .object({
        apiKey: z.string().optional(),
        baseUrl: z.string().url().optional(),
        maxRetries: z.number().int().min(0).max(10).optional(),
        timeout: z.number().int().min(1000).max(300000).optional()
    })
    .passthrough()
    .nullable()
    .optional();

export const memoryConfigSchema = z
    .object({
        lastMessages: z.number().int().min(1).max(200).optional(),
        semanticRecall: z
            .object({
                topK: z.number().int().min(1).max(50).optional(),
                messageRange: z.number().int().min(1).optional()
            })
            .optional(),
        workingMemory: z
            .object({
                enabled: z.boolean().optional()
            })
            .optional()
    })
    .passthrough()
    .nullable()
    .optional();

export const routingConfigSchema = z
    .object({
        model: z.string().optional(),
        rules: z
            .array(
                z.object({
                    condition: z.string(),
                    targetAgent: z.string()
                })
            )
            .optional()
    })
    .passthrough()
    .nullable()
    .optional();

export const contextConfigSchema = z
    .object({
        ragEnabled: z.boolean().optional(),
        ragTopK: z.number().int().min(1).max(50).optional(),
        ragMinScore: z.number().min(0).max(1).optional(),
        documentIds: z.array(z.string()).optional()
    })
    .passthrough()
    .nullable()
    .optional();

export const agentCreateSchema = z.object({
    name: z.string().min(1).max(255),
    slug: z
        .string()
        .min(1)
        .max(128)
        .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/)
        .optional(),
    description: z.string().max(2000).optional(),
    instructions: z.string().max(100000),
    instructionsTemplate: z.string().max(100000).nullable().optional(),
    modelProvider: z.enum(["openai", "anthropic"]),
    modelName: z.string().min(1).max(255),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().optional().nullable(),
    maxSteps: z.number().int().min(1).max(100).optional(),
    memoryEnabled: z.boolean().optional(),
    memoryConfig: memoryConfigSchema,
    modelConfig: modelConfigSchema,
    routingConfig: routingConfigSchema,
    contextConfig: contextConfigSchema,
    visibility: z.enum(["PRIVATE", "INTERNAL", "PUBLIC"]).optional(),
    tools: z.array(z.string()).optional(),
    scorers: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).nullable().optional()
});

export const agentUpdateSchema = agentCreateSchema.partial();

export const agentConfigSchema = {
    modelConfig: modelConfigSchema,
    memoryConfig: memoryConfigSchema,
    routingConfig: routingConfigSchema,
    contextConfig: contextConfigSchema
};
