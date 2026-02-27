import { prisma, Prisma } from "@repo/database";
import type { DeployPlaybookOptions, PlaybookManifest } from "./types";
import { validateManifest } from "./manifest";
import { mapIntegrations } from "./integration-mapper";

function jsonOrUndefined(val: unknown): Prisma.InputJsonValue | undefined {
    if (val === null || val === undefined) return undefined;
    return val as Prisma.InputJsonValue;
}

function generateUniqueSlug(baseSlug: string, existingSlugs: Set<string>): string {
    if (!existingSlugs.has(baseSlug)) return baseSlug;
    let counter = 2;
    while (existingSlugs.has(`${baseSlug}-${counter}`)) {
        counter++;
    }
    return `${baseSlug}-${counter}`;
}

export async function deployPlaybook(opts: DeployPlaybookOptions) {
    const playbook = await prisma.playbook.findUniqueOrThrow({
        where: { id: opts.playbookId }
    });

    const version = await prisma.playbookVersion.findFirstOrThrow({
        where: {
            playbookId: opts.playbookId,
            version: opts.versionNumber
        }
    });

    const manifest = validateManifest(version.manifest);

    const installation = await prisma.playbookInstallation.create({
        data: {
            playbookId: opts.playbookId,
            purchaseId: opts.purchaseId ?? null,
            targetOrgId: opts.targetOrgId,
            targetWorkspaceId: opts.targetWorkspaceId,
            installedByUserId: opts.userId,
            versionInstalled: opts.versionNumber,
            status: "INSTALLING"
        }
    });

    try {
        const integrationStatus = await mapIntegrations({
            requiredIntegrations: manifest.requiredIntegrations,
            targetOrgId: opts.targetOrgId,
            targetWorkspaceId: opts.targetWorkspaceId
        });

        await prisma.playbookInstallation.update({
            where: { id: installation.id },
            data: { integrationStatus: integrationStatus as unknown as Prisma.InputJsonValue }
        });

        const existingAgents = await prisma.agent.findMany({
            where: { workspaceId: opts.targetWorkspaceId },
            select: { slug: true }
        });
        const existingAgentSlugs = new Set(existingAgents.map((a) => a.slug));
        const suffix = installation.id.slice(-6);

        const resolveSlug = (baseSlug: string, existingSlugs: Set<string>): string => {
            if (opts.cleanSlugs) {
                return generateUniqueSlug(baseSlug, existingSlugs);
            }
            return `${baseSlug}-${suffix}`;
        };

        const agentSlugMap = new Map<string, string>();
        const createdAgentIds: string[] = [];
        const createdSkillIds: string[] = [];
        const createdDocumentIds: string[] = [];
        const createdWorkflowIds: string[] = [];
        const createdNetworkIds: string[] = [];
        const createdCampaignIds: string[] = [];

        // Preload existing slugs for clean slug mode.
        // Document, Workflow, Network, Campaign have globally unique slugs,
        // so we must query all existing slugs (not just the target workspace).
        // Skills use @@unique([workspaceId, slug]) so per-workspace is fine.
        const existingDocSlugs = new Set<string>();
        const existingSkillSlugs = new Set<string>();
        const existingWfSlugs = new Set<string>();
        const existingNetSlugs = new Set<string>();
        const existingCampaignSlugs = new Set<string>();
        if (opts.cleanSlugs) {
            const [docs, skills, wfs, nets, campaigns] = await Promise.all([
                prisma.document.findMany({ select: { slug: true } }),
                prisma.skill.findMany({
                    where: { workspaceId: opts.targetWorkspaceId },
                    select: { slug: true }
                }),
                prisma.workflow.findMany({ select: { slug: true } }),
                prisma.network.findMany({ select: { slug: true } }),
                prisma.campaign.findMany({ select: { slug: true } })
            ]);
            docs.forEach((d) => existingDocSlugs.add(d.slug));
            skills.forEach((s) => existingSkillSlugs.add(s.slug));
            wfs.forEach((w) => existingWfSlugs.add(w.slug));
            nets.forEach((n) => existingNetSlugs.add(n.slug));
            campaigns.forEach((c) => existingCampaignSlugs.add(c.slug));
        }

        // 1. Create documents
        const docSlugToId = new Map<string, string>();
        for (const docSnapshot of manifest.documents) {
            const docSlug = resolveSlug(docSnapshot.slug, existingDocSlugs);
            existingDocSlugs.add(docSlug);
            const doc = await prisma.document.create({
                data: {
                    slug: docSlug,
                    name: docSnapshot.name,
                    description: docSnapshot.description,
                    content: docSnapshot.content,
                    contentType: docSnapshot.contentType,
                    category: docSnapshot.category,
                    tags: docSnapshot.tags,
                    metadata: jsonOrUndefined(docSnapshot.metadata),
                    workspaceId: opts.targetWorkspaceId,
                    organizationId: opts.targetOrgId,
                    version: 1
                }
            });
            createdDocumentIds.push(doc.id);
            docSlugToId.set(docSnapshot.slug, doc.id);
        }

        // 2. Create skills
        const skillSlugToId = new Map<string, string>();
        for (const skillSnapshot of manifest.skills) {
            const skillSlug = resolveSlug(skillSnapshot.slug, existingSkillSlugs);
            existingSkillSlugs.add(skillSlug);
            const meta = (skillSnapshot.metadata as Record<string, unknown>) ?? {};
            const skill = await prisma.skill.create({
                data: {
                    slug: skillSlug,
                    name: skillSnapshot.name,
                    description: skillSnapshot.description,
                    instructions: skillSnapshot.instructions,
                    examples: skillSnapshot.examples,
                    category: skillSnapshot.category,
                    tags: skillSnapshot.tags,
                    metadata: {
                        ...meta,
                        playbookSourceId: opts.playbookId,
                        playbookInstallationId: installation.id
                    },
                    workspaceId: opts.targetWorkspaceId,
                    version: 1
                }
            });
            createdSkillIds.push(skill.id);
            skillSlugToId.set(skillSnapshot.slug, skill.id);

            for (const tool of skillSnapshot.tools) {
                await prisma.skillTool.create({
                    data: { skillId: skill.id, toolId: tool.toolId }
                });
            }

            for (const docRef of skillSnapshot.documents) {
                const docId = docSlugToId.get(docRef);
                if (docId) {
                    await prisma.skillDocument.create({
                        data: { skillId: skill.id, documentId: docId }
                    });
                }
            }
        }

        // 3. Create agents
        for (const agentSnapshot of manifest.agents) {
            const deployedSlug = generateUniqueSlug(agentSnapshot.slug, existingAgentSlugs);
            existingAgentSlugs.add(deployedSlug);
            agentSlugMap.set(agentSnapshot.slug, deployedSlug);

            const agentMeta = (agentSnapshot.metadata as Record<string, unknown>) ?? {};
            const agent = await prisma.agent.create({
                data: {
                    slug: deployedSlug,
                    name: agentSnapshot.name,
                    description: agentSnapshot.description,
                    instructions: agentSnapshot.instructions,
                    instructionsTemplate: agentSnapshot.instructionsTemplate,
                    modelProvider: agentSnapshot.modelProvider,
                    modelName: agentSnapshot.modelName,
                    temperature: agentSnapshot.temperature,
                    maxTokens: agentSnapshot.maxTokens,
                    modelConfig: jsonOrUndefined(agentSnapshot.modelConfig),
                    routingConfig: jsonOrUndefined(agentSnapshot.routingConfig),
                    contextConfig: jsonOrUndefined(agentSnapshot.contextConfig),
                    subAgents: agentSnapshot.subAgents,
                    workflows: agentSnapshot.workflows,
                    memoryEnabled: agentSnapshot.memoryEnabled,
                    memoryConfig: jsonOrUndefined(agentSnapshot.memoryConfig),
                    maxSteps: agentSnapshot.maxSteps,
                    visibility: agentSnapshot.visibility as "PRIVATE" | "ORGANIZATION" | "PUBLIC",
                    requiresApproval: agentSnapshot.requiresApproval,
                    maxSpendUsd: agentSnapshot.maxSpendUsd,
                    autoVectorize: agentSnapshot.autoVectorize,
                    deploymentMode: agentSnapshot.deploymentMode,
                    metadata: {
                        ...agentMeta,
                        playbookSourceId: opts.playbookId,
                        playbookInstallationId: installation.id
                    },
                    workspaceId: opts.targetWorkspaceId,
                    playbookSourceId: opts.playbookId,
                    playbookInstallationId: installation.id,
                    version: 1
                }
            });
            createdAgentIds.push(agent.id);

            for (const tool of agentSnapshot.tools) {
                await prisma.agentTool.create({
                    data: {
                        agentId: agent.id,
                        toolId: tool.toolId,
                        config: jsonOrUndefined(tool.config)
                    }
                });
            }

            for (const skillSlug of agentSnapshot.skills) {
                const skillId = skillSlugToId.get(skillSlug);
                if (skillId) {
                    await prisma.agentSkill.create({
                        data: { agentId: agent.id, skillId }
                    });
                }
            }

            if (agentSnapshot.guardrail) {
                await prisma.guardrailPolicy.create({
                    data: {
                        agentId: agent.id,
                        configJson: agentSnapshot.guardrail.configJson as Prisma.InputJsonValue,
                        version: 1
                    }
                });
            }

            for (const tc of agentSnapshot.testCases) {
                await prisma.agentTestCase.create({
                    data: {
                        agentId: agent.id,
                        name: tc.name,
                        inputText: tc.inputText,
                        expectedOutput: tc.expectedOutput,
                        tags: tc.tags
                    }
                });
            }

            if (agentSnapshot.scorecard) {
                await prisma.agentScorecard.create({
                    data: {
                        agentId: agent.id,
                        criteria: agentSnapshot.scorecard.criteria as Prisma.InputJsonValue,
                        version: 1,
                        samplingRate: agentSnapshot.scorecard.samplingRate,
                        auditorModel: agentSnapshot.scorecard.auditorModel,
                        evaluateTurns: agentSnapshot.scorecard.evaluateTurns
                    }
                });
            }
        }

        // 4. Create workflows
        const workflowSlugToId = new Map<string, string>();
        for (const wfSnapshot of manifest.workflows) {
            const wfSlug = resolveSlug(wfSnapshot.slug, existingWfSlugs);
            existingWfSlugs.add(wfSlug);
            const wf = await prisma.workflow.create({
                data: {
                    slug: wfSlug,
                    name: wfSnapshot.name,
                    description: wfSnapshot.description,
                    definitionJson: wfSnapshot.definitionJson as Prisma.InputJsonValue,
                    inputSchemaJson: jsonOrUndefined(wfSnapshot.inputSchemaJson),
                    outputSchemaJson: jsonOrUndefined(wfSnapshot.outputSchemaJson),
                    maxSteps: wfSnapshot.maxSteps,
                    timeout: wfSnapshot.timeout,
                    retryConfig: jsonOrUndefined(wfSnapshot.retryConfig),
                    workspaceId: opts.targetWorkspaceId,
                    version: 1
                }
            });
            createdWorkflowIds.push(wf.id);
            workflowSlugToId.set(wfSnapshot.slug, wf.id);
        }

        // 5. Create networks
        for (const netSnapshot of manifest.networks) {
            const netSlug = resolveSlug(netSnapshot.slug, existingNetSlugs);
            existingNetSlugs.add(netSlug);
            const network = await prisma.network.create({
                data: {
                    slug: netSlug,
                    name: netSnapshot.name,
                    description: netSnapshot.description,
                    instructions: netSnapshot.instructions,
                    modelProvider: netSnapshot.modelProvider,
                    modelName: netSnapshot.modelName,
                    temperature: netSnapshot.temperature,
                    topologyJson: netSnapshot.topologyJson as Prisma.InputJsonValue,
                    memoryConfig: netSnapshot.memoryConfig as Prisma.InputJsonValue,
                    maxSteps: netSnapshot.maxSteps,
                    workspaceId: opts.targetWorkspaceId,
                    version: 1
                }
            });
            createdNetworkIds.push(network.id);

            for (const prim of netSnapshot.primitives) {
                const mappedAgentSlug = prim.agentSlug
                    ? (agentSlugMap.get(prim.agentSlug) ?? prim.agentSlug)
                    : null;
                const agentRecord = mappedAgentSlug
                    ? await prisma.agent.findFirst({
                          where: { slug: mappedAgentSlug, workspaceId: opts.targetWorkspaceId }
                      })
                    : null;
                const workflowId = prim.workflowSlug
                    ? (workflowSlugToId.get(prim.workflowSlug) ?? null)
                    : null;

                await prisma.networkPrimitive.create({
                    data: {
                        networkId: network.id,
                        primitiveType: prim.primitiveType,
                        agentId: agentRecord?.id ?? null,
                        workflowId: workflowId,
                        toolId: prim.toolId,
                        description: prim.description,
                        position: jsonOrUndefined(prim.position)
                    }
                });
            }
        }

        // 6. Create campaigns from templates
        for (const campTemplate of manifest.campaignTemplates) {
            const campSlug = opts.cleanSlugs
                ? generateUniqueSlug(campTemplate.slug, existingCampaignSlugs)
                : `${campTemplate.slug}-${suffix}`;
            existingCampaignSlugs.add(campSlug);

            const campaign = await prisma.campaign.create({
                data: {
                    slug: campSlug,
                    name: campTemplate.name,
                    status: "PLANNING",
                    tenantId: opts.targetOrgId,
                    createdBy: opts.userId,
                    intent: campTemplate.intent,
                    endState: campTemplate.endState,
                    description: campTemplate.description,
                    constraints: campTemplate.constraints,
                    restraints: campTemplate.restraints,
                    requireApproval: campTemplate.requireApproval,
                    maxCostUsd: campTemplate.maxCostUsd,
                    timeoutMinutes: campTemplate.timeoutMinutes
                }
            });
            createdCampaignIds.push(campaign.id);
        }

        await prisma.playbookInstallation.update({
            where: { id: installation.id },
            data: {
                status: "ACTIVE",
                createdAgentIds,
                createdSkillIds,
                createdDocumentIds,
                createdWorkflowIds,
                createdNetworkIds,
                createdCampaignIds
            }
        });

        await prisma.playbook.update({
            where: { id: opts.playbookId },
            data: { installCount: { increment: 1 } }
        });

        return installation;
    } catch (error) {
        await prisma.playbookInstallation.update({
            where: { id: installation.id },
            data: {
                status: "FAILED",
                testResults: {
                    error: error instanceof Error ? error.message : "Unknown deployment error"
                }
            }
        });
        throw error;
    }
}

export async function uninstallPlaybook(installationId: string) {
    const installation = await prisma.playbookInstallation.findUniqueOrThrow({
        where: { id: installationId }
    });

    if (installation.createdNetworkIds.length > 0) {
        await prisma.networkPrimitive.deleteMany({
            where: { networkId: { in: installation.createdNetworkIds } }
        });
        await prisma.network.deleteMany({
            where: { id: { in: installation.createdNetworkIds } }
        });
    }

    if (installation.createdWorkflowIds.length > 0) {
        await prisma.workflow.deleteMany({
            where: { id: { in: installation.createdWorkflowIds } }
        });
    }

    if (installation.createdAgentIds.length > 0) {
        await prisma.agent.deleteMany({
            where: { id: { in: installation.createdAgentIds } }
        });
    }

    if (installation.createdSkillIds.length > 0) {
        await prisma.skill.deleteMany({
            where: { id: { in: installation.createdSkillIds } }
        });
    }

    if (installation.createdDocumentIds.length > 0) {
        await prisma.document.deleteMany({
            where: { id: { in: installation.createdDocumentIds } }
        });
    }

    if (installation.createdCampaignIds.length > 0) {
        await prisma.campaignLog.deleteMany({
            where: { campaignId: { in: installation.createdCampaignIds } }
        });
        await prisma.campaign.deleteMany({
            where: { id: { in: installation.createdCampaignIds } }
        });
    }

    await prisma.playbookInstallation.update({
        where: { id: installationId },
        data: { status: "UNINSTALLED" }
    });

    await prisma.playbook.update({
        where: { id: installation.playbookId },
        data: { installCount: { decrement: 1 } }
    });
}
