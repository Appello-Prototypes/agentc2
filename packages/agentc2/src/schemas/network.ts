import { z } from "zod";
import { modelProviderEnum } from "./agent";

const networkNodeSchema = z.object({
    id: z.string(),
    agentId: z.string().optional(),
    agentSlug: z.string().optional(),
    role: z.string().optional(),
    position: z
        .object({
            x: z.number(),
            y: z.number()
        })
        .optional()
});

const networkEdgeSchema = z.object({
    source: z.string(),
    target: z.string(),
    label: z.string().optional(),
    condition: z.string().optional()
});

export const networkTopologySchema = z
    .object({
        nodes: z.array(networkNodeSchema).optional(),
        edges: z.array(networkEdgeSchema).optional(),
        routingStrategy: z.enum(["sequential", "parallel", "conditional", "custom"]).optional()
    })
    .passthrough()
    .nullable()
    .optional();

export const networkCreateSchema = z.object({
    name: z.string().min(1).max(255),
    slug: z
        .string()
        .min(1)
        .max(128)
        .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/)
        .optional(),
    description: z.string().max(2000).optional(),
    instructions: z.string().min(1).max(100000),
    modelProvider: modelProviderEnum,
    modelName: z.string().min(1).max(255),
    temperature: z.number().min(0).max(2).optional(),
    topologyJson: networkTopologySchema,
    routingStrategy: z.enum(["sequential", "parallel", "conditional", "custom"]).optional(),
    memoryConfig: z.record(z.unknown()).optional(),
    maxSteps: z.number().int().min(1).max(500).optional(),
    isPublished: z.boolean().optional(),
    isActive: z.boolean().optional(),
    primitives: z.array(z.record(z.unknown())).optional()
});

export const networkUpdateSchema = networkCreateSchema.partial();
