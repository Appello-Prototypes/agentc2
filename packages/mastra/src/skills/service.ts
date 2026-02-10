/**
 * Skill Service
 *
 * Manages Skill CRUD with composition (documents, tools, agent attachment).
 * Skills are composable competency bundles that attach to Agents, providing
 * procedural knowledge, reference documents, and tool bindings.
 */

import { prisma, Prisma } from "@repo/database";

export interface CreateSkillInput {
    slug: string;
    name: string;
    description?: string;
    instructions: string;
    examples?: string;
    category?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
    workspaceId?: string;
    type?: "USER" | "SYSTEM";
    createdBy?: string;
}

export interface UpdateSkillInput {
    name?: string;
    description?: string;
    instructions?: string;
    examples?: string;
    category?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
    changeSummary?: string;
    createdBy?: string;
}

export interface ListSkillsInput {
    workspaceId?: string;
    category?: string;
    tags?: string[];
    type?: "USER" | "SYSTEM";
    skip?: number;
    take?: number;
}

/**
 * Create a skill
 */
export async function createSkill(input: CreateSkillInput) {
    const skill = await prisma.skill.create({
        data: {
            slug: input.slug,
            name: input.name,
            description: input.description,
            instructions: input.instructions,
            examples: input.examples,
            category: input.category,
            tags: input.tags || [],
            metadata: (input.metadata || {}) as Prisma.InputJsonValue,
            workspaceId: input.workspaceId,
            type: input.type || "USER",
            createdBy: input.createdBy
        }
    });

    return skill;
}

/**
 * Resolve a skill ID or slug to the internal CUID.
 */
async function resolveSkillId(idOrSlug: string): Promise<string> {
    const skill = await prisma.skill.findFirst({
        where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
        select: { id: true }
    });
    if (!skill) throw new Error(`Skill not found: ${idOrSlug}`);
    return skill.id;
}

/**
 * Update a skill
 */
export async function updateSkill(idOrSlug: string, input: UpdateSkillInput) {
    const id = await resolveSkillId(idOrSlug);
    const existing = await prisma.skill.findUniqueOrThrow({
        where: { id }
    });

    const instructionsChanged =
        input.instructions !== undefined && input.instructions !== existing.instructions;

    // If instructions changed, create version snapshot
    if (instructionsChanged) {
        // Get current documents and tools for snapshot
        const [docs, tools] = await Promise.all([
            prisma.skillDocument.findMany({
                where: { skillId: id },
                select: { documentId: true, role: true }
            }),
            prisma.skillTool.findMany({
                where: { skillId: id },
                select: { toolId: true }
            })
        ]);

        await prisma.skillVersion.create({
            data: {
                skillId: id,
                version: existing.version,
                instructions: existing.instructions,
                configJson: { documents: docs, tools } as unknown as Prisma.InputJsonValue,
                changeSummary: input.changeSummary,
                createdBy: input.createdBy
            }
        });
    }

    const skill = await prisma.skill.update({
        where: { id },
        data: {
            name: input.name,
            description: input.description,
            instructions: input.instructions,
            examples: input.examples,
            category: input.category,
            tags: input.tags,
            metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : undefined,
            version: instructionsChanged ? existing.version + 1 : undefined
        }
    });

    return skill;
}

/**
 * Delete a skill (cascades to versions, junctions)
 */
export async function deleteSkill(idOrSlug: string) {
    const id = await resolveSkillId(idOrSlug);
    await prisma.skill.delete({
        where: { id }
    });
}

/**
 * Get a single skill by ID or slug with its documents and tools
 */
export async function getSkill(idOrSlug: string) {
    const skill = await prisma.skill.findFirst({
        where: {
            OR: [{ id: idOrSlug }, { slug: idOrSlug }]
        },
        include: {
            documents: {
                include: {
                    document: {
                        select: { id: true, slug: true, name: true, category: true }
                    }
                }
            },
            tools: true,
            agents: {
                include: {
                    agent: {
                        select: { id: true, slug: true, name: true }
                    }
                }
            }
        }
    });

    return skill;
}

/**
 * List skills with filtering
 */
export async function listSkills(input: ListSkillsInput = {}) {
    const where: Record<string, unknown> = {};

    if (input.workspaceId) where.workspaceId = input.workspaceId;
    if (input.category) where.category = input.category;
    if (input.type) where.type = input.type;
    if (input.tags && input.tags.length > 0) {
        where.tags = { hasSome: input.tags };
    }

    const [skills, total] = await Promise.all([
        prisma.skill.findMany({
            where,
            skip: input.skip || 0,
            take: input.take || 50,
            orderBy: { updatedAt: "desc" },
            include: {
                documents: {
                    select: { documentId: true, role: true }
                },
                tools: {
                    select: { toolId: true }
                },
                agents: {
                    select: { agentId: true }
                }
            }
        }),
        prisma.skill.count({ where })
    ]);

    return { skills, total };
}

// ===========================
// Composition: Versioning Helper
// ===========================

/**
 * Helper: Create a skill version snapshot when composition changes.
 */
async function createSkillVersionForCompositionChange(
    skillId: string,
    changeSummary: string
) {
    const skill = await prisma.skill.findUniqueOrThrow({
        where: { id: skillId }
    });

    const [docs, tools] = await Promise.all([
        prisma.skillDocument.findMany({
            where: { skillId },
            select: { documentId: true, role: true }
        }),
        prisma.skillTool.findMany({
            where: { skillId },
            select: { toolId: true }
        })
    ]);

    await prisma.skillVersion.create({
        data: {
            skillId,
            version: skill.version,
            instructions: skill.instructions,
            configJson: { documents: docs, tools } as unknown as Prisma.InputJsonValue,
            changeSummary
        }
    });

    await prisma.skill.update({
        where: { id: skillId },
        data: { version: skill.version + 1 }
    });
}

// ===========================
// Composition: Documents
// ===========================

/**
 * Attach a document to a skill (creates skill version)
 */
export async function attachDocument(skillId: string, documentId: string, role?: string) {
    const junction = await prisma.skillDocument.create({
        data: { skillId, documentId, role }
    });

    // Look up document slug for change summary
    const doc = await prisma.document.findUnique({
        where: { id: documentId },
        select: { slug: true }
    });
    await createSkillVersionForCompositionChange(
        skillId,
        `Attached document: ${doc?.slug || documentId}`
    );

    return junction;
}

/**
 * Detach a document from a skill (creates skill version)
 */
export async function detachDocument(skillId: string, documentId: string) {
    // Look up document slug before deleting
    const doc = await prisma.document.findUnique({
        where: { id: documentId },
        select: { slug: true }
    });

    await prisma.skillDocument.delete({
        where: {
            skillId_documentId: { skillId, documentId }
        }
    });

    await createSkillVersionForCompositionChange(
        skillId,
        `Detached document: ${doc?.slug || documentId}`
    );
}

// ===========================
// Composition: Tools
// ===========================

/**
 * Attach a tool to a skill (creates skill version)
 */
export async function attachTool(skillId: string, toolId: string) {
    const junction = await prisma.skillTool.create({
        data: { skillId, toolId }
    });

    await createSkillVersionForCompositionChange(
        skillId,
        `Attached tool: ${toolId}`
    );

    return junction;
}

/**
 * Detach a tool from a skill (creates skill version)
 */
export async function detachTool(skillId: string, toolId: string) {
    await prisma.skillTool.delete({
        where: {
            skillId_toolId: { skillId, toolId }
        }
    });

    await createSkillVersionForCompositionChange(
        skillId,
        `Detached tool: ${toolId}`
    );
}

// ===========================
// Composition: Agent Binding
// ===========================

/**
 * Resolve an agent ID or slug to the internal CUID.
 */
async function resolveAgentId(idOrSlug: string): Promise<string> {
    const agent = await prisma.agent.findFirst({
        where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
        select: { id: true }
    });
    if (!agent) throw new Error(`Agent not found: ${idOrSlug}`);
    return agent.id;
}

/**
 * Helper: Create an agent version snapshot when skills change.
 * Follows the same pattern as agent PUT route versioning.
 */
async function createAgentVersionForSkillChange(
    agentId: string,
    changeDescription: string
) {
    const agent = await prisma.agent.findUniqueOrThrow({
        where: { id: agentId },
        include: {
            tools: true,
            skills: {
                include: {
                    skill: { select: { id: true, slug: true, name: true, version: true } }
                }
            }
        }
    });

    const lastVersion = await prisma.agentVersion.findFirst({
        where: { agentId },
        orderBy: { version: "desc" },
        select: { version: true }
    });
    const nextVersion = (lastVersion?.version || agent.version || 0) + 1;

    const snapshot = {
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
        tools: agent.tools.map((t) => ({ toolId: t.toolId, config: t.config })),
        skills: agent.skills.map((s) => ({
            skillId: s.skillId,
            skillSlug: s.skill.slug,
            skillVersion: s.skill.version
        })),
        isPublic: agent.isPublic,
        isActive: agent.isActive,
        metadata: agent.metadata
    };

    await prisma.$transaction([
        prisma.agentVersion.create({
            data: {
                agentId,
                tenantId: agent.tenantId,
                version: nextVersion,
                description: changeDescription,
                instructions: agent.instructions,
                modelProvider: agent.modelProvider,
                modelName: agent.modelName,
                changesJson: [changeDescription],
                snapshot
            }
        }),
        prisma.agent.update({
            where: { id: agentId },
            data: { version: nextVersion }
        })
    ]);

    return nextVersion;
}

/**
 * Attach a skill to an agent (creates agent version)
 */
export async function attachToAgent(agentIdOrSlug: string, skillIdOrSlug: string) {
    const agentId = await resolveAgentId(agentIdOrSlug);
    const skillId = await resolveSkillId(skillIdOrSlug);

    // Get skill name for change description
    const skill = await prisma.skill.findUniqueOrThrow({
        where: { id: skillId },
        select: { slug: true }
    });

    const junction = await prisma.agentSkill.create({
        data: { agentId, skillId }
    });

    // Create agent version after the skill is attached
    const newVersion = await createAgentVersionForSkillChange(
        agentId,
        `Attached skill: ${skill.slug}`
    );

    return { ...junction, agentVersion: newVersion };
}

/**
 * Detach a skill from an agent (creates agent version)
 */
export async function detachFromAgent(agentIdOrSlug: string, skillIdOrSlug: string) {
    const agentId = await resolveAgentId(agentIdOrSlug);
    const skillId = await resolveSkillId(skillIdOrSlug);

    // Get skill name for change description
    const skill = await prisma.skill.findUniqueOrThrow({
        where: { id: skillId },
        select: { slug: true }
    });

    await prisma.agentSkill.delete({
        where: {
            agentId_skillId: { agentId, skillId }
        }
    });

    // Create agent version after the skill is detached
    const newVersion = await createAgentVersionForSkillChange(
        agentId,
        `Detached skill: ${skill.slug}`
    );

    return { agentVersion: newVersion };
}

/**
 * Get version history for a skill
 */
export async function getSkillVersions(skillId: string) {
    const versions = await prisma.skillVersion.findMany({
        where: { skillId },
        orderBy: { version: "desc" }
    });

    return versions;
}
