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

export async function publishSkill(skillId: string) {
    return prisma.skill.update({
        where: { id: skillId },
        data: { isPublic: true }
    });
}

export async function unpublishSkill(skillId: string) {
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

    // Create a copy of the skill in the target workspace
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
