import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { prisma, Prisma } from "@repo/database";

const toolChoiceSchema = z.union([
    z.literal("auto"),
    z.literal("required"),
    z.literal("none"),
    z.object({
        type: z.literal("tool"),
        toolName: z.string()
    })
]);

const agentToolBindingSchema = z.object({
    toolId: z.string(),
    config: z.record(z.any()).optional()
});

const agentCreateSchema = z
    .object({
        name: z.string(),
        slug: z.string().optional(),
        description: z.string().optional().nullable(),
        instructions: z.string(),
        instructionsTemplate: z.string().optional().nullable(),
        modelProvider: z.string(),
        modelName: z.string(),
        temperature: z.number().optional(),
        maxTokens: z.number().optional().nullable(),
        modelConfig: z.record(z.any()).optional().nullable(),
        extendedThinking: z.boolean().optional(),
        thinkingBudget: z.number().optional(),
        parallelToolCalls: z.boolean().optional(),
        reasoningEffort: z.enum(["low", "medium", "high"]).optional(),
        cacheControl: z.boolean().optional(),
        toolChoice: toolChoiceSchema.optional(),
        reasoning: z
            .object({
                type: z.enum(["enabled", "disabled"])
            })
            .optional(),
        memoryEnabled: z.boolean().optional(),
        memoryConfig: z.record(z.any()).optional().nullable(),
        maxSteps: z.number().optional(),
        subAgents: z.array(z.string()).optional(),
        workflows: z.array(z.string()).optional(),
        scorers: z.array(z.string()).optional(),
        toolIds: z.array(z.string()).optional(),
        tools: z.array(agentToolBindingSchema).optional(),
        type: z.enum(["USER", "SYSTEM"]).optional(),
        tenantId: z.string().optional().nullable(),
        workspaceId: z.string().optional().nullable(),
        ownerId: z.string().optional().nullable(),
        isPublic: z.boolean().optional(),
        requiresApproval: z.boolean().optional(),
        maxSpendUsd: z.number().optional().nullable(),
        metadata: z.record(z.any()).optional().nullable(),
        isActive: z.boolean().optional(),
        createdBy: z.string().optional().nullable()
    })
    .passthrough();

const agentReadSchema = z.object({
    agentId: z.string(),
    include: z
        .object({
            tools: z.boolean().optional(),
            versions: z.boolean().optional(),
            runs: z.boolean().optional(),
            schedules: z.boolean().optional(),
            triggers: z.boolean().optional()
        })
        .optional()
});

const agentUpdateSchema = z
    .object({
        agentId: z.string(),
        restoreVersionId: z.string().optional(),
        restoreVersion: z.number().optional(),
        versionDescription: z.string().optional(),
        createdBy: z.string().optional().nullable(),
        data: agentCreateSchema.partial().optional()
    })
    .passthrough();

const agentDeleteSchema = z.object({
    agentId: z.string(),
    mode: z.enum(["delete", "archive"]).optional()
});

type AgentToolBindingInput = z.infer<typeof agentToolBindingSchema>;

const generateSlug = (name: string) =>
    name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

const normalizeToolBindings = (input: {
    toolIds?: string[];
    tools?: AgentToolBindingInput[];
}): AgentToolBindingInput[] => {
    const bindings = new Map<string, AgentToolBindingInput>();

    if (Array.isArray(input.toolIds)) {
        input.toolIds.forEach((toolId) => {
            if (toolId) {
                bindings.set(toolId, { toolId });
            }
        });
    }

    if (Array.isArray(input.tools)) {
        input.tools.forEach((tool) => {
            if (!tool?.toolId) return;
            bindings.set(tool.toolId, {
                toolId: tool.toolId,
                config: tool.config
            });
        });
    }

    return Array.from(bindings.values());
};

const buildModelConfig = (
    baseConfig: Record<string, unknown> | null | undefined,
    overrides: {
        extendedThinking?: boolean;
        thinkingBudget?: number;
        parallelToolCalls?: boolean;
        reasoningEffort?: "low" | "medium" | "high";
        cacheControl?: boolean;
        toolChoice?: z.infer<typeof toolChoiceSchema>;
        reasoning?: { type: "enabled" | "disabled" };
    }
) => {
    const config = { ...(baseConfig || {}) } as Record<string, unknown>;

    if (overrides.extendedThinking !== undefined) {
        if (overrides.extendedThinking) {
            config.thinking = {
                type: "enabled",
                budget_tokens: overrides.thinkingBudget || 10000
            };
        } else {
            delete config.thinking;
        }
    }

    if (overrides.parallelToolCalls !== undefined) {
        config.parallelToolCalls = overrides.parallelToolCalls;
    }

    if (overrides.reasoningEffort !== undefined) {
        config.reasoningEffort = overrides.reasoningEffort;
    }

    if (overrides.cacheControl !== undefined) {
        if (overrides.cacheControl) {
            config.cacheControl = { type: "ephemeral" };
        } else {
            delete config.cacheControl;
        }
    }

    if (overrides.toolChoice !== undefined) {
        config.toolChoice = overrides.toolChoice;
    }

    if (overrides.reasoning !== undefined) {
        config.reasoning = overrides.reasoning;
    }

    return Object.keys(config).length > 0 ? config : null;
};

const buildAgentSnapshot = (agent: {
    name: string;
    description: string | null;
    instructions: string;
    instructionsTemplate: string | null;
    modelProvider: string;
    modelName: string;
    temperature: number | null;
    maxTokens: number | null;
    modelConfig: unknown;
    memoryEnabled: boolean;
    memoryConfig: unknown;
    maxSteps: number | null;
    subAgents: string[];
    workflows: string[];
    scorers: string[];
    tools: { toolId: string; config: unknown }[];
    isPublic: boolean;
    isActive: boolean;
    requiresApproval: boolean;
    maxSpendUsd: number | null;
    metadata: unknown;
}) => ({
    name: agent.name,
    description: agent.description,
    instructions: agent.instructions,
    instructionsTemplate: agent.instructionsTemplate,
    modelProvider: agent.modelProvider,
    modelName: agent.modelName,
    temperature: agent.temperature,
    maxTokens: agent.maxTokens,
    modelConfig: agent.modelConfig,
    memoryEnabled: agent.memoryEnabled,
    memoryConfig: agent.memoryConfig,
    maxSteps: agent.maxSteps,
    subAgents: agent.subAgents,
    workflows: agent.workflows,
    scorers: agent.scorers,
    tools: agent.tools.map((tool) => ({ toolId: tool.toolId, config: tool.config })),
    isPublic: agent.isPublic,
    isActive: agent.isActive,
    requiresApproval: agent.requiresApproval,
    maxSpendUsd: agent.maxSpendUsd,
    metadata: agent.metadata
});

export const agentCreateTool = createTool({
    id: "agent-create",
    description: "Create a new agent with full configuration and tool bindings.",
    inputSchema: agentCreateSchema,
    outputSchema: z.object({
        success: z.boolean(),
        agent: z.any()
    }),
    execute: async (input) => {
        const slug = input.slug || generateSlug(input.name);
        const existing = await prisma.agent.findUnique({ where: { slug } });
        if (existing) {
            throw new Error(`Agent with slug '${slug}' already exists`);
        }

        const modelConfig = buildModelConfig(input.modelConfig || null, {
            extendedThinking: input.extendedThinking,
            thinkingBudget: input.thinkingBudget,
            parallelToolCalls: input.parallelToolCalls,
            reasoningEffort: input.reasoningEffort,
            cacheControl: input.cacheControl,
            toolChoice: input.toolChoice,
            reasoning: input.reasoning
        });

        const agent = await prisma.agent.create({
            data: {
                slug,
                name: input.name,
                description: input.description ?? null,
                instructions: input.instructions,
                instructionsTemplate: input.instructionsTemplate ?? null,
                modelProvider: input.modelProvider,
                modelName: input.modelName,
                temperature: input.temperature ?? 0.7,
                maxTokens: input.maxTokens ?? null,
                modelConfig: modelConfig ? (modelConfig as Prisma.InputJsonValue) : Prisma.DbNull,
                memoryEnabled: input.memoryEnabled ?? false,
                memoryConfig:
                    input.memoryConfig !== undefined
                        ? (input.memoryConfig as Prisma.InputJsonValue)
                        : Prisma.DbNull,
                maxSteps: input.maxSteps ?? 5,
                subAgents: input.subAgents ?? [],
                workflows: input.workflows ?? [],
                scorers: input.scorers ?? [],
                type: input.type ?? "USER",
                tenantId: input.tenantId ?? null,
                workspaceId: input.workspaceId ?? null,
                ownerId: input.ownerId ?? null,
                isPublic: input.isPublic ?? false,
                requiresApproval: input.requiresApproval ?? false,
                maxSpendUsd: input.maxSpendUsd ?? null,
                metadata:
                    input.metadata !== undefined
                        ? (input.metadata as Prisma.InputJsonValue)
                        : Prisma.DbNull,
                isActive: input.isActive ?? true,
                createdBy: input.createdBy ?? null
            },
            include: { tools: true }
        });

        const toolBindings = normalizeToolBindings({
            toolIds: input.toolIds,
            tools: input.tools
        });

        if (toolBindings.length > 0) {
            await prisma.agentTool.createMany({
                data: toolBindings.map((tool) => ({
                    agentId: agent.id,
                    toolId: tool.toolId,
                    config:
                        tool.config !== undefined
                            ? (tool.config as Prisma.InputJsonValue)
                            : Prisma.DbNull
                }))
            });
        }

        const agentWithTools = await prisma.agent.findUnique({
            where: { id: agent.id },
            include: { tools: true }
        });

        return { success: true, agent: agentWithTools };
    }
});

export const agentReadTool = createTool({
    id: "agent-read",
    description: "Read an agent by ID or slug with optional related data.",
    inputSchema: agentReadSchema,
    outputSchema: z.object({
        success: z.boolean(),
        agent: z.any().optional(),
        versions: z.array(z.any()).optional(),
        runs: z.array(z.any()).optional(),
        schedules: z.array(z.any()).optional(),
        triggers: z.array(z.any()).optional()
    }),
    execute: async ({ agentId, include }) => {
        const includeConfig: Record<string, boolean> = {};
        const includeTools = include?.tools ?? true;

        if (includeTools) includeConfig.tools = true;
        if (include?.versions) includeConfig.versions = true;
        if (include?.runs) includeConfig.runs = true;
        if (include?.schedules) includeConfig.schedules = true;
        if (include?.triggers) includeConfig.triggers = true;

        const agent = await prisma.agent.findFirst({
            where: { OR: [{ slug: agentId }, { id: agentId }] },
            include: includeConfig
        });

        if (!agent) {
            throw new Error(`Agent '${agentId}' not found`);
        }

        const response: Record<string, unknown> = { success: true, agent };
        if (include?.versions) response.versions = agent.versions;
        if (include?.runs) response.runs = agent.runs;
        if (include?.schedules) response.schedules = agent.schedules;
        if (include?.triggers) response.triggers = agent.triggers;

        return response;
    }
});

export const agentUpdateTool = createTool({
    id: "agent-update",
    description: "Update an agent configuration with optional version restore.",
    inputSchema: agentUpdateSchema,
    outputSchema: z.object({
        success: z.boolean(),
        agent: z.any()
    }),
    execute: async ({
        agentId,
        restoreVersionId,
        restoreVersion,
        versionDescription,
        createdBy,
        data
    }) => {
        if (!data && !restoreVersionId && restoreVersion === undefined) {
            throw new Error("Update requires data or a restoreVersion value");
        }

        const existing = await prisma.agent.findFirst({
            where: { OR: [{ slug: agentId }, { id: agentId }] },
            include: { tools: true }
        });

        if (!existing) {
            throw new Error(`Agent '${agentId}' not found`);
        }

        if (existing.type === "SYSTEM") {
            throw new Error("SYSTEM agents cannot be modified");
        }

        let restoreSnapshot: Record<string, unknown> | null = null;
        if (restoreVersionId || restoreVersion !== undefined) {
            const versionRecord = await prisma.agentVersion.findFirst({
                where: {
                    agentId: existing.id,
                    ...(restoreVersionId ? { id: restoreVersionId } : { version: restoreVersion })
                }
            });

            if (!versionRecord) {
                throw new Error("Requested agent version not found");
            }

            restoreSnapshot = versionRecord.snapshot as Record<string, unknown>;
        }

        const payload = { ...(restoreSnapshot || {}), ...(data || {}) } as z.infer<
            typeof agentCreateSchema
        >;

        const toolBindings = normalizeToolBindings({
            toolIds: payload.toolIds,
            tools: payload.tools
        });

        const modelConfigBase =
            payload.modelConfig !== undefined
                ? payload.modelConfig || null
                : (existing.modelConfig as Record<string, unknown> | null);
        const modelConfig = buildModelConfig(modelConfigBase, {
            extendedThinking: payload.extendedThinking,
            thinkingBudget: payload.thinkingBudget,
            parallelToolCalls: payload.parallelToolCalls,
            reasoningEffort: payload.reasoningEffort,
            cacheControl: payload.cacheControl,
            toolChoice: payload.toolChoice,
            reasoning: payload.reasoning
        });

        const existingMemoryConfig = (existing.memoryConfig ??
            Prisma.DbNull) as Prisma.InputJsonValue;
        const existingMetadata = (existing.metadata ?? Prisma.DbNull) as Prisma.InputJsonValue;

        const updateData: Prisma.AgentUncheckedUpdateInput = {
            name: payload.name ?? existing.name,
            description: payload.description ?? existing.description,
            instructions: payload.instructions ?? existing.instructions,
            instructionsTemplate: payload.instructionsTemplate ?? existing.instructionsTemplate,
            modelProvider: payload.modelProvider ?? existing.modelProvider,
            modelName: payload.modelName ?? existing.modelName,
            temperature: payload.temperature ?? existing.temperature,
            maxTokens: payload.maxTokens ?? existing.maxTokens,
            modelConfig: modelConfig ? (modelConfig as Prisma.InputJsonValue) : Prisma.DbNull,
            memoryEnabled: payload.memoryEnabled ?? existing.memoryEnabled,
            memoryConfig:
                payload.memoryConfig !== undefined
                    ? (payload.memoryConfig as Prisma.InputJsonValue)
                    : existingMemoryConfig,
            maxSteps: payload.maxSteps ?? existing.maxSteps,
            subAgents: payload.subAgents ?? existing.subAgents,
            workflows: payload.workflows ?? existing.workflows,
            scorers: payload.scorers ?? existing.scorers,
            type: payload.type ?? existing.type,
            tenantId: payload.tenantId ?? existing.tenantId,
            workspaceId: payload.workspaceId ?? existing.workspaceId,
            ownerId: payload.ownerId ?? existing.ownerId,
            isPublic: payload.isPublic ?? existing.isPublic,
            requiresApproval: payload.requiresApproval ?? existing.requiresApproval,
            maxSpendUsd: payload.maxSpendUsd ?? existing.maxSpendUsd,
            metadata:
                payload.metadata !== undefined
                    ? (payload.metadata as Prisma.InputJsonValue)
                    : existingMetadata,
            isActive: payload.isActive ?? existing.isActive,
            createdBy: createdBy ?? existing.createdBy
        };

        const snapshot = buildAgentSnapshot(existing);
        const lastVersion = await prisma.agentVersion.findFirst({
            where: { agentId: existing.id },
            orderBy: { version: "desc" },
            select: { version: true }
        });
        const nextVersion = (lastVersion?.version || 0) + 1;

        await prisma.agentVersion.create({
            data: {
                agentId: existing.id,
                tenantId: existing.tenantId,
                version: nextVersion,
                description: versionDescription || "Agent update",
                instructions: existing.instructions,
                modelProvider: existing.modelProvider,
                modelName: existing.modelName,
                changesJson: versionDescription ? [versionDescription] : Prisma.DbNull,
                snapshot: snapshot as Prisma.InputJsonValue,
                createdBy: createdBy ?? null
            }
        });

        updateData.version = nextVersion;

        await prisma.agent.update({
            where: { id: existing.id },
            data: updateData
        });

        if (payload.toolIds !== undefined || payload.tools !== undefined || restoreSnapshot) {
            await prisma.agentTool.deleteMany({
                where: { agentId: existing.id }
            });

            if (toolBindings.length > 0) {
                await prisma.agentTool.createMany({
                    data: toolBindings.map((tool) => ({
                        agentId: existing.id,
                        toolId: tool.toolId,
                        config:
                            tool.config !== undefined
                                ? (tool.config as Prisma.InputJsonValue)
                                : Prisma.DbNull
                    }))
                });
            }
        }

        const updated = await prisma.agent.findUnique({
            where: { id: existing.id },
            include: { tools: true }
        });

        return { success: true, agent: updated };
    }
});

export const agentDeleteTool = createTool({
    id: "agent-delete",
    description: "Delete or archive an agent safely.",
    inputSchema: agentDeleteSchema,
    outputSchema: z.object({
        success: z.boolean(),
        message: z.string().optional()
    }),
    execute: async ({ agentId, mode }) => {
        const existing = await prisma.agent.findFirst({
            where: { OR: [{ slug: agentId }, { id: agentId }] }
        });

        if (!existing) {
            throw new Error(`Agent '${agentId}' not found`);
        }

        if (existing.type === "SYSTEM") {
            throw new Error("SYSTEM agents cannot be deleted");
        }

        const action = mode || "delete";

        if (action === "archive") {
            await prisma.agent.update({
                where: { id: existing.id },
                data: { isActive: false }
            });

            return { success: true, message: `Agent '${agentId}' archived` };
        }

        await prisma.agent.delete({ where: { id: existing.id } });
        return { success: true, message: `Agent '${agentId}' deleted` };
    }
});
