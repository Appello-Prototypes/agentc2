import { z } from "zod";
import type { PlaybookManifest } from "./types";

const agentToolSnapshotSchema = z.object({
    toolId: z.string(),
    config: z.unknown().nullable()
});

const skillToolSnapshotSchema = z.object({
    toolId: z.string()
});

const testCaseSnapshotSchema = z.object({
    agentSlug: z.string(),
    name: z.string(),
    inputText: z.string(),
    expectedOutput: z.string().nullable(),
    tags: z.array(z.string())
});

const scorecardSnapshotSchema = z.object({
    agentSlug: z.string(),
    criteria: z.unknown(),
    version: z.number(),
    samplingRate: z.number(),
    auditorModel: z.string(),
    evaluateTurns: z.boolean()
});

const guardrailSnapshotSchema = z.object({
    agentSlug: z.string(),
    configJson: z.unknown(),
    version: z.number()
});

const documentSnapshotSchema = z.object({
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    content: z.string(),
    contentType: z.string(),
    category: z.string().nullable(),
    tags: z.array(z.string()),
    metadata: z.unknown().nullable(),
    version: z.number()
});

const skillSnapshotSchema = z.object({
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    instructions: z.string(),
    examples: z.string().nullable(),
    category: z.string().nullable(),
    tags: z.array(z.string()),
    metadata: z.unknown().nullable(),
    version: z.number(),
    tools: z.array(skillToolSnapshotSchema),
    documents: z.array(z.string())
});

const networkPrimitiveSnapshotSchema = z.object({
    primitiveType: z.string(),
    agentSlug: z.string().nullable(),
    workflowSlug: z.string().nullable(),
    toolId: z.string().nullable(),
    description: z.string().nullable(),
    position: z.unknown().nullable()
});

const networkSnapshotSchema = z.object({
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    instructions: z.string(),
    modelProvider: z.string(),
    modelName: z.string(),
    temperature: z.number().nullable(),
    topologyJson: z.unknown(),
    memoryConfig: z.unknown(),
    maxSteps: z.number(),
    version: z.number(),
    primitives: z.array(networkPrimitiveSnapshotSchema)
});

const workflowSnapshotSchema = z.object({
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    definitionJson: z.unknown(),
    inputSchemaJson: z.unknown().nullable(),
    outputSchemaJson: z.unknown().nullable(),
    maxSteps: z.number(),
    timeout: z.number().nullable(),
    retryConfig: z.unknown().nullable(),
    version: z.number()
});

const agentSnapshotSchema = z.object({
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    instructions: z.string(),
    instructionsTemplate: z.string().nullable(),
    modelProvider: z.string(),
    modelName: z.string(),
    temperature: z.number().nullable(),
    maxTokens: z.number().nullable(),
    modelConfig: z.unknown().nullable(),
    routingConfig: z.unknown().nullable(),
    contextConfig: z.unknown().nullable(),
    subAgents: z.array(z.string()),
    workflows: z.array(z.string()),
    memoryEnabled: z.boolean(),
    memoryConfig: z.unknown().nullable(),
    maxSteps: z.number().nullable(),
    scorers: z.array(z.string()),
    visibility: z.string(),
    requiresApproval: z.boolean(),
    maxSpendUsd: z.number().nullable(),
    autoVectorize: z.boolean(),
    deploymentMode: z.string().nullable(),
    metadata: z.unknown().nullable(),
    version: z.number(),
    tools: z.array(agentToolSnapshotSchema),
    skills: z.array(z.string()),
    guardrail: guardrailSnapshotSchema.nullable(),
    testCases: z.array(testCaseSnapshotSchema),
    scorecard: scorecardSnapshotSchema.nullable()
});

export const playbookManifestSchema = z.object({
    version: z.string(),
    agents: z.array(agentSnapshotSchema),
    skills: z.array(skillSnapshotSchema),
    documents: z.array(documentSnapshotSchema),
    workflows: z.array(workflowSnapshotSchema),
    networks: z.array(networkSnapshotSchema),
    guardrails: z.array(guardrailSnapshotSchema),
    testCases: z.array(testCaseSnapshotSchema),
    scorecards: z.array(scorecardSnapshotSchema),
    requiredIntegrations: z.array(z.string()),
    entryPoint: z.object({
        type: z.enum(["agent", "workflow", "network"]),
        slug: z.string()
    })
});

export function validateManifest(manifest: unknown): PlaybookManifest {
    return playbookManifestSchema.parse(manifest) as PlaybookManifest;
}

export function isValidManifest(manifest: unknown): manifest is PlaybookManifest {
    return playbookManifestSchema.safeParse(manifest).success;
}
