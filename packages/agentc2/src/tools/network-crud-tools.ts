import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { prisma, Prisma } from "@repo/database";
import { buildNetworkTopologyFromPrimitives, isNetworkTopologyEmpty } from "../networks/topology";

const generateSlug = (name: string) =>
    name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

const networkPrimitiveSchema = z.object({
    primitiveType: z.enum(["agent", "workflow", "tool"]),
    agentId: z.string().optional(),
    workflowId: z.string().optional(),
    toolId: z.string().optional(),
    description: z.string().optional(),
    position: z.record(z.any()).optional()
});

const networkTopologySchema = z
    .object({
        nodes: z.array(z.record(z.any())),
        edges: z.array(z.record(z.any())),
        viewport: z.record(z.any()).optional()
    })
    .passthrough();

const networkCreateSchema = z
    .object({
        name: z.string(),
        slug: z.string().optional(),
        description: z.string().optional().nullable(),
        instructions: z.string(),
        modelProvider: z.string(),
        modelName: z.string(),
        temperature: z.number().optional(),
        topologyJson: networkTopologySchema.optional(),
        memoryConfig: z.record(z.any()).optional(),
        maxSteps: z.number().optional(),
        isPublished: z.boolean().optional(),
        isActive: z.boolean().optional(),
        workspaceId: z.string().optional().nullable(),
        ownerId: z.string().optional().nullable(),
        type: z.enum(["USER", "SYSTEM"]).optional(),
        primitives: z.array(networkPrimitiveSchema).optional(),
        versionDescription: z.string().optional(),
        createdBy: z.string().optional().nullable()
    })
    .passthrough();

const networkReadSchema = z.object({
    networkId: z.string(),
    include: z
        .object({
            primitives: z.boolean().optional(),
            versions: z.boolean().optional(),
            runs: z.boolean().optional()
        })
        .optional()
});

const networkUpdateSchema = z
    .object({
        networkId: z.string(),
        restoreVersionId: z.string().optional(),
        restoreVersion: z.number().optional(),
        versionDescription: z.string().optional(),
        createdBy: z.string().optional().nullable(),
        data: networkCreateSchema.partial().optional()
    })
    .passthrough();

const networkDeleteSchema = z.object({
    networkId: z.string(),
    mode: z.enum(["delete", "archive"]).optional()
});

export const networkCreateTool = createTool({
    id: "network-create",
    description: "Create a network with routing instructions and primitives.",
    inputSchema: networkCreateSchema,
    outputSchema: z.object({
        success: z.boolean(),
        network: z.any()
    }),
    execute: async (input) => {
        const slug = input.slug || generateSlug(input.name);
        const existing = await prisma.network.findUnique({ where: { slug } });
        if (existing) {
            throw new Error(`Network slug '${slug}' already exists`);
        }

        const primitives = Array.isArray(input.primitives) ? input.primitives : [];
        const baseTopology = input.topologyJson || { nodes: [], edges: [] };
        const topologyJson = (
            primitives.length > 0 && isNetworkTopologyEmpty(baseTopology)
                ? buildNetworkTopologyFromPrimitives(primitives)
                : baseTopology
        ) as Prisma.InputJsonValue;

        const network = await prisma.network.create({
            data: {
                slug,
                name: input.name,
                description: input.description ?? null,
                instructions: input.instructions,
                modelProvider: input.modelProvider,
                modelName: input.modelName,
                temperature: input.temperature ?? 0.7,
                topologyJson,
                memoryConfig: (input.memoryConfig ?? {}) as Prisma.InputJsonValue,
                maxSteps: input.maxSteps ?? 10,
                isPublished: input.isPublished ?? false,
                isActive: input.isActive ?? true,
                workspaceId: input.workspaceId ?? null,
                ownerId: input.ownerId ?? null,
                type: input.type ?? "USER"
            }
        });

        if (primitives.length > 0) {
            await prisma.networkPrimitive.createMany({
                data: primitives.map((primitive) => ({
                    networkId: network.id,
                    primitiveType: primitive.primitiveType,
                    agentId: primitive.agentId ?? null,
                    workflowId: primitive.workflowId ?? null,
                    toolId: primitive.toolId ?? null,
                    description: primitive.description ?? null,
                    position:
                        primitive.position !== undefined
                            ? (primitive.position as Prisma.InputJsonValue)
                            : Prisma.DbNull
                }))
            });
        }

        await prisma.networkVersion.create({
            data: {
                networkId: network.id,
                version: 1,
                topologyJson,
                primitivesJson: primitives as Prisma.InputJsonValue,
                description: input.versionDescription || "Initial version",
                createdBy: input.createdBy ?? null
            }
        });

        return { success: true, network };
    }
});

export const networkReadTool = createTool({
    id: "network-read",
    description: "Read a network by ID or slug with optional related data.",
    inputSchema: networkReadSchema,
    outputSchema: z.object({
        success: z.boolean(),
        network: z.any().optional(),
        versions: z.array(z.any()).optional(),
        runs: z.array(z.any()).optional()
    }),
    execute: async ({ networkId, include }) => {
        const includeConfig: Record<string, boolean> = {};
        if (include?.primitives) includeConfig.primitives = true;
        if (include?.versions) includeConfig.versions = true;
        if (include?.runs) includeConfig.runs = true;

        const network = await prisma.network.findFirst({
            where: { OR: [{ slug: networkId }, { id: networkId }] },
            include: includeConfig
        });

        if (!network) {
            throw new Error(`Network '${networkId}' not found`);
        }

        const response: Record<string, unknown> = { success: true, network };
        if (include?.versions) response.versions = network.versions;
        if (include?.runs) response.runs = network.runs;

        return response;
    }
});

export const networkUpdateTool = createTool({
    id: "network-update",
    description:
        "Update a network topology or routing config with versioning and rollback support.",
    inputSchema: networkUpdateSchema,
    outputSchema: z.object({
        success: z.boolean(),
        network: z.any()
    }),
    execute: async ({
        networkId,
        restoreVersionId,
        restoreVersion,
        versionDescription,
        createdBy,
        data
    }) => {
        if (!data && !restoreVersionId && restoreVersion === undefined) {
            throw new Error("Update requires data or a restoreVersion value");
        }

        const existing = await prisma.network.findFirst({
            where: { OR: [{ slug: networkId }, { id: networkId }] },
            include: { primitives: true }
        });

        if (!existing) {
            throw new Error(`Network '${networkId}' not found`);
        }

        if (existing.type === "SYSTEM") {
            throw new Error("SYSTEM networks cannot be modified");
        }

        let restoreTopology: Record<string, unknown> | null = null;
        let restorePrimitives: z.infer<typeof networkPrimitiveSchema>[] | null = null;

        if (restoreVersionId || restoreVersion !== undefined) {
            const versionRecord = await prisma.networkVersion.findFirst({
                where: {
                    networkId: existing.id,
                    ...(restoreVersionId ? { id: restoreVersionId } : { version: restoreVersion })
                }
            });

            if (!versionRecord) {
                throw new Error("Requested network version not found");
            }

            restoreTopology = versionRecord.topologyJson as Record<string, unknown>;
            restorePrimitives = versionRecord.primitivesJson as z.infer<
                typeof networkPrimitiveSchema
            >[];
        }

        const payload = { ...(data || {}) };
        const topologySource = restoreTopology || payload.topologyJson || existing.topologyJson;
        const nextPrimitives =
            restorePrimitives ||
            (Array.isArray(payload.primitives) ? payload.primitives : existing.primitives);
        const shouldAutoGenerate =
            Array.isArray(nextPrimitives) &&
            nextPrimitives.length > 0 &&
            isNetworkTopologyEmpty(topologySource);
        const nextTopology = (
            shouldAutoGenerate ? buildNetworkTopologyFromPrimitives(nextPrimitives) : topologySource
        ) as Prisma.InputJsonValue;

        const updateData: Record<string, unknown> = {
            name: payload.name ?? existing.name,
            description: payload.description ?? existing.description,
            instructions: payload.instructions ?? existing.instructions,
            modelProvider: payload.modelProvider ?? existing.modelProvider,
            modelName: payload.modelName ?? existing.modelName,
            temperature: payload.temperature ?? existing.temperature,
            topologyJson: nextTopology,
            memoryConfig:
                payload.memoryConfig !== undefined
                    ? (payload.memoryConfig as Prisma.InputJsonValue)
                    : (existing.memoryConfig as Prisma.InputJsonValue),
            maxSteps: payload.maxSteps ?? existing.maxSteps,
            isPublished: payload.isPublished ?? existing.isPublished,
            isActive: payload.isActive ?? existing.isActive,
            workspaceId: payload.workspaceId ?? existing.workspaceId,
            ownerId: payload.ownerId ?? existing.ownerId,
            type: payload.type ?? existing.type
        };

        const topologyChanged =
            restoreTopology !== null ||
            shouldAutoGenerate ||
            (payload.topologyJson !== undefined &&
                JSON.stringify(existing.topologyJson) !== JSON.stringify(payload.topologyJson));

        const primitivesChanged = restorePrimitives !== null || Array.isArray(payload.primitives);

        if (topologyChanged || primitivesChanged) {
            const lastVersion = await prisma.networkVersion.findFirst({
                where: { networkId: existing.id },
                orderBy: { version: "desc" },
                select: { version: true }
            });
            const nextVersion = (lastVersion?.version || 0) + 1;
            updateData.version = nextVersion;

            await prisma.networkVersion.create({
                data: {
                    networkId: existing.id,
                    version: nextVersion,
                    topologyJson: nextTopology,
                    primitivesJson: nextPrimitives as Prisma.InputJsonValue,
                    description: versionDescription || "Topology update",
                    createdBy: createdBy ?? null
                }
            });
        }

        const network = await prisma.network.update({
            where: { id: existing.id },
            data: updateData
        });

        if (Array.isArray(payload.primitives) || restorePrimitives) {
            await prisma.networkPrimitive.deleteMany({
                where: { networkId: existing.id }
            });

            if (Array.isArray(nextPrimitives) && nextPrimitives.length > 0) {
                await prisma.networkPrimitive.createMany({
                    data: nextPrimitives.map((primitive) => ({
                        networkId: existing.id,
                        primitiveType: primitive.primitiveType,
                        agentId: primitive.agentId ?? null,
                        workflowId: primitive.workflowId ?? null,
                        toolId: primitive.toolId ?? null,
                        description: primitive.description ?? null,
                        position:
                            primitive.position !== undefined
                                ? (primitive.position as Prisma.InputJsonValue)
                                : Prisma.DbNull
                    }))
                });
            }
        }

        return { success: true, network };
    }
});

export const networkDeleteTool = createTool({
    id: "network-delete",
    description: "Delete or archive a network safely.",
    inputSchema: networkDeleteSchema,
    outputSchema: z.object({
        success: z.boolean(),
        message: z.string().optional()
    }),
    execute: async ({ networkId, mode }) => {
        const existing = await prisma.network.findFirst({
            where: { OR: [{ slug: networkId }, { id: networkId }] }
        });

        if (!existing) {
            throw new Error(`Network '${networkId}' not found`);
        }

        if (existing.type === "SYSTEM") {
            throw new Error("SYSTEM networks cannot be deleted");
        }

        const action = mode || "delete";

        if (action === "archive") {
            await prisma.network.update({
                where: { id: existing.id },
                data: { isActive: false, isPublished: false }
            });

            return { success: true, message: `Network '${networkId}' archived` };
        }

        await prisma.network.delete({ where: { id: existing.id } });
        return { success: true, message: `Network '${networkId}' deleted` };
    }
});
