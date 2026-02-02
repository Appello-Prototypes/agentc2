import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /api/agents/[id]/learning/experiments
 *
 * List active and recent experiments for an agent
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);

        const status = searchParams.get("status"); // active, completed, all
        const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

        // Find agent by slug or id
        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id: id }],
                isActive: true
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        // Build where clause
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {
            session: { agentId: agent.id }
        };

        if (status === "active") {
            where.status = { in: ["PENDING", "RUNNING"] };
        } else if (status === "completed") {
            where.status = { in: ["COMPLETED", "PASSED", "FAILED"] };
        }

        // Get experiments
        const experiments = await prisma.learningExperiment.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: limit,
            include: {
                session: {
                    select: { id: true, status: true, baselineVersion: true }
                },
                proposal: {
                    select: {
                        id: true,
                        title: true,
                        proposalType: true,
                        riskTier: true,
                        autoEligible: true,
                        confidenceScore: true
                    }
                }
            }
        });

        // Format response
        const formattedExperiments = experiments.map((exp) => ({
            id: exp.id,
            sessionId: exp.sessionId,
            status: exp.status,
            proposalTitle: exp.proposal.title,
            proposalType: exp.proposal.proposalType,
            riskTier: exp.proposal.riskTier,
            autoEligible: exp.proposal.autoEligible,
            confidenceScore: exp.proposal.confidenceScore,
            trafficSplit: exp.trafficSplit,
            shadowRunCount: exp.shadowRunCount,
            baselineRunCount: exp.baselineRunCount,
            candidateRunCount: exp.candidateRunCount,
            baselineMetrics: exp.baselineMetrics,
            candidateMetrics: exp.candidateMetrics,
            winRate: exp.winRate,
            gatingResult: exp.gatingResult,
            startedAt: exp.startedAt,
            completedAt: exp.completedAt,
            createdAt: exp.createdAt
        }));

        // Get summary stats
        const activeCount = await prisma.learningExperiment.count({
            where: {
                session: { agentId: agent.id },
                status: { in: ["PENDING", "RUNNING"] }
            }
        });

        return NextResponse.json({
            success: true,
            experiments: formattedExperiments,
            summary: {
                activeExperiments: activeCount,
                totalShown: experiments.length
            }
        });
    } catch (error) {
        console.error("[Learning Experiments] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get experiments"
            },
            { status: 500 }
        );
    }
}
