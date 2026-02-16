import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";
import { validateCriteriaWeights } from "@repo/mastra/scorers";
import type { ScorecardCriterion } from "@repo/mastra/scorers";

/**
 * GET /api/agents/[id]/scorecard
 *
 * Returns the agent's scorecard with criteria, or null if none.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const agent = await prisma.agent.findFirst({
            where: { OR: [{ slug: id }, { id }] }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        const scorecard = await prisma.agentScorecard.findUnique({
            where: { agentId: agent.id },
            include: { template: true }
        });

        return NextResponse.json({
            success: true,
            scorecard: scorecard
                ? {
                      id: scorecard.id,
                      agentId: scorecard.agentId,
                      criteria: scorecard.criteria,
                      version: scorecard.version,
                      samplingRate: scorecard.samplingRate,
                      auditorModel: scorecard.auditorModel,
                      evaluateTurns: scorecard.evaluateTurns,
                      templateId: scorecard.templateId,
                      template: scorecard.template
                          ? {
                                slug: scorecard.template.slug,
                                name: scorecard.template.name
                            }
                          : null,
                      createdAt: scorecard.createdAt,
                      updatedAt: scorecard.updatedAt
                  }
                : null
        });
    } catch (error) {
        console.error("[Agent Scorecard GET] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get scorecard"
            },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/agents/[id]/scorecard
 *
 * Creates or updates the agent's scorecard.
 * Body: { criteria, samplingRate?, auditorModel?, evaluateTurns? }
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { criteria, samplingRate, auditorModel, evaluateTurns } = body as {
            criteria: ScorecardCriterion[];
            samplingRate?: number;
            auditorModel?: string;
            evaluateTurns?: boolean;
        };

        if (!criteria || !Array.isArray(criteria) || criteria.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: "criteria is required and must be a non-empty array"
                },
                { status: 400 }
            );
        }

        // Validate weights sum to 1.0
        const validation = validateCriteriaWeights(criteria);
        if (!validation.valid) {
            return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
        }

        const agent = await prisma.agent.findFirst({
            where: { OR: [{ slug: id }, { id }] }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        // Check if scorecard exists
        const existing = await prisma.agentScorecard.findUnique({
            where: { agentId: agent.id }
        });

        let scorecard;
        if (existing) {
            // Update: bump version
            scorecard = await prisma.agentScorecard.update({
                where: { agentId: agent.id },
                data: {
                    criteria: criteria as unknown as Prisma.InputJsonValue,
                    version: existing.version + 1,
                    samplingRate: samplingRate ?? existing.samplingRate,
                    auditorModel: auditorModel ?? existing.auditorModel,
                    evaluateTurns: evaluateTurns ?? existing.evaluateTurns
                }
            });
        } else {
            // Create new
            scorecard = await prisma.agentScorecard.create({
                data: {
                    agentId: agent.id,
                    tenantId: agent.tenantId,
                    criteria: criteria as unknown as Prisma.InputJsonValue,
                    samplingRate: samplingRate ?? 1.0,
                    auditorModel: auditorModel ?? "gpt-4o-mini",
                    evaluateTurns: evaluateTurns ?? false
                }
            });
        }

        return NextResponse.json({
            success: true,
            scorecard: {
                id: scorecard.id,
                agentId: scorecard.agentId,
                criteria: scorecard.criteria,
                version: scorecard.version,
                samplingRate: scorecard.samplingRate,
                auditorModel: scorecard.auditorModel,
                evaluateTurns: scorecard.evaluateTurns,
                updatedAt: scorecard.updatedAt
            }
        });
    } catch (error) {
        console.error("[Agent Scorecard PUT] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to update scorecard"
            },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/agents/[id]/scorecard
 *
 * Removes the agent's scorecard (falls back to default).
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const agent = await prisma.agent.findFirst({
            where: { OR: [{ slug: id }, { id }] }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        const existing = await prisma.agentScorecard.findUnique({
            where: { agentId: agent.id }
        });

        if (!existing) {
            return NextResponse.json(
                {
                    success: false,
                    error: "No scorecard exists for this agent"
                },
                { status: 404 }
            );
        }

        await prisma.agentScorecard.delete({
            where: { agentId: agent.id }
        });

        return NextResponse.json({
            success: true,
            message: "Scorecard deleted. Agent will use default evaluation criteria."
        });
    } catch (error) {
        console.error("[Agent Scorecard DELETE] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to delete scorecard"
            },
            { status: 500 }
        );
    }
}
