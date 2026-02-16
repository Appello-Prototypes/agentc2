/**
 * POST /api/skills/activate
 *
 * Activate skills for a conversation thread.
 * Persists the activation in ThreadSkillState so subsequent turns
 * automatically load the skill's tools.
 *
 * Used by the activate-skill meta-tool.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { addThreadSkillActivations } from "@repo/mastra/skills";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { skillSlugs, threadId, agentId } = body as {
            skillSlugs?: string[];
            threadId?: string;
            agentId?: string;
        };

        if (!skillSlugs || !Array.isArray(skillSlugs) || skillSlugs.length === 0) {
            return NextResponse.json(
                { error: "skillSlugs must be a non-empty array of strings" },
                { status: 400 }
            );
        }

        // Validate that the requested skills exist
        const skills = await prisma.skill.findMany({
            where: { slug: { in: skillSlugs } },
            select: {
                slug: true,
                name: true,
                description: true,
                tools: { select: { toolId: true } }
            }
        });

        const foundSlugs = skills.map((s) => s.slug);
        const notFound = skillSlugs.filter((s) => !foundSlugs.includes(s));

        // Persist activation if threadId is provided
        let allActivated: string[] = foundSlugs;
        if (threadId) {
            allActivated = await addThreadSkillActivations(
                threadId,
                agentId || "unknown",
                foundSlugs
            );
        }

        // Build response with tool information
        const activated = skills.map((s) => ({
            slug: s.slug,
            name: s.name,
            description: s.description,
            toolCount: s.tools.length,
            toolNames: s.tools.map((t) => t.toolId)
        }));

        return NextResponse.json({
            activated,
            allActiveSkills: allActivated,
            notFound: notFound.length > 0 ? notFound : undefined,
            totalToolsLoaded: activated.reduce((sum, s) => sum + s.toolCount, 0)
        });
    } catch (error) {
        console.error("[Skills Activate] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Activation failed" },
            { status: 500 }
        );
    }
}
