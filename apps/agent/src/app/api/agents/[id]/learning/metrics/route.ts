import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /api/agents/[id]/learning/metrics
 *
 * Get learning KPIs and metrics for an agent
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);

        const days = Math.min(parseInt(searchParams.get("days") || "30"), 90);
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        // Find agent by slug or id
        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id: id }]
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        // Get all sessions for metrics
        const sessions = await prisma.learningSession.findMany({
            where: {
                agentId: agent.id,
                createdAt: { gte: startDate }
            },
            include: {
                proposals: true,
                experiments: true
            }
        });

        // Calculate KPIs
        const totalSessions = sessions.length;
        const promotedSessions = sessions.filter((s) => s.status === "PROMOTED").length;
        const rejectedSessions = sessions.filter((s) => s.status === "REJECTED").length;
        const failedSessions = sessions.filter((s) => s.status === "FAILED").length;
        const activeSessions = sessions.filter((s) =>
            ["COLLECTING", "ANALYZING", "PROPOSING", "TESTING", "AWAITING_APPROVAL"].includes(
                s.status
            )
        ).length;

        const totalProposals = sessions.reduce((sum, s) => sum + s.proposals.length, 0);
        const totalExperiments = sessions.reduce((sum, s) => sum + s.experiments.length, 0);
        const passedExperiments = sessions.reduce(
            (sum, s) => sum + s.experiments.filter((e) => e.gatingResult === "passed").length,
            0
        );

        // Calculate average improvement from promoted sessions
        let avgImprovementPct = 0;
        const promotedWithMetrics = sessions.filter(
            (s) =>
                s.status === "PROMOTED" &&
                s.experiments.some((e) => e.baselineMetrics && e.candidateMetrics)
        );

        if (promotedWithMetrics.length > 0) {
            const improvements = promotedWithMetrics.map((s) => {
                const exp = s.experiments[0];
                const baseline = (exp.baselineMetrics as { avgScore?: number })?.avgScore || 0;
                const candidate = (exp.candidateMetrics as { avgScore?: number })?.avgScore || 0;
                return baseline > 0 ? ((candidate - baseline) / baseline) * 100 : 0;
            });
            avgImprovementPct = improvements.reduce((a, b) => a + b, 0) / improvements.length;
        }

        // Get time-to-improve for promoted sessions
        const timeToImprove = promotedWithMetrics
            .filter((s) => s.completedAt)
            .map((s) => {
                const start = new Date(s.createdAt).getTime();
                const end = new Date(s.completedAt!).getTime();
                return (end - start) / (1000 * 60 * 60); // Hours
            });
        const avgTimeToImproveHours =
            timeToImprove.length > 0
                ? timeToImprove.reduce((a, b) => a + b, 0) / timeToImprove.length
                : 0;

        // Get daily metrics
        const dailyMetrics = await prisma.learningMetricDaily.findMany({
            where: {
                agentId: agent.id,
                date: { gte: startDate }
            },
            orderBy: { date: "asc" }
        });

        // Get recent evaluations coverage
        const recentRuns = await prisma.agentRun.count({
            where: {
                agentId: agent.id,
                status: "COMPLETED",
                createdAt: { gte: startDate }
            }
        });

        const evaluatedRuns = await prisma.agentEvaluation.count({
            where: {
                agentId: agent.id,
                createdAt: { gte: startDate }
            }
        });

        const evalCoverage = recentRuns > 0 ? (evaluatedRuns / recentRuns) * 100 : 0;

        return NextResponse.json({
            success: true,
            metrics: {
                summary: {
                    totalSessions,
                    activeSessions,
                    promotedSessions,
                    rejectedSessions,
                    failedSessions,
                    promotionRate:
                        totalSessions > 0
                            ? Math.round((promotedSessions / totalSessions) * 100)
                            : 0,
                    totalProposals,
                    totalExperiments,
                    experimentPassRate:
                        totalExperiments > 0
                            ? Math.round((passedExperiments / totalExperiments) * 100)
                            : 0,
                    avgImprovementPct: Math.round(avgImprovementPct * 10) / 10,
                    avgTimeToImproveHours: Math.round(avgTimeToImproveHours * 10) / 10,
                    evalCoverage: Math.round(evalCoverage * 10) / 10
                },
                daily: dailyMetrics.map((m) => ({
                    date: m.date.toISOString().split("T")[0],
                    sessionsStarted: m.sessionsStarted,
                    sessionsCompleted: m.sessionsCompleted,
                    proposalsGenerated: m.proposalsGenerated,
                    proposalsApproved: m.proposalsApproved,
                    proposalsRejected: m.proposalsRejected,
                    experimentsRun: m.experimentsRun,
                    experimentsPassed: m.experimentsPassed,
                    versionsPromoted: m.versionsPromoted,
                    avgImprovementPct: m.avgImprovementPct,
                    evalCoverage: m.evalCoverage
                })),
                period: {
                    days,
                    from: startDate.toISOString(),
                    to: new Date().toISOString()
                }
            }
        });
    } catch (error) {
        console.error("[Learning Metrics] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get learning metrics"
            },
            { status: 500 }
        );
    }
}
