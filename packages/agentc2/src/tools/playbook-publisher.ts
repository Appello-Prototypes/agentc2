import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { prisma } from "@repo/database";

const baseOutputSchema = z.object({ success: z.boolean().optional() }).passthrough();

async function requirePlaybookOwner(slug: string, organizationId: string) {
    const playbook = await prisma.playbook.findUnique({
        where: { slug },
        select: { id: true, publisherOrgId: true }
    });
    if (!playbook) throw new Error(`Playbook not found: ${slug}`);
    if (playbook.publisherOrgId !== organizationId) {
        throw new Error("Not authorized: you do not own this playbook");
    }
    return playbook;
}

export const playbookListMineTool = createTool({
    id: "playbook-list-mine",
    description: "List playbooks published by the caller's organization.",
    inputSchema: z.object({
        organizationId: z.string().describe("Publisher organization ID")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ organizationId }) => {
        const playbooks = await prisma.playbook.findMany({
            where: { publisherOrgId: organizationId },
            orderBy: { updatedAt: "desc" },
            select: {
                id: true,
                slug: true,
                name: true,
                status: true,
                category: true,
                version: true,
                installCount: true,
                averageRating: true,
                autoBootEnabled: true,
                pricingModel: true,
                updatedAt: true,
                _count: { select: { components: true, bootTasks: true } }
            }
        });

        return {
            success: true,
            playbooks: playbooks.map((p) => ({
                id: p.id,
                slug: p.slug,
                name: p.name,
                status: p.status,
                category: p.category,
                version: p.version,
                installCount: p.installCount,
                averageRating: p.averageRating,
                autoBootEnabled: p.autoBootEnabled,
                pricingModel: p.pricingModel,
                componentCount: p._count.components,
                bootTaskCount: p._count.bootTasks,
                updatedAt: p.updatedAt
            })),
            total: playbooks.length
        };
    }
});

export const playbookGetFullTool = createTool({
    id: "playbook-get-full",
    description:
        "Get full publisher view of a playbook: metadata, boot document, boot tasks, components, versions, and latest manifest.",
    inputSchema: z.object({
        slug: z.string().describe("Playbook slug")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ slug }) => {
        const playbook = await prisma.playbook.findUnique({
            where: { slug },
            include: {
                publisherOrg: { select: { id: true, name: true, slug: true } },
                components: {
                    orderBy: { sortOrder: "asc" },
                    select: {
                        id: true,
                        componentType: true,
                        sourceSlug: true,
                        isEntryPoint: true,
                        sortOrder: true
                    }
                },
                versions: {
                    orderBy: { version: "desc" },
                    take: 10,
                    select: {
                        id: true,
                        version: true,
                        changelog: true,
                        createdAt: true
                    }
                },
                bootTasks: {
                    orderBy: { sortOrder: "asc" }
                },
                _count: {
                    select: { installations: true, reviews: true }
                }
            }
        });

        if (!playbook) {
            return { success: false, error: "Playbook not found" };
        }

        return {
            success: true,
            playbook: {
                id: playbook.id,
                slug: playbook.slug,
                name: playbook.name,
                tagline: playbook.tagline,
                description: playbook.description,
                longDescription: playbook.longDescription,
                category: playbook.category,
                tags: playbook.tags,
                coverImageUrl: playbook.coverImageUrl,
                iconUrl: playbook.iconUrl,
                status: playbook.status,
                pricingModel: playbook.pricingModel,
                priceUsd: playbook.priceUsd,
                monthlyPriceUsd: playbook.monthlyPriceUsd,
                perUsePriceUsd: playbook.perUsePriceUsd,
                installCount: playbook.installCount,
                averageRating: playbook.averageRating,
                reviewCount: playbook._count.reviews,
                trustScore: playbook.trustScore,
                requiredIntegrations: playbook.requiredIntegrations,
                version: playbook.version,
                autoBootEnabled: playbook.autoBootEnabled,
                bootDocument: playbook.bootDocument,
                publisherOrg: playbook.publisherOrg,
                components: playbook.components,
                versions: playbook.versions,
                bootTasks: playbook.bootTasks.map((t) => ({
                    id: t.id,
                    title: t.title,
                    description: t.description,
                    priority: t.priority,
                    tags: t.tags,
                    sortOrder: t.sortOrder
                })),
                installationCount: playbook._count.installations
            }
        };
    }
});

export const playbookUpdateMetadataTool = createTool({
    id: "playbook-update-metadata",
    description:
        "Update playbook metadata: name, tagline, description, longDescription, category, tags, pricing, images.",
    inputSchema: z.object({
        slug: z.string().describe("Playbook slug"),
        organizationId: z.string().describe("Publisher organization ID"),
        name: z.string().optional(),
        tagline: z.string().optional(),
        description: z.string().optional(),
        longDescription: z.string().optional(),
        category: z.string().optional(),
        tags: z.array(z.string()).optional(),
        coverImageUrl: z.string().optional(),
        iconUrl: z.string().optional(),
        pricingModel: z.enum(["FREE", "ONE_TIME", "SUBSCRIPTION", "PER_USE"]).optional(),
        priceUsd: z.number().optional(),
        monthlyPriceUsd: z.number().optional(),
        perUsePriceUsd: z.number().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({
        slug,
        organizationId,
        name,
        tagline,
        description,
        longDescription,
        category,
        tags,
        coverImageUrl,
        iconUrl,
        pricingModel,
        priceUsd,
        monthlyPriceUsd,
        perUsePriceUsd
    }) => {
        await requirePlaybookOwner(slug, organizationId);

        const updated = await prisma.playbook.update({
            where: { slug },
            data: {
                name: name ?? undefined,
                tagline: tagline ?? undefined,
                description: description ?? undefined,
                longDescription: longDescription ?? undefined,
                category: category ?? undefined,
                tags: tags ?? undefined,
                coverImageUrl: coverImageUrl ?? undefined,
                iconUrl: iconUrl ?? undefined,
                pricingModel: pricingModel ?? undefined,
                priceUsd: priceUsd ?? undefined,
                monthlyPriceUsd: monthlyPriceUsd ?? undefined,
                perUsePriceUsd: perUsePriceUsd ?? undefined
            }
        });

        return {
            success: true,
            playbook: {
                slug: updated.slug,
                name: updated.name,
                status: updated.status,
                category: updated.category,
                pricingModel: updated.pricingModel
            }
        };
    }
});

export const playbookGetBootDocumentTool = createTool({
    id: "playbook-get-boot-document",
    description: "Get the boot document (markdown runbook) for a playbook.",
    inputSchema: z.object({
        slug: z.string().describe("Playbook slug")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ slug }) => {
        const playbook = await prisma.playbook.findUnique({
            where: { slug },
            select: { bootDocument: true, autoBootEnabled: true }
        });
        if (!playbook) {
            return { success: false, error: "Playbook not found" };
        }
        return {
            success: true,
            bootDocument: playbook.bootDocument,
            autoBootEnabled: playbook.autoBootEnabled
        };
    }
});

export const playbookSetBootDocumentTool = createTool({
    id: "playbook-set-boot-document",
    description:
        "Create or update the boot document (markdown runbook) for a playbook. This document is embedded into RAG on deploy and read by the agent to self-configure.",
    inputSchema: z.object({
        slug: z.string().describe("Playbook slug"),
        organizationId: z.string().describe("Publisher organization ID"),
        content: z.string().describe("Boot document content in markdown format")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ slug, organizationId, content }) => {
        await requirePlaybookOwner(slug, organizationId);

        await prisma.playbook.update({
            where: { slug },
            data: { bootDocument: content }
        });

        return {
            success: true,
            message: `Boot document updated (${content.length} characters)`
        };
    }
});

export const playbookAddBootTaskTool = createTool({
    id: "playbook-add-boot-task",
    description:
        "Add a structural boot task template to a playbook. These tasks are created as BacklogTasks on the deployed agent when the playbook is installed.",
    inputSchema: z.object({
        slug: z.string().describe("Playbook slug"),
        organizationId: z.string().describe("Publisher organization ID"),
        title: z.string().describe("Boot task title"),
        description: z.string().optional().describe("Detailed task description"),
        priority: z.number().min(0).max(10).optional().describe("Priority 0-10 (default: 5)"),
        tags: z.array(z.string()).optional().describe("Tags for categorization")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ slug, organizationId, title, description, priority, tags }) => {
        const playbook = await requirePlaybookOwner(slug, organizationId);

        const maxSort = await prisma.playbookBootTask.aggregate({
            where: { playbookId: playbook.id },
            _max: { sortOrder: true }
        });

        const task = await prisma.playbookBootTask.create({
            data: {
                playbookId: playbook.id,
                title,
                description,
                priority: priority ?? 5,
                tags: tags ?? [],
                sortOrder: (maxSort._max.sortOrder ?? -1) + 1
            }
        });

        return {
            success: true,
            task: {
                id: task.id,
                title: task.title,
                description: task.description,
                priority: task.priority,
                tags: task.tags,
                sortOrder: task.sortOrder
            }
        };
    }
});

export const playbookListBootTasksTool = createTool({
    id: "playbook-list-boot-tasks",
    description: "List all boot task templates for a playbook, ordered by sortOrder.",
    inputSchema: z.object({
        slug: z.string().describe("Playbook slug")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ slug }) => {
        const playbook = await prisma.playbook.findUnique({
            where: { slug },
            select: { id: true }
        });
        if (!playbook) {
            return { success: false, error: "Playbook not found" };
        }

        const tasks = await prisma.playbookBootTask.findMany({
            where: { playbookId: playbook.id },
            orderBy: { sortOrder: "asc" }
        });

        return {
            success: true,
            tasks: tasks.map((t) => ({
                id: t.id,
                title: t.title,
                description: t.description,
                priority: t.priority,
                tags: t.tags,
                sortOrder: t.sortOrder
            })),
            total: tasks.length
        };
    }
});

export const playbookUpdateBootTaskTool = createTool({
    id: "playbook-update-boot-task",
    description: "Update a boot task template: title, description, priority, tags, sortOrder.",
    inputSchema: z.object({
        taskId: z.string().describe("Boot task ID"),
        organizationId: z.string().describe("Publisher organization ID"),
        title: z.string().optional(),
        description: z.string().optional(),
        priority: z.number().min(0).max(10).optional(),
        tags: z.array(z.string()).optional(),
        sortOrder: z.number().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ taskId, organizationId, title, description, priority, tags, sortOrder }) => {
        const task = await prisma.playbookBootTask.findUnique({
            where: { id: taskId },
            include: { playbook: { select: { publisherOrgId: true } } }
        });
        if (!task) throw new Error(`Boot task not found: ${taskId}`);
        if (task.playbook.publisherOrgId !== organizationId) {
            throw new Error("Not authorized: you do not own this playbook");
        }

        const updated = await prisma.playbookBootTask.update({
            where: { id: taskId },
            data: {
                title: title ?? undefined,
                description: description ?? undefined,
                priority: priority ?? undefined,
                tags: tags ?? undefined,
                sortOrder: sortOrder ?? undefined
            }
        });

        return {
            success: true,
            task: {
                id: updated.id,
                title: updated.title,
                description: updated.description,
                priority: updated.priority,
                tags: updated.tags,
                sortOrder: updated.sortOrder
            }
        };
    }
});

export const playbookRemoveBootTaskTool = createTool({
    id: "playbook-remove-boot-task",
    description: "Delete a boot task template from a playbook.",
    inputSchema: z.object({
        taskId: z.string().describe("Boot task ID to remove"),
        organizationId: z.string().describe("Publisher organization ID")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ taskId, organizationId }) => {
        const task = await prisma.playbookBootTask.findUnique({
            where: { id: taskId },
            include: { playbook: { select: { publisherOrgId: true } } }
        });
        if (!task) throw new Error(`Boot task not found: ${taskId}`);
        if (task.playbook.publisherOrgId !== organizationId) {
            throw new Error("Not authorized: you do not own this playbook");
        }

        await prisma.playbookBootTask.delete({ where: { id: taskId } });

        return { success: true, message: `Boot task "${task.title}" deleted` };
    }
});

export const playbookPackageTool = createTool({
    id: "playbook-package",
    description:
        "Trigger packaging of a playbook: snapshots the agent system into a new version. " +
        "Modes: 'full' (re-snapshot everything), 'components-only' (re-snapshot components, keep boot config), " +
        "'boot-only' (keep components, update boot config only).",
    inputSchema: z.object({
        slug: z.string().describe("Playbook slug"),
        organizationId: z.string().describe("Publisher organization ID"),
        userId: z.string().describe("User triggering the package"),
        entryType: z
            .enum(["agent", "workflow", "network"])
            .optional()
            .describe("Entry point type (required for full and components-only modes)"),
        entryId: z
            .string()
            .optional()
            .describe("Entry point entity ID (required for full and components-only modes)"),
        mode: z
            .enum(["full", "components-only", "boot-only"])
            .optional()
            .describe("Repackage mode (default: full)"),
        changelog: z.string().optional().describe("Version changelog"),
        includeSkills: z.boolean().optional().describe("Include skills (default: true)"),
        includeDocuments: z.boolean().optional().describe("Include documents (default: true)")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({
        slug,
        organizationId,
        userId,
        entryType,
        entryId,
        mode,
        changelog,
        includeSkills,
        includeDocuments
    }) => {
        const playbook = await requirePlaybookOwner(slug, organizationId);
        const effectiveMode = mode ?? "full";

        if (effectiveMode !== "boot-only" && (!entryType || !entryId)) {
            return {
                success: false,
                error: "entryType and entryId are required for full and components-only modes"
            };
        }

        const { repackagePlaybook } = await import("../playbooks/packager");

        const result = await repackagePlaybook({
            playbookId: playbook.id,
            organizationId,
            userId,
            changelog,
            mode: effectiveMode,
            includeSkills: includeSkills ?? true,
            includeDocuments: includeDocuments ?? true,
            entryAgentId: entryType === "agent" ? entryId : undefined,
            entryWorkflowId: entryType === "workflow" ? entryId : undefined,
            entryNetworkId: entryType === "network" ? entryId : undefined
        });

        return {
            success: true,
            version: result.playbook.version,
            warnings: result.warnings,
            mode: effectiveMode
        };
    }
});

export const playbookSubmitReviewTool = createTool({
    id: "playbook-submit-review",
    description:
        "Submit a playbook for marketplace review. Requires at least one component and one packaged version.",
    inputSchema: z.object({
        slug: z.string().describe("Playbook slug"),
        organizationId: z.string().describe("Publisher organization ID")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ slug, organizationId }) => {
        await requirePlaybookOwner(slug, organizationId);

        const playbook = await prisma.playbook.findUnique({
            where: { slug },
            include: {
                components: { take: 1 },
                versions: { take: 1, orderBy: { version: "desc" } }
            }
        });

        if (!playbook) return { success: false, error: "Playbook not found" };
        if (playbook.components.length === 0) {
            return { success: false, error: "Playbook must have at least one component" };
        }
        if (playbook.versions.length === 0) {
            return { success: false, error: "Playbook must be packaged before submitting" };
        }

        const updated = await prisma.playbook.update({
            where: { slug },
            data: { status: "PENDING_REVIEW" }
        });

        return {
            success: true,
            status: updated.status,
            message: `Playbook "${updated.name}" submitted for review`
        };
    }
});

export const playbookSetAutoBootTool = createTool({
    id: "playbook-set-auto-boot",
    description:
        "Enable or disable auto-boot for a playbook. When enabled, the deployed agent will automatically read its boot document and self-configure on first run.",
    inputSchema: z.object({
        slug: z.string().describe("Playbook slug"),
        organizationId: z.string().describe("Publisher organization ID"),
        enabled: z.boolean().describe("Whether auto-boot is enabled")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ slug, organizationId, enabled }) => {
        await requirePlaybookOwner(slug, organizationId);

        await prisma.playbook.update({
            where: { slug },
            data: { autoBootEnabled: enabled }
        });

        return {
            success: true,
            autoBootEnabled: enabled,
            message: `Auto-boot ${enabled ? "enabled" : "disabled"} for "${slug}"`
        };
    }
});
