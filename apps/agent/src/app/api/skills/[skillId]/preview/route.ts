/**
 * GET /api/skills/[skillId]/preview?agentId=...
 *
 * Preview what attaching a skill to an agent would look like.
 * Returns: tools to be added, instructions to be appended, conflicts.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

type RouteContext = { params: Promise<{ skillId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const { skillId } = await context.params;
        const agentId = request.nextUrl.searchParams.get("agentId");

        // Get the skill
        const skill = await prisma.skill.findFirst({
            where: { OR: [{ id: skillId }, { slug: skillId }] },
            include: {
                tools: { select: { toolId: true } },
                documents: {
                    include: {
                        document: { select: { id: true, name: true, slug: true } }
                    }
                }
            }
        });

        if (!skill) {
            return NextResponse.json({ error: "Skill not found" }, { status: 404 });
        }

        const skillToolIds = skill.tools.map((t) => t.toolId);
        const skillDocumentIds = skill.documents.map((d) => d.documentId);

        // If agentId provided, compare against current agent tools
        let agentInfo = null;
        let conflicts: string[] = [];
        let currentToolCount = 0;

        if (agentId) {
            const agent = await prisma.agent.findFirst({
                where: { OR: [{ id: agentId }, { slug: agentId }] },
                include: {
                    tools: { select: { toolId: true } },
                    skills: {
                        include: {
                            skill: {
                                include: { tools: { select: { toolId: true } } }
                            }
                        }
                    }
                }
            });

            if (agent) {
                // Current tools = direct tools + all skill tools
                const currentTools = new Set<string>();
                agent.tools.forEach((t) => currentTools.add(t.toolId));
                agent.skills.forEach((as) => {
                    as.skill.tools.forEach((t) => currentTools.add(t.toolId));
                });

                currentToolCount = currentTools.size;

                // Find conflicts (tools that already exist)
                conflicts = skillToolIds.filter((id) => currentTools.has(id));

                agentInfo = {
                    slug: agent.slug,
                    name: agent.name,
                    currentToolCount,
                    afterToolCount:
                        currentToolCount + skillToolIds.filter((id) => !currentTools.has(id)).length
                };
            }
        }

        return NextResponse.json({
            skill: {
                slug: skill.slug,
                name: skill.name,
                description: skill.description
            },
            toolsToAdd: skillToolIds,
            toolCount: skillToolIds.length,
            documentsToAdd: skill.documents.map((d) => ({
                id: d.document.id,
                name: d.document.name,
                role: d.role
            })),
            documentCount: skillDocumentIds.length,
            instructionsPreview: skill.instructions.slice(0, 500),
            instructionsLength: skill.instructions.length,
            agent: agentInfo,
            conflicts
        });
    } catch (error) {
        console.error("[Skills Preview] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Preview failed" },
            { status: 500 }
        );
    }
}
