import { prisma } from "@repo/database";

export async function listPublicSkills(options?: {
    category?: string;
    search?: string;
    limit?: number;
    offset?: number;
}) {
    const where: Record<string, unknown> = { isPublic: true };
    if (options?.category) where.category = options.category;
    if (options?.search) {
        where.OR = [
            { name: { contains: options.search, mode: "insensitive" } },
            { description: { contains: options.search, mode: "insensitive" } }
        ];
    }

    const [skills, total] = await Promise.all([
        prisma.skill.findMany({
            where,
            orderBy: { installCount: "desc" },
            take: options?.limit ?? 20,
            skip: options?.offset ?? 0,
            select: {
                id: true,
                slug: true,
                name: true,
                description: true,
                category: true,
                tags: true,
                version: true,
                installCount: true,
                rating: true,
                createdAt: true,
                workspace: {
                    select: {
                        organization: { select: { name: true, slug: true } }
                    }
                }
            }
        }),
        prisma.skill.count({ where })
    ]);

    return { skills, total };
}

export async function publishSkill(skillId: string, organizationId?: string) {
    if (organizationId) {
        const skill = await prisma.skill.findUnique({
            where: { id: skillId },
            select: { organizationId: true }
        });
        if (skill && skill.organizationId !== organizationId) {
            throw new Error("Skill does not belong to your organization");
        }
    }
    return prisma.skill.update({
        where: { id: skillId },
        data: { isPublic: true }
    });
}

export async function unpublishSkill(skillId: string, organizationId?: string) {
    if (organizationId) {
        const skill = await prisma.skill.findUnique({
            where: { id: skillId },
            select: { organizationId: true }
        });
        if (skill && skill.organizationId !== organizationId) {
            throw new Error("Skill does not belong to your organization");
        }
    }
    return prisma.skill.update({
        where: { id: skillId },
        data: { isPublic: false }
    });
}

export async function installSkill(params: {
    sourceSkillId: string;
    targetWorkspaceId: string;
}): Promise<{ skillId: string }> {
    const source = await prisma.skill.findUniqueOrThrow({
        where: { id: params.sourceSkillId },
        include: { tools: true, documents: true }
    });

    const targetWs = await prisma.workspace.findUniqueOrThrow({
        where: { id: params.targetWorkspaceId },
        select: { organizationId: true }
    });

    const installed = await prisma.skill.create({
        data: {
            slug: source.slug,
            name: source.name,
            description: source.description,
            instructions: source.instructions,
            examples: source.examples,
            category: source.category,
            tags: source.tags,
            workspaceId: params.targetWorkspaceId,
            organizationId: targetWs.organizationId,
            metadata: {
                installedFrom: params.sourceSkillId,
                installedAt: new Date().toISOString()
            }
        }
    });

    // Increment install count on source
    await prisma.skill.update({
        where: { id: params.sourceSkillId },
        data: { installCount: { increment: 1 } }
    });

    return { skillId: installed.id };
}
