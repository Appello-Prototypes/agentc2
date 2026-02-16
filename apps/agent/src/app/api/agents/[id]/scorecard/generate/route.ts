import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { generateScorecard } from "@repo/mastra/scorers";

/**
 * POST /api/agents/[id]/scorecard/generate
 *
 * Auto-generate recommended scorecard criteria based on agent config.
 * Returns criteria + reasoning for user review -- does NOT save.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const agent = await prisma.agent.findFirst({
            where: { OR: [{ slug: id }, { id }] },
            include: {
                tools: { select: { toolId: true } },
                skills: {
                    include: {
                        skill: {
                            select: {
                                name: true,
                                slug: true,
                                instructions: true
                            }
                        }
                    }
                }
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        const result = await generateScorecard({
            name: agent.name,
            description: agent.description,
            instructions: agent.instructions,
            tools: agent.tools,
            skills: agent.skills.map((as) => ({
                skill: {
                    name: as.skill.name,
                    instructions: as.skill.instructions
                }
            }))
        });

        return NextResponse.json({
            success: true,
            criteria: result.criteria,
            reasoning: result.reasoning
        });
    } catch (error) {
        console.error("[Scorecard Generate] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to generate scorecard"
            },
            { status: 500 }
        );
    }
}
