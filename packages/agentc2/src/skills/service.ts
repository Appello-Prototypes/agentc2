/**
 * Skill Service
 *
 * Manages Skill CRUD with composition (documents, tools, agent attachment).
 * Skills are composable competency bundles that attach to Agents, providing
 * procedural knowledge, reference documents, and tool bindings.
 */

import { prisma, Prisma } from "@repo/database";
import { toolRegistry } from "../tools/registry";

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
    organizationId?: string;
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
    organizationId?: string;
    category?: string;
    tags?: string[];
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
            workspaceId: input.workspaceId!,
            organizationId: input.organizationId!,
            createdBy: input.createdBy
        }
    });

    return skill;
}

/**
 * Resolve a skill ID or slug to the internal CUID.
 * organizationId is required for tenant-scoped resolution.
 */
async function resolveSkillId(idOrSlug: string, organizationId?: string): Promise<string> {
    const orgFilter = organizationId ? { organizationId } : {};
    const skill = await prisma.skill.findFirst({
        where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], ...orgFilter },
        select: { id: true }
    });
    if (!skill) throw new Error(`Skill not found: ${idOrSlug}`);
    return skill.id;
}

/**
 * Update a skill
 */
export async function updateSkill(
    idOrSlug: string,
    input: UpdateSkillInput,
    organizationId?: string
) {
    const id = await resolveSkillId(idOrSlug, organizationId);
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
 * Delete a skill (cascades to versions, junctions).
 * organizationId scopes the lookup and verifies ownership.
 */
export async function deleteSkill(idOrSlug: string, organizationId?: string) {
    const id = await resolveSkillId(idOrSlug, organizationId);
    if (organizationId) {
        const skill = await prisma.skill.findUnique({
            where: { id },
            select: { organizationId: true }
        });
        if (skill && skill.organizationId !== organizationId) {
            throw new Error("Skill does not belong to your organization");
        }
    }
    await prisma.skill.delete({
        where: { id }
    });
}

/**
 * Get a single skill by ID or slug with its documents and tools.
 * When organizationId is provided, only returns skills owned by that org or SYSTEM skills.
 */
export async function getSkill(idOrSlug: string, organizationId?: string) {
    const where: Record<string, unknown> = {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }]
    };
    if (organizationId) {
        where.organizationId = organizationId;
    }

    const skill = await prisma.skill.findFirst({
        where,
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

    // Organization scoping: show skills from the caller's org + SYSTEM skills (organizationId: null)
    if (input.organizationId) {
        where.organizationId = input.organizationId;
    } else if (input.workspaceId) {
        where.workspaceId = input.workspaceId;
    }
    if (input.category) where.category = input.category;
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
                },
                _count: {
                    select: { tools: true, documents: true, agents: true }
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
async function createSkillVersionForCompositionChange(skillId: string, changeSummary: string) {
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
 * Attach a document to a skill (creates skill version).
 * Validates that both entities belong to the same organization.
 */
export async function attachDocument(skillId: string, documentId: string, role?: string) {
    const [skill, doc] = await Promise.all([
        prisma.skill.findUnique({ where: { id: skillId }, select: { organizationId: true } }),
        prisma.document.findUnique({
            where: { id: documentId },
            select: { slug: true, organizationId: true }
        })
    ]);
    if (!skill || !doc) throw new Error("Skill or document not found");
    if (skill.organizationId !== doc.organizationId) {
        throw new Error("Cannot attach a document from a different organization");
    }

    const junction = await prisma.skillDocument.create({
        data: { skillId, documentId, role }
    });

    await createSkillVersionForCompositionChange(
        skillId,
        `Attached document: ${doc.slug || documentId}`
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
 * Attach a tool to a skill (creates skill version).
 * skillIdOrSlug accepts a CUID or slug.
 *
 * Validates that the toolId exists in the static registry or matches an MCP
 * tool naming pattern (serverName_toolName). Non-existent static tools are
 * rejected; MCP tools are accepted with a logged warning since they're dynamic.
 */
export async function attachTool(
    skillIdOrSlug: string,
    toolId: string,
    organizationId?: string
): Promise<{ id: string; skillId: string; toolId: string; warning?: string }> {
    // Validate tool existence
    const existsInRegistry = toolId in toolRegistry;
    const isMcpPattern = toolId.includes("_");
    let warning: string | undefined;

    if (!existsInRegistry && !isMcpPattern) {
        throw new Error(
            `Tool "${toolId}" not found in the tool registry. ` +
                `Verify the tool ID is correct. Available tools can be listed with tool-registry-list.`
        );
    }

    if (!existsInRegistry && isMcpPattern) {
        warning = `Tool "${toolId}" is not in the static registry (assumed MCP tool). It will only be available when the MCP server is running.`;
        console.warn(`[SkillService] ${warning}`);
    }

    const skillId = await resolveSkillId(skillIdOrSlug, organizationId);
    const junction = await prisma.skillTool.create({
        data: { skillId, toolId }
    });

    await createSkillVersionForCompositionChange(skillId, `Attached tool: ${toolId}`);

    return { ...junction, warning };
}

/**
 * Detach a tool from a skill (creates skill version).
 * skillIdOrSlug accepts a CUID or slug.
 */
export async function detachTool(skillIdOrSlug: string, toolId: string, organizationId?: string) {
    const skillId = await resolveSkillId(skillIdOrSlug, organizationId);
    await prisma.skillTool.delete({
        where: {
            skillId_toolId: { skillId, toolId }
        }
    });

    await createSkillVersionForCompositionChange(skillId, `Detached tool: ${toolId}`);
}

// ===========================
// Composition: Agent Binding
// ===========================

/**
 * Resolve an agent ID or slug to the internal CUID.
 * organizationId scopes the lookup to prevent cross-tenant resolution.
 */
async function resolveAgentId(idOrSlug: string, organizationId?: string): Promise<string> {
    const orgFilter = organizationId ? { workspace: { organizationId } } : {};
    const agent = await prisma.agent.findFirst({
        where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], ...orgFilter },
        select: { id: true }
    });
    if (!agent) throw new Error(`Agent not found: ${idOrSlug}`);
    return agent.id;
}

/**
 * Helper: Create an agent version snapshot when skills change.
 * Follows the same pattern as agent PUT route versioning.
 */
async function createAgentVersionForSkillChange(agentId: string, changeDescription: string) {
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
        tools: agent.tools.map((t) => ({ toolId: t.toolId, config: t.config })),
        skills: agent.skills.map((s) => ({
            skillId: s.skillId,
            skillSlug: s.skill.slug,
            skillVersion: s.skill.version,
            pinned: s.pinned
        })),
        visibility: agent.visibility,
        isActive: agent.isActive,
        metadata: agent.metadata
    };

    await prisma.$transaction([
        prisma.agentVersion.create({
            data: {
                agentId,
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
 * Attach a skill to an agent (creates agent version).
 * Validates that both entities belong to the same organization.
 * @param pinned - If true (default), skill tools are injected directly. If false, skill is discoverable via meta-tools.
 */
export async function attachToAgent(
    agentIdOrSlug: string,
    skillIdOrSlug: string,
    pinned?: boolean,
    organizationId?: string
) {
    const agentId = await resolveAgentId(agentIdOrSlug, organizationId);
    const skillId = await resolveSkillId(skillIdOrSlug, organizationId);

    const [agent, skill] = await Promise.all([
        prisma.agent.findUnique({
            where: { id: agentId },
            select: { workspace: { select: { organizationId: true } } }
        }),
        prisma.skill.findUniqueOrThrow({
            where: { id: skillId },
            select: { slug: true, organizationId: true }
        })
    ]);

    if (agent?.workspace?.organizationId !== skill.organizationId) {
        throw new Error("Cannot attach a skill from a different organization");
    }

    const junction = await prisma.agentSkill.create({
        data: { agentId, skillId, pinned: pinned ?? true }
    });

    // Increment install count on the skill
    await prisma.skill.update({
        where: { id: skillId },
        data: { installCount: { increment: 1 } }
    });

    const newVersion = await createAgentVersionForSkillChange(
        agentId,
        `Attached skill: ${skill.slug}${pinned ? " (pinned)" : ""}`
    );

    return { ...junction, agentVersion: newVersion };
}

/**
 * Detach a skill from an agent (creates agent version)
 */
export async function detachFromAgent(
    agentIdOrSlug: string,
    skillIdOrSlug: string,
    organizationId?: string
) {
    const agentId = await resolveAgentId(agentIdOrSlug, organizationId);
    const skillId = await resolveSkillId(skillIdOrSlug, organizationId);

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

    // Decrement install count on the skill
    await prisma.skill.update({
        where: { id: skillId },
        data: { installCount: { decrement: 1 } }
    });

    // Create agent version after the skill is detached
    const newVersion = await createAgentVersionForSkillChange(
        agentId,
        `Detached skill: ${skill.slug}`
    );

    return { agentVersion: newVersion };
}

/**
 * Fork a skill — create a USER copy of an existing skill (typically SYSTEM).
 * Copies instructions, description, category, tags, tools, and documents.
 * Adds forkedFrom metadata to track origin.
 */
export async function forkSkill(
    idOrSlug: string,
    options?: { slug?: string; name?: string; createdBy?: string; organizationId?: string }
) {
    const sourceId = await resolveSkillId(idOrSlug, options?.organizationId);
    const source = await prisma.skill.findUniqueOrThrow({
        where: { id: sourceId },
        include: {
            tools: { select: { toolId: true } },
            documents: { select: { documentId: true, role: true } }
        }
    });

    const newSlug = options?.slug || `${source.slug}-custom`;
    const newName = options?.name || `${source.name} (Custom)`;

    // Create the forked skill
    const forked = await prisma.skill.create({
        data: {
            slug: newSlug,
            name: newName,
            description: source.description,
            instructions: source.instructions,
            examples: source.examples,
            category: source.category,
            tags: source.tags,
            metadata: {
                forkedFrom: {
                    skillId: source.id,
                    skillSlug: source.slug,
                    skillVersion: source.version
                }
            } as unknown as Prisma.InputJsonValue,
            workspaceId: source.workspaceId,
            organizationId: options?.organizationId ?? source.organizationId,
            createdBy: options?.createdBy
        }
    });

    // Copy tool attachments
    if (source.tools.length > 0) {
        await prisma.skillTool.createMany({
            data: source.tools.map((t) => ({
                skillId: forked.id,
                toolId: t.toolId
            })),
            skipDuplicates: true
        });
    }

    // Copy document attachments
    if (source.documents.length > 0) {
        await prisma.skillDocument.createMany({
            data: source.documents.map((d) => ({
                skillId: forked.id,
                documentId: d.documentId,
                role: d.role
            })),
            skipDuplicates: true
        });
    }

    return forked;
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
