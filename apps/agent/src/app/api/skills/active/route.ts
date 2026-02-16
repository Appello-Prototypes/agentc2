/**
 * GET /api/skills/active
 *
 * List currently activated skills for a conversation thread.
 * Used by the list-active-skills meta-tool.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { getThreadSkillState } from "@repo/mastra/skills";

export async function GET(request: NextRequest) {
    try {
        const threadId = request.nextUrl.searchParams.get("threadId");

        if (!threadId) {
            return NextResponse.json({
                skills: [],
                message: "No threadId provided"
            });
        }

        const activatedSlugs = await getThreadSkillState(threadId);

        if (activatedSlugs.length === 0) {
            return NextResponse.json({
                skills: [],
                message: "No skills activated for this thread"
            });
        }

        // Get full skill details with tools
        const skills = await prisma.skill.findMany({
            where: { slug: { in: activatedSlugs } },
            select: {
                slug: true,
                name: true,
                description: true,
                category: true,
                tools: { select: { toolId: true } }
            }
        });

        return NextResponse.json({
            skills: skills.map((s) => ({
                slug: s.slug,
                name: s.name,
                description: s.description,
                category: s.category,
                tools: s.tools.map((t) => t.toolId)
            })),
            totalTools: skills.reduce((sum, s) => sum + s.tools.length, 0)
        });
    } catch (error) {
        console.error("[Skills Active] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to list active skills" },
            { status: 500 }
        );
    }
}
