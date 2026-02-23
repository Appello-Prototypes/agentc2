import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { prisma } from "@repo/database";

export const playbookSearchTool = createTool({
    id: "playbook-search",
    description:
        "Search published playbooks in the marketplace by category, tags, or natural language query. Returns name, slug, pricing, trust score, and install count.",
    inputSchema: z.object({
        query: z.string().optional().describe("Search term (matches name, description, tags)"),
        category: z.string().optional().describe("Filter by category"),
        limit: z.number().optional().default(10).describe("Max results to return")
    }),
    outputSchema: z.object({
        playbooks: z.array(
            z.object({
                slug: z.string(),
                name: z.string(),
                tagline: z.string().nullable(),
                category: z.string(),
                pricingModel: z.string(),
                priceUsd: z.number().nullable(),
                installCount: z.number(),
                trustScore: z.number().nullable(),
                averageRating: z.number().nullable(),
                publisherOrg: z.string()
            })
        ),
        total: z.number()
    }),
    execute: async ({ query, category, limit = 10 }) => {
        const where: Record<string, unknown> = { status: "PUBLISHED" };
        if (category) where.category = category;
        if (query) {
            where.OR = [
                { name: { contains: query, mode: "insensitive" } },
                { description: { contains: query, mode: "insensitive" } },
                { tags: { has: query.toLowerCase() } }
            ];
        }

        const [playbooks, total] = await Promise.all([
            prisma.playbook.findMany({
                where,
                orderBy: [{ installCount: "desc" }],
                take: limit,
                select: {
                    slug: true,
                    name: true,
                    tagline: true,
                    category: true,
                    pricingModel: true,
                    priceUsd: true,
                    installCount: true,
                    trustScore: true,
                    averageRating: true,
                    publisherOrg: { select: { name: true } }
                }
            }),
            prisma.playbook.count({ where })
        ]);

        return {
            playbooks: playbooks.map((p) => ({
                ...p,
                publisherOrg: p.publisherOrg.name
            })),
            total
        };
    }
});

export const playbookDetailTool = createTool({
    id: "playbook-detail",
    description:
        "Get full details of a specific playbook: description, components, required integrations, reviews, test results.",
    inputSchema: z.object({
        slug: z.string().describe("The playbook slug")
    }),
    outputSchema: z.object({
        playbook: z
            .object({
                slug: z.string(),
                name: z.string(),
                description: z.string(),
                category: z.string(),
                pricingModel: z.string(),
                priceUsd: z.number().nullable(),
                installCount: z.number(),
                trustScore: z.number().nullable(),
                averageRating: z.number().nullable(),
                reviewCount: z.number(),
                requiredIntegrations: z.array(z.string()),
                componentCount: z.number(),
                publisherOrg: z.string()
            })
            .nullable()
    }),
    execute: async ({ slug }) => {
        const pb = await prisma.playbook.findUnique({
            where: { slug },
            include: {
                publisherOrg: { select: { name: true } },
                _count: { select: { components: true } }
            }
        });

        if (!pb || pb.status !== "PUBLISHED") {
            return { playbook: null };
        }

        return {
            playbook: {
                slug: pb.slug,
                name: pb.name,
                description: pb.description,
                category: pb.category,
                pricingModel: pb.pricingModel,
                priceUsd: pb.priceUsd,
                installCount: pb.installCount,
                trustScore: pb.trustScore,
                averageRating: pb.averageRating,
                reviewCount: pb.reviewCount,
                requiredIntegrations: pb.requiredIntegrations,
                componentCount: pb._count.components,
                publisherOrg: pb.publisherOrg.name
            }
        };
    }
});

export const playbookListInstalledTool = createTool({
    id: "playbook-list-installed",
    description: "List playbooks installed in the current workspace.",
    inputSchema: z.object({
        organizationId: z.string().describe("The organization ID to check installations for")
    }),
    outputSchema: z.object({
        installations: z.array(
            z.object({
                id: z.string(),
                playbookName: z.string(),
                playbookSlug: z.string(),
                status: z.string(),
                versionInstalled: z.number(),
                agentCount: z.number(),
                installedAt: z.string()
            })
        )
    }),
    execute: async ({ organizationId }) => {
        const installations = await prisma.playbookInstallation.findMany({
            where: {
                targetOrgId: organizationId,
                status: { not: "UNINSTALLED" }
            },
            include: {
                playbook: { select: { name: true, slug: true } }
            }
        });

        return {
            installations: installations.map((inst) => ({
                id: inst.id,
                playbookName: inst.playbook.name,
                playbookSlug: inst.playbook.slug,
                status: inst.status,
                versionInstalled: inst.versionInstalled,
                agentCount: inst.createdAgentIds.length,
                installedAt: inst.createdAt.toISOString()
            }))
        };
    }
});

export const playbookDeployTool = createTool({
    id: "playbook-deploy",
    description:
        "Trigger deployment of a purchased (or free) playbook into the current workspace. Returns installation ID for status polling.",
    inputSchema: z.object({
        slug: z.string().describe("The playbook slug to deploy"),
        workspaceId: z.string().describe("Target workspace ID"),
        organizationId: z.string().describe("Buyer organization ID"),
        userId: z.string().describe("User initiating the deploy")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        installationId: z.string().optional(),
        error: z.string().optional()
    }),
    execute: async ({ slug, workspaceId, organizationId, userId }) => {
        try {
            const { deployPlaybook } = await import("../playbooks/deployer");

            const pb = await prisma.playbook.findUnique({ where: { slug } });
            if (!pb || pb.status !== "PUBLISHED") {
                return { success: false, error: "Playbook not found or not published" };
            }

            const installation = await deployPlaybook({
                playbookId: pb.id,
                versionNumber: pb.version,
                targetOrgId: organizationId,
                targetWorkspaceId: workspaceId,
                userId
            });

            return { success: true, installationId: installation.id };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Deployment failed"
            };
        }
    }
});
