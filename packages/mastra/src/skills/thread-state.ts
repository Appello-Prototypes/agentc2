/**
 * Thread Skill State Service
 *
 * Persists activated skills per conversation thread so that when an agent
 * activates a skill via meta-tools during a conversation, subsequent turns
 * automatically load those skills without re-discovery.
 */

import { prisma } from "@repo/database";

/**
 * Get activated skill slugs for a thread.
 */
export async function getThreadSkillState(threadId: string): Promise<string[]> {
    const state = await prisma.threadSkillState.findUnique({
        where: { threadId },
        select: { skillSlugs: true }
    });
    return state?.skillSlugs ?? [];
}

/**
 * Store activated skill slugs for a thread.
 * Merges with existing activations (union, no duplicates).
 */
export async function addThreadSkillActivations(
    threadId: string,
    agentId: string,
    skillSlugs: string[]
): Promise<string[]> {
    const existing = await getThreadSkillState(threadId);
    const merged = [...new Set([...existing, ...skillSlugs])];

    await prisma.threadSkillState.upsert({
        where: { threadId },
        update: { skillSlugs: merged },
        create: { threadId, agentId, skillSlugs: merged }
    });

    return merged;
}

/**
 * Replace the full skill activation list for a thread.
 */
export async function setThreadSkillState(
    threadId: string,
    agentId: string,
    skillSlugs: string[]
): Promise<void> {
    await prisma.threadSkillState.upsert({
        where: { threadId },
        update: { skillSlugs },
        create: { threadId, agentId, skillSlugs }
    });
}

/**
 * Clear skill activations for a thread (e.g., when resetting a conversation).
 */
export async function clearThreadSkillState(threadId: string): Promise<void> {
    await prisma.threadSkillState.deleteMany({
        where: { threadId }
    });
}
