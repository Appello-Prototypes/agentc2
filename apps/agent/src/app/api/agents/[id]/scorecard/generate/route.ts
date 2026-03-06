import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { generateScorecard } from "@repo/agentc2/scorers";
import { requireAuth } from "@/lib/authz/require-auth";
import { requireAgentAccess } from "@/lib/authz/require-agent-access";

/**
 * POST /api/agents/[id]/scorecard/generate
 *
 * Auto-generate recommended scorecard criteria based on agent config.
 * Returns criteria + reasoning for user review -- does NOT save.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { context, response: authResponse } = await requireAuth(request);
        if (authResponse) return authResponse;
        const { agentId, response: accessResponse } = await requireAgentAccess(
            context.organizationId,
            id
        );
        if (accessResponse) return accessResponse;

        const agent = await prisma.agent.findUnique({
            where: { id: agentId },
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

        const result = await generateScorecard(
            {
                name: agent!.name,
                description: agent!.description,
                instructions: agent!.instructions,
                tools: agent!.tools,
                skills: agent!.skills.map((as) => ({
                    skill: {
                        name: as.skill.name,
                        instructions: as.skill.instructions
                    }
                }))
            },
            context.organizationId
        );

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
