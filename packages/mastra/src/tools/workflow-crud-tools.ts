import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { prisma, Prisma } from "@repo/database";

const generateSlug = (name: string) =>
    name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

const workflowDefinitionSchema = z.object({
    steps: z.array(
        z.object({
            id: z.string(),
            type: z.string(),
            name: z.string().optional(),
            description: z.string().optional(),
            inputMapping: z.record(z.any()).optional(),
            config: z.record(z.any()).optional()
        })
    )
});

const workflowCreateSchema = z
    .object({
        name: z.string(),
        slug: z.string().optional(),
        description: z.string().optional().nullable(),
        definitionJson: workflowDefinitionSchema.optional(),
        compiledJson: z.record(z.any()).optional().nullable(),
        compiledAt: z.string().optional().nullable(),
        compiledHash: z.string().optional().nullable(),
        inputSchemaJson: z.record(z.any()).optional().nullable(),
        outputSchemaJson: z.record(z.any()).optional().nullable(),
        maxSteps: z.number().optional(),
        timeout: z.number().optional().nullable(),
        retryConfig: z.record(z.any()).optional().nullable(),
        isPublished: z.boolean().optional(),
        isActive: z.boolean().optional(),
        workspaceId: z.string().optional().nullable(),
        ownerId: z.string().optional().nullable(),
        type: z.enum(["USER", "SYSTEM"]).optional(),
        versionDescription: z.string().optional(),
        createdBy: z.string().optional().nullable()
    })
    .passthrough();

const workflowReadSchema = z.object({
    workflowId: z.string(),
    include: z
        .object({
            versions: z.boolean().optional(),
            runs: z.boolean().optional()
        })
        .optional()
});

const workflowUpdateSchema = z
    .object({
        workflowId: z.string(),
        restoreVersionId: z.string().optional(),
        restoreVersion: z.number().optional(),
        versionDescription: z.string().optional(),
        createdBy: z.string().optional().nullable(),
        data: workflowCreateSchema.partial().optional()
    })
    .passthrough();

const workflowDeleteSchema = z.object({
    workflowId: z.string(),
    mode: z.enum(["delete", "archive"]).optional()
});

export const workflowCreateTool = createTool({
    id: "workflow-create",
    description: "Create a workflow definition with full configuration.",
    inputSchema: workflowCreateSchema,
    outputSchema: z.object({
        success: z.boolean(),
        workflow: z.any()
    }),
    execute: async (input) => {
        const slug = input.slug || generateSlug(input.name);
        const existing = await prisma.workflow.findUnique({ where: { slug } });
        if (existing) {
            throw new Error(`Workflow slug '${slug}' already exists`);
        }

        const definitionJson = (input.definitionJson || { steps: [] }) as Prisma.InputJsonValue;

        const workflow = await prisma.workflow.create({
            data: {
                slug,
                name: input.name,
                description: input.description ?? null,
                definitionJson,
                compiledJson:
                    input.compiledJson !== undefined
                        ? (input.compiledJson as Prisma.InputJsonValue)
                        : Prisma.DbNull,
                compiledAt: input.compiledAt ? new Date(input.compiledAt) : null,
                compiledHash: input.compiledHash ?? null,
                inputSchemaJson:
                    input.inputSchemaJson !== undefined
                        ? (input.inputSchemaJson as Prisma.InputJsonValue)
                        : Prisma.DbNull,
                outputSchemaJson:
                    input.outputSchemaJson !== undefined
                        ? (input.outputSchemaJson as Prisma.InputJsonValue)
                        : Prisma.DbNull,
                maxSteps: input.maxSteps ?? 50,
                timeout: input.timeout ?? null,
                retryConfig:
                    input.retryConfig !== undefined
                        ? (input.retryConfig as Prisma.InputJsonValue)
                        : Prisma.DbNull,
                isPublished: input.isPublished ?? false,
                isActive: input.isActive ?? true,
                workspaceId: input.workspaceId ?? null,
                ownerId: input.ownerId ?? null,
                type: input.type ?? "USER"
            }
        });

        await prisma.workflowVersion.create({
            data: {
                workflowId: workflow.id,
                version: 1,
                definitionJson,
                description: input.versionDescription || "Initial version",
                createdBy: input.createdBy ?? null
            }
        });

        return { success: true, workflow };
    }
});

export const workflowReadTool = createTool({
    id: "workflow-read",
    description: "Read a workflow by ID or slug with optional related data.",
    inputSchema: workflowReadSchema,
    outputSchema: z.object({
        success: z.boolean(),
        workflow: z.any().optional(),
        versions: z.array(z.any()).optional(),
        runs: z.array(z.any()).optional()
    }),
    execute: async ({ workflowId, include }) => {
        const includeConfig: Record<string, boolean> = {};
        if (include?.versions) includeConfig.versions = true;
        if (include?.runs) includeConfig.runs = true;

        const workflow = await prisma.workflow.findFirst({
            where: { OR: [{ slug: workflowId }, { id: workflowId }] },
            include: includeConfig
        });

        if (!workflow) {
            throw new Error(`Workflow '${workflowId}' not found`);
        }

        const response: Record<string, unknown> = { success: true, workflow };
        if (include?.versions) response.versions = workflow.versions;
        if (include?.runs) response.runs = workflow.runs;

        return response;
    }
});

export const workflowUpdateTool = createTool({
    id: "workflow-update",
    description: "Update a workflow definition with versioning and rollback support.",
    inputSchema: workflowUpdateSchema,
    outputSchema: z.object({
        success: z.boolean(),
        workflow: z.any()
    }),
    execute: async ({
        workflowId,
        restoreVersionId,
        restoreVersion,
        versionDescription,
        createdBy,
        data
    }) => {
        if (!data && !restoreVersionId && restoreVersion === undefined) {
            throw new Error("Update requires data or a restoreVersion value");
        }

        const existing = await prisma.workflow.findFirst({
            where: { OR: [{ slug: workflowId }, { id: workflowId }] }
        });

        if (!existing) {
            throw new Error(`Workflow '${workflowId}' not found`);
        }

        if (existing.type === "SYSTEM") {
            throw new Error("SYSTEM workflows cannot be modified");
        }

        let restoreDefinition: Prisma.InputJsonValue | null = null;
        if (restoreVersionId || restoreVersion !== undefined) {
            const versionRecord = await prisma.workflowVersion.findFirst({
                where: {
                    workflowId: existing.id,
                    ...(restoreVersionId ? { id: restoreVersionId } : { version: restoreVersion })
                }
            });

            if (!versionRecord) {
                throw new Error("Requested workflow version not found");
            }

            restoreDefinition = versionRecord.definitionJson as Prisma.InputJsonValue;
        }

        const payload = { ...(data || {}) };
        const nextDefinition = (restoreDefinition ||
            payload.definitionJson ||
            existing.definitionJson) as Prisma.InputJsonValue;

        const existingCompiledJson = (existing.compiledJson ??
            Prisma.DbNull) as Prisma.InputJsonValue;
        const existingInputSchema = (existing.inputSchemaJson ??
            Prisma.DbNull) as Prisma.InputJsonValue;
        const existingOutputSchema = (existing.outputSchemaJson ??
            Prisma.DbNull) as Prisma.InputJsonValue;
        const existingRetryConfig = (existing.retryConfig ??
            Prisma.DbNull) as Prisma.InputJsonValue;

        const updateData: Record<string, unknown> = {
            name: payload.name ?? existing.name,
            description: payload.description ?? existing.description,
            definitionJson: nextDefinition,
            compiledJson:
                payload.compiledJson !== undefined
                    ? (payload.compiledJson as Prisma.InputJsonValue)
                    : existingCompiledJson,
            compiledAt: payload.compiledAt ? new Date(payload.compiledAt) : existing.compiledAt,
            compiledHash: payload.compiledHash ?? existing.compiledHash,
            inputSchemaJson:
                payload.inputSchemaJson !== undefined
                    ? (payload.inputSchemaJson as Prisma.InputJsonValue)
                    : existingInputSchema,
            outputSchemaJson:
                payload.outputSchemaJson !== undefined
                    ? (payload.outputSchemaJson as Prisma.InputJsonValue)
                    : existingOutputSchema,
            maxSteps: payload.maxSteps ?? existing.maxSteps,
            timeout: payload.timeout ?? existing.timeout,
            retryConfig:
                payload.retryConfig !== undefined
                    ? (payload.retryConfig as Prisma.InputJsonValue)
                    : existingRetryConfig,
            isPublished: payload.isPublished ?? existing.isPublished,
            isActive: payload.isActive ?? existing.isActive,
            workspaceId: payload.workspaceId ?? existing.workspaceId,
            ownerId: payload.ownerId ?? existing.ownerId,
            type: payload.type ?? existing.type
        };

        const definitionChanged =
            restoreDefinition !== null ||
            (payload.definitionJson !== undefined &&
                JSON.stringify(existing.definitionJson) !== JSON.stringify(payload.definitionJson));

        if (definitionChanged) {
            const lastVersion = await prisma.workflowVersion.findFirst({
                where: { workflowId: existing.id },
                orderBy: { version: "desc" },
                select: { version: true }
            });
            const nextVersion = (lastVersion?.version || 0) + 1;
            updateData.version = nextVersion;

            await prisma.workflowVersion.create({
                data: {
                    workflowId: existing.id,
                    version: nextVersion,
                    definitionJson: nextDefinition,
                    description: versionDescription || "Definition update",
                    createdBy: createdBy ?? null
                }
            });
        }

        const workflow = await prisma.workflow.update({
            where: { id: existing.id },
            data: updateData
        });

        return { success: true, workflow };
    }
});

export const workflowDeleteTool = createTool({
    id: "workflow-delete",
    description: "Delete or archive a workflow safely.",
    inputSchema: workflowDeleteSchema,
    outputSchema: z.object({
        success: z.boolean(),
        message: z.string().optional()
    }),
    execute: async ({ workflowId, mode }) => {
        const existing = await prisma.workflow.findFirst({
            where: { OR: [{ slug: workflowId }, { id: workflowId }] }
        });

        if (!existing) {
            throw new Error(`Workflow '${workflowId}' not found`);
        }

        if (existing.type === "SYSTEM") {
            throw new Error("SYSTEM workflows cannot be deleted");
        }

        const action = mode || "delete";

        if (action === "archive") {
            await prisma.workflow.update({
                where: { id: existing.id },
                data: { isActive: false, isPublished: false }
            });

            return { success: true, message: `Workflow '${workflowId}' archived` };
        }

        await prisma.workflow.delete({ where: { id: existing.id } });
        return { success: true, message: `Workflow '${workflowId}' deleted` };
    }
});
