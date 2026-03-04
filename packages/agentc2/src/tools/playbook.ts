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
        installationStatus: z.string().optional(),
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

            return {
                success: true,
                installationId: installation.id,
                installationStatus: installation.status
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Deployment failed"
            };
        }
    }
});

/* ---------- Setup Wizard Tools ---------- */

export const playbookInstallationSetupTool = createTool({
    id: "playbook-installation-setup",
    description:
        "Get the current setup state for a playbook installation: integration connection status, custom config step progress, and whether it's ready to activate.",
    inputSchema: z.object({
        installationId: z.string().describe("The installation ID"),
        organizationId: z.string().describe("The organization ID")
    }),
    outputSchema: z.object({
        installation: z.object({
            id: z.string(),
            status: z.string(),
            playbookSlug: z.string()
        }),
        integrations: z.array(
            z.object({
                provider: z.string(),
                name: z.string(),
                connected: z.boolean(),
                authType: z.string()
            })
        ),
        configSteps: z.array(
            z.object({
                id: z.string(),
                type: z.string(),
                label: z.string(),
                completed: z.boolean()
            })
        ),
        readyToActivate: z.boolean()
    }),
    execute: async ({ installationId, organizationId }) => {
        const { mapIntegrations } = await import("../playbooks/integration-mapper");

        const installation = await prisma.playbookInstallation.findFirst({
            where: { id: installationId, targetOrgId: organizationId },
            include: {
                playbook: {
                    select: { slug: true, name: true, requiredIntegrations: true }
                }
            }
        });

        if (!installation) {
            throw new Error("Installation not found");
        }

        const integrationStatus = await mapIntegrations({
            requiredIntegrations: installation.playbook.requiredIntegrations,
            targetOrgId: organizationId,
            targetWorkspaceId: installation.targetWorkspaceId
        });

        const providers = await prisma.integrationProvider.findMany({
            where: { key: { in: installation.playbook.requiredIntegrations } },
            select: { key: true, name: true, authType: true }
        });
        const providerMap = new Map(providers.map((p) => [p.key, p]));

        const integrations = integrationStatus.map(
            (m: { provider: string; connected: boolean }) => {
                const prov = providerMap.get(m.provider);
                return {
                    provider: m.provider,
                    name: prov?.name ?? m.provider,
                    connected: m.connected,
                    authType: prov?.authType ?? "unknown"
                };
            }
        );

        const customizations = (installation.customizations as Record<string, unknown>) ?? {};
        const setupConfig =
            (customizations.setupConfig as {
                steps?: { id: string; type: string; label: string }[];
            }) ?? null;
        const stepData = (customizations.stepData as Record<string, unknown>) ?? {};

        const configSteps = (setupConfig?.steps ?? []).map((step) => ({
            ...step,
            completed: !!stepData[step.id]
        }));

        const allConnected = integrations.every((i: { connected: boolean }) => i.connected);
        const allStepsComplete = configSteps.every((s: { completed: boolean }) => s.completed);

        return {
            installation: {
                id: installation.id,
                status: installation.status,
                playbookSlug: installation.playbook.slug
            },
            integrations,
            configSteps,
            readyToActivate: allConnected && allStepsComplete
        };
    }
});

export const playbookInstallationVerifyTool = createTool({
    id: "playbook-installation-verify",
    description:
        "Test all connected integrations for a playbook installation. Returns per-integration test results.",
    inputSchema: z.object({
        installationId: z.string().describe("The installation ID"),
        organizationId: z.string().describe("The organization ID"),
        userId: z.string().describe("The user ID for MCP server testing")
    }),
    outputSchema: z.object({
        allPassed: z.boolean(),
        results: z.array(
            z.object({
                provider: z.string(),
                success: z.boolean(),
                error: z.string().optional()
            })
        ),
        disconnected: z.array(z.string())
    }),
    execute: async ({ installationId, organizationId, userId }) => {
        const { mapIntegrations } = await import("../playbooks/integration-mapper");
        const { testMcpServer } = await import("../mcp/client");

        const installation = await prisma.playbookInstallation.findFirst({
            where: { id: installationId, targetOrgId: organizationId },
            include: {
                playbook: { select: { requiredIntegrations: true } }
            }
        });

        if (!installation) throw new Error("Installation not found");

        const integrationStatus = await mapIntegrations({
            requiredIntegrations: installation.playbook.requiredIntegrations,
            targetOrgId: organizationId,
            targetWorkspaceId: installation.targetWorkspaceId
        });

        const connected = integrationStatus.filter((m: { connected: boolean }) => m.connected);
        const disconnected = integrationStatus
            .filter((m: { connected: boolean }) => !m.connected)
            .map((m: { provider: string }) => m.provider);

        const results = await Promise.allSettled(
            connected.map(async (mapping: { provider: string; connectionId?: string }) => {
                if (!mapping.connectionId) {
                    return { provider: mapping.provider, success: false, error: "No connection" };
                }
                const conn = await prisma.integrationConnection.findFirst({
                    where: { id: mapping.connectionId, organizationId },
                    include: { provider: true }
                });
                if (!conn) {
                    return { provider: mapping.provider, success: false, error: "Not found" };
                }
                if (
                    conn.provider.providerType === "mcp" ||
                    conn.provider.providerType === "custom"
                ) {
                    const serverId = conn.isDefault
                        ? conn.provider.key
                        : `${conn.provider.key}__${conn.id.slice(0, 8)}`;
                    const testResult = await testMcpServer({
                        serverId,
                        organizationId,
                        userId,
                        timeoutMs: 30000
                    });
                    const errorDetail = testResult.phases.find(
                        (p: { status: string }) => p.status === "fail"
                    )?.detail;
                    return {
                        provider: mapping.provider,
                        success: testResult.success,
                        error: errorDetail
                    };
                }
                return { provider: mapping.provider, success: true };
            })
        );

        const testResults = results.map((r, i) => {
            if (r.status === "fulfilled") return r.value;
            return {
                provider: connected[i]!.provider,
                success: false,
                error: r.reason instanceof Error ? r.reason.message : "Test failed"
            };
        });

        return {
            allPassed:
                testResults.every((r: { success: boolean }) => r.success) &&
                disconnected.length === 0,
            results: testResults,
            disconnected
        };
    }
});

export const playbookInstallationActivateTool = createTool({
    id: "playbook-installation-activate",
    description:
        "Activate a playbook installation after all integrations are connected and config steps are complete. Changes status from CONFIGURING to ACTIVE.",
    inputSchema: z.object({
        installationId: z.string().describe("The installation ID"),
        organizationId: z.string().describe("The organization ID")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        status: z.string().optional(),
        error: z.string().optional()
    }),
    execute: async ({ installationId, organizationId }) => {
        const { mapIntegrations } = await import("../playbooks/integration-mapper");

        const installation = await prisma.playbookInstallation.findFirst({
            where: { id: installationId, targetOrgId: organizationId },
            include: {
                playbook: { select: { requiredIntegrations: true } }
            }
        });

        if (!installation) return { success: false, error: "Installation not found" };
        if (installation.status !== "CONFIGURING" && installation.status !== "TESTING") {
            return { success: false, error: `Cannot activate from status: ${installation.status}` };
        }

        const integrationStatus = await mapIntegrations({
            requiredIntegrations: installation.playbook.requiredIntegrations,
            targetOrgId: organizationId,
            targetWorkspaceId: installation.targetWorkspaceId
        });

        const disconnected = integrationStatus.filter((m: { connected: boolean }) => !m.connected);
        if (disconnected.length > 0) {
            return {
                success: false,
                error: `Missing integrations: ${disconnected.map((m: { provider: string }) => m.provider).join(", ")}`
            };
        }

        const customizations = (installation.customizations as Record<string, unknown>) ?? {};
        const setupConfig = (customizations.setupConfig as { steps?: { id: string }[] }) ?? null;
        const stepData = (customizations.stepData as Record<string, unknown>) ?? {};

        const incomplete = (setupConfig?.steps ?? []).filter((s) => !stepData[s.id]);
        if (incomplete.length > 0) {
            return {
                success: false,
                error: `Incomplete steps: ${incomplete.map((s) => s.id).join(", ")}`
            };
        }

        await prisma.playbookInstallation.update({
            where: { id: installationId },
            data: {
                status: "ACTIVE",
                integrationStatus: integrationStatus as any,
                customizations: {
                    ...customizations,
                    setupCompletedAt: new Date().toISOString()
                } as any
            }
        });

        return { success: true, status: "ACTIVE" };
    }
});

export const playbookInstallationConfigureTool = createTool({
    id: "playbook-installation-configure",
    description:
        "Complete a custom configuration step for a playbook installation. For repo-select, pass { repository }. For webhook-create, pass { repository, webhookPath }.",
    inputSchema: z.object({
        installationId: z.string().describe("The installation ID"),
        organizationId: z.string().describe("The organization ID"),
        stepId: z.string().describe("The config step ID to complete"),
        data: z
            .record(z.unknown())
            .describe("Step-specific data (e.g. { repository: 'owner/repo' })")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        stepId: z.string().optional(),
        error: z.string().optional()
    }),
    execute: async ({ installationId, organizationId, stepId, data }) => {
        const installation = await prisma.playbookInstallation.findFirst({
            where: { id: installationId, targetOrgId: organizationId }
        });
        if (!installation) return { success: false, error: "Installation not found" };

        const customizations = (installation.customizations as Record<string, unknown>) ?? {};
        const setupConfig =
            (customizations.setupConfig as { steps?: { id: string; type: string }[] }) ?? null;
        const stepDef = setupConfig?.steps?.find((s) => s.id === stepId);
        if (!stepDef) return { success: false, error: `Unknown step: ${stepId}` };

        let stepResult: Record<string, unknown> = {
            ...data,
            completedAt: new Date().toISOString()
        };

        if (stepDef.type === "webhook-create") {
            const repository = data.repository as string;
            const webhookPath = data.webhookPath as string;
            if (!repository || !webhookPath) {
                return { success: false, error: "repository and webhookPath required" };
            }
            try {
                const { resolveGitHubToken, parseRepoOwnerName } = await import("./github-helpers");
                const token = await resolveGitHubToken(organizationId);
                const { owner, repo } = parseRepoOwnerName(repository);
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://agentc2.ai";
                const webhookUrl = `${baseUrl}/api/webhooks/${webhookPath}`;

                const response = await fetch(
                    `https://api.github.com/repos/${owner}/${repo}/hooks`,
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token}`,
                            Accept: "application/vnd.github+json",
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            name: "web",
                            active: true,
                            events: ["issues", "issue_comment"],
                            config: { url: webhookUrl, content_type: "json", insecure_ssl: "0" }
                        })
                    }
                );
                if (!response.ok) {
                    return { success: false, error: `GitHub API error: ${response.status}` };
                }
                const hookData = (await response.json()) as { id: number };
                stepResult = {
                    repository,
                    webhookPath,
                    webhookUrl,
                    githubWebhookId: hookData.id,
                    completedAt: new Date().toISOString()
                };
            } catch (err) {
                return {
                    success: false,
                    error: err instanceof Error ? err.message : "Webhook creation failed"
                };
            }
        }

        const existingStepData = (customizations.stepData as Record<string, unknown>) ?? {};
        await prisma.playbookInstallation.update({
            where: { id: installationId },
            data: {
                customizations: {
                    ...customizations,
                    stepData: { ...existingStepData, [stepId]: stepResult }
                } as any
            }
        });

        return { success: true, stepId };
    }
});

export const playbookInstallationReposTool = createTool({
    id: "playbook-installation-repos",
    description:
        "List GitHub repositories available to the organization for use with a playbook installation (e.g. selecting a target repo for the SDLC pipeline).",
    inputSchema: z.object({
        organizationId: z.string().describe("The organization ID")
    }),
    outputSchema: z.object({
        repos: z.array(
            z.object({
                full_name: z.string(),
                default_branch: z.string(),
                private: z.boolean()
            })
        )
    }),
    execute: async ({ organizationId }) => {
        const { resolveGitHubToken } = await import("./github-helpers");
        const token = await resolveGitHubToken(organizationId);

        const allRepos: { full_name: string; default_branch: string; private: boolean }[] = [];
        let page = 1;
        while (page <= 5) {
            const res = await fetch(
                `https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,organization_member`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: "application/vnd.github+json"
                    }
                }
            );
            if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
            const data = (await res.json()) as {
                full_name: string;
                default_branch: string;
                private: boolean;
            }[];
            allRepos.push(
                ...data.map((r) => ({
                    full_name: r.full_name,
                    default_branch: r.default_branch,
                    private: r.private
                }))
            );
            if (data.length < 100) break;
            page++;
        }

        return { repos: allRepos };
    }
});
