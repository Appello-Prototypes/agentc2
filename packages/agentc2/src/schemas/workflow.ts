import { z } from "zod";

const workflowStepSchema = z.object({
    id: z.string(),
    type: z.string(),
    name: z.string().optional(),
    config: z.record(z.unknown()).optional(),
    position: z
        .object({
            x: z.number(),
            y: z.number()
        })
        .optional(),
    connections: z
        .array(
            z.object({
                targetId: z.string(),
                label: z.string().optional()
            })
        )
        .optional()
});

export const workflowDefinitionSchema = z
    .object({
        steps: z.array(workflowStepSchema).optional(),
        edges: z
            .array(
                z.object({
                    source: z.string(),
                    target: z.string(),
                    label: z.string().optional()
                })
            )
            .optional(),
        variables: z.record(z.unknown()).optional()
    })
    .passthrough()
    .nullable()
    .optional();

export const workflowCreateSchema = z.object({
    name: z.string().min(1).max(255),
    slug: z
        .string()
        .min(1)
        .max(128)
        .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/)
        .optional(),
    description: z.string().max(2000).optional(),
    definitionJson: workflowDefinitionSchema,
    isActive: z.boolean().optional()
});

export const workflowUpdateSchema = workflowCreateSchema.partial();
