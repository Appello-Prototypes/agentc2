import { prisma, Prisma } from "@repo/database";
import type { DeployPlaybookOptions, PlaybookManifest } from "./types";
import { validateManifest } from "./manifest";
import { mapIntegrations } from "./integration-mapper";
import { reembedDocument } from "../documents/service";

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

function generateUniqueName(baseName: string, existingNames: Set<string>): string {
    if (!existingNames.has(baseName)) return baseName;
    let counter = 2;
    while (existingNames.has(`${baseName} (${counter})`)) {
        counter++;
    }
    return `${baseName} (${counter})`;
}

/**
 * Recursively walk a workflow definitionJson and remap slug references
 * so deployed workflows point to deployed agents/workflows instead of
 * the publisher's original slugs.
 */
function remapDefinitionSlugs(
    definition: unknown,
    agentSlugMap: Map<string, string>,
    workflowSlugMap: Map<string, string>
): unknown {
    if (definition === null || definition === undefined) return definition;
    if (Array.isArray(definition)) {
        return definition.map((item) => remapDefinitionSlugs(item, agentSlugMap, workflowSlugMap));
    }
    if (typeof definition === "object") {
        const obj = definition as Record<string, unknown>;
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
            if (key === "agentSlug" && typeof value === "string") {
                result[key] = agentSlugMap.get(value) ?? value;
            } else if (key === "workflowId" && typeof value === "string") {
                result[key] = workflowSlugMap.get(value) ?? value;
            } else {
                result[key] = remapDefinitionSlugs(value, agentSlugMap, workflowSlugMap);
            }
        }
        return result;
    }
    return definition;
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
            select: { slug: true, name: true }
        });
        const existingAgentSlugs = new Set(existingAgents.map((a) => a.slug));
        const existingAgentNames = new Set(existingAgents.map((a) => a.name));
        const suffix = installation.id.slice(-6);

        const resolveSlug = (baseSlug: string, existingSlugs: Set<string>): string => {
            const suffixed = `${baseSlug}-${suffix}`;
            return generateUniqueSlug(suffixed, existingSlugs);
        };

        const createdAgentIds: string[] = [];
        const createdSkillIds: string[] = [];
        const createdDocumentIds: string[] = [];
        const createdWorkflowIds: string[] = [];
        const createdNetworkIds: string[] = [];
        const createdCampaignIds: string[] = [];

        const existingDocSlugs = new Set<string>();
        const existingSkillSlugs = new Set<string>();
        const existingWfSlugs = new Set<string>();
        const existingNetSlugs = new Set<string>();
        const existingCampaignSlugs = new Set<string>();
        if (opts.cleanSlugs) {
            const wsFilter = { workspaceId: opts.targetWorkspaceId };
            const orgFilter = { organizationId: opts.targetOrgId };
            const [docs, skills, wfs, nets, campaigns] = await Promise.all([
                prisma.document.findMany({ where: wsFilter, select: { slug: true } }),
                prisma.skill.findMany({ where: wsFilter, select: { slug: true } }),
                prisma.workflow.findMany({ where: wsFilter, select: { slug: true } }),
                prisma.network.findMany({ where: wsFilter, select: { slug: true } }),
                prisma.campaign.findMany({ where: orgFilter, select: { slug: true } })
            ]);
            docs.forEach((d) => existingDocSlugs.add(d.slug));
            skills.forEach((s) => existingSkillSlugs.add(s.slug));
            wfs.forEach((w) => existingWfSlugs.add(w.slug));
            nets.forEach((n) => existingNetSlugs.add(n.slug));
            campaigns.forEach((c) => existingCampaignSlugs.add(c.slug));
        }

        // Pre-compute slug and name maps so cross-references (subAgents, workflows,
        // definitionJson) can be remapped to the deployed slugs.
        const agentSlugMap = new Map<string, string>();
        const agentNameMap = new Map<string, string>();
        for (const agentSnapshot of manifest.agents) {
            const suffixed = `${agentSnapshot.slug}-${suffix}`;
            const deployedSlug = generateUniqueSlug(suffixed, existingAgentSlugs);
            existingAgentSlugs.add(deployedSlug);
            agentSlugMap.set(agentSnapshot.slug, deployedSlug);

            const deployedName = generateUniqueName(agentSnapshot.name, existingAgentNames);
            existingAgentNames.add(deployedName);
            agentNameMap.set(agentSnapshot.slug, deployedName);
        }

        const workflowSlugMap = new Map<string, string>();
        for (const wfSnapshot of manifest.workflows) {
            const wfSlug = resolveSlug(wfSnapshot.slug, existingWfSlugs);
            existingWfSlugs.add(wfSlug);
            workflowSlugMap.set(wfSnapshot.slug, wfSlug);
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

            // Embed document into RAG vector store
            try {
                await reembedDocument(doc.id);
            } catch (embedError) {
                console.warn(`[deployPlaybook] Failed to embed doc ${docSlug}:`, embedError);
            }
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
                    organizationId: opts.targetOrgId,
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
            const deployedSlug = agentSlugMap.get(agentSnapshot.slug)!;

            const remappedSubAgents = (agentSnapshot.subAgents ?? []).map(
                (s) => agentSlugMap.get(s) ?? s
            );
            const remappedWorkflows = (agentSnapshot.workflows ?? []).map(
                (w) => workflowSlugMap.get(w) ?? w
            );

            const agentMeta = (agentSnapshot.metadata as Record<string, unknown>) ?? {};
            const deployedName = agentNameMap.get(agentSnapshot.slug) ?? agentSnapshot.name;
            const agent = await prisma.agent.create({
                data: {
                    slug: deployedSlug,
                    name: deployedName,
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
                    subAgents: remappedSubAgents,
                    workflows: remappedWorkflows,
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
                    sourcePlaybookSlug: playbook.slug,
                    sourceAgentSlug: agentSnapshot.slug,
                    sourceAgentVersion: agentSnapshot.version ?? 1,
                    version: 1
                }
            });
            createdAgentIds.push(agent.id);

            // Seed backlog tasks: prefer bootConfig.structuralTasks, fall back to legacy snapshot
            const bootTasks = manifest.bootConfig?.structuralTasks ?? [];
            const legacyTasks = agentSnapshot.backlogTasks ?? [];
            const tasksToSeed = bootTasks.length > 0 ? bootTasks : legacyTasks;

            if (tasksToSeed.length > 0) {
                const backlog = await prisma.backlog.create({
                    data: { agentId: agent.id, workspaceId: opts.targetWorkspaceId }
                });
                for (const task of tasksToSeed) {
                    await prisma.backlogTask.create({
                        data: {
                            backlogId: backlog.id,
                            title: task.title,
                            description:
                                task.description ?? ("status" in task ? undefined : undefined),
                            priority: task.priority,
                            status: "PENDING",
                            tags: task.tags,
                            contextJson:
                                "metadata" in task
                                    ? jsonOrUndefined((task as { metadata?: unknown }).metadata)
                                    : undefined
                        }
                    });
                }
            }

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

        // 4. Create workflows (with remapped agent/workflow slugs in definitionJson)
        const workflowSlugToId = new Map<string, string>();
        for (const wfSnapshot of manifest.workflows) {
            const wfSlug = workflowSlugMap.get(wfSnapshot.slug)!;
            const remappedDefinition = remapDefinitionSlugs(
                wfSnapshot.definitionJson,
                agentSlugMap,
                workflowSlugMap
            );
            const wf = await prisma.workflow.create({
                data: {
                    slug: wfSlug,
                    name: wfSnapshot.name,
                    description: wfSnapshot.description,
                    definitionJson: remappedDefinition as Prisma.InputJsonValue,
                    inputSchemaJson: jsonOrUndefined(wfSnapshot.inputSchemaJson),
                    outputSchemaJson: jsonOrUndefined(wfSnapshot.outputSchemaJson),
                    maxSteps: wfSnapshot.maxSteps,
                    timeout: wfSnapshot.timeout,
                    retryConfig: jsonOrUndefined(wfSnapshot.retryConfig),
                    workspaceId: opts.targetWorkspaceId,
                    playbookSourceId: opts.playbookId,
                    playbookInstallationId: installation.id,
                    sourcePlaybookSlug: playbook.slug,
                    sourceWorkflowSlug: wfSnapshot.slug,
                    sourceWorkflowVersion: wfSnapshot.version ?? 1,
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
                    playbookSourceId: opts.playbookId,
                    playbookInstallationId: installation.id,
                    sourcePlaybookSlug: playbook.slug,
                    sourceNetworkSlug: netSnapshot.slug,
                    sourceNetworkVersion: netSnapshot.version ?? 1,
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
                    organizationId: opts.targetOrgId,
                    workspaceId: opts.targetWorkspaceId,
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

        // 7. Create boot document and embed into RAG
        let bootDocumentId: string | undefined;
        if (manifest.bootConfig?.bootDocument) {
            const bootDocSlug = resolveSlug("boot-runbook", existingDocSlugs);
            existingDocSlugs.add(bootDocSlug);
            const bootDoc = await prisma.document.create({
                data: {
                    slug: bootDocSlug,
                    name: `Boot Runbook - ${playbook.name}`,
                    description: `Boot runbook for playbook: ${playbook.name}`,
                    content: manifest.bootConfig.bootDocument,
                    contentType: "text/markdown",
                    category: "boot-runbook",
                    tags: ["playbook-boot", playbook.slug],
                    workspaceId: opts.targetWorkspaceId,
                    organizationId: opts.targetOrgId,
                    version: 1
                }
            });
            createdDocumentIds.push(bootDoc.id);
            bootDocumentId = bootDoc.id;

            try {
                await reembedDocument(bootDoc.id);
            } catch (embedError) {
                console.warn(
                    `[deployPlaybook] Failed to embed boot doc ${bootDocSlug}:`,
                    embedError
                );
            }
        }

        const hasDisconnectedIntegrations = integrationStatus.some(
            (m: { connected: boolean }) => !m.connected
        );
        const finalStatus =
            hasDisconnectedIntegrations || manifest.setupConfig?.steps?.length
                ? "CONFIGURING"
                : "ACTIVE";

        const customizations: Record<string, unknown> = {};
        if (manifest.setupConfig) {
            customizations.setupConfig = manifest.setupConfig;
        }

        await prisma.playbookInstallation.update({
            where: { id: installation.id },
            data: {
                status: finalStatus,
                createdAgentIds,
                createdSkillIds,
                createdDocumentIds,
                createdWorkflowIds,
                createdNetworkIds,
                createdCampaignIds,
                ...(Object.keys(customizations).length > 0
                    ? { customizations: customizations as Prisma.InputJsonValue }
                    : {})
            }
        });

        await prisma.playbook.update({
            where: { id: opts.playbookId },
            data: { installCount: { increment: 1 } }
        });

        const entryAgentSlug =
            manifest.entryPoint.type === "agent"
                ? (agentSlugMap.get(manifest.entryPoint.slug) ?? manifest.entryPoint.slug)
                : undefined;

        return {
            ...installation,
            status: finalStatus,
            bootMetadata: {
                autoBootEnabled: manifest.bootConfig?.autoBootEnabled ?? false,
                entryAgentSlug,
                bootDocumentId
            }
        };
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
        // Clean up backlogs before deleting agents
        const backlogs = await prisma.backlog.findMany({
            where: { agentId: { in: installation.createdAgentIds } },
            select: { id: true }
        });
        if (backlogs.length > 0) {
            const backlogIds = backlogs.map((b) => b.id);
            await prisma.backlogTask.deleteMany({
                where: { backlogId: { in: backlogIds } }
            });
            await prisma.backlog.deleteMany({
                where: { id: { in: backlogIds } }
            });
        }

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

type EntityArrayField =
    | "createdAgentIds"
    | "createdSkillIds"
    | "createdDocumentIds"
    | "createdWorkflowIds"
    | "createdNetworkIds"
    | "createdCampaignIds";

/**
 * Remove a deleted entity's ID from its parent PlaybookInstallation.
 * If all created entity arrays are empty after removal, mark the installation UNINSTALLED.
 */
export async function removeEntityFromInstallation(
    entityId: string,
    field: EntityArrayField
): Promise<void> {
    const installations = await prisma.playbookInstallation.findMany({
        where: { [field]: { has: entityId }, status: { not: "UNINSTALLED" } }
    });

    for (const inst of installations) {
        const updatedArray = (inst[field] as string[]).filter((id) => id !== entityId);

        const allEmpty =
            (field === "createdAgentIds" ? updatedArray : inst.createdAgentIds).length === 0 &&
            (field === "createdSkillIds" ? updatedArray : inst.createdSkillIds).length === 0 &&
            (field === "createdDocumentIds" ? updatedArray : inst.createdDocumentIds).length ===
                0 &&
            (field === "createdWorkflowIds" ? updatedArray : inst.createdWorkflowIds).length ===
                0 &&
            (field === "createdNetworkIds" ? updatedArray : inst.createdNetworkIds).length === 0 &&
            (field === "createdCampaignIds" ? updatedArray : inst.createdCampaignIds).length === 0;

        await prisma.playbookInstallation.update({
            where: { id: inst.id },
            data: {
                [field]: updatedArray,
                ...(allEmpty ? { status: "UNINSTALLED" as const } : {})
            }
        });
    }
}
