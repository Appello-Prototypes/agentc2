import { prisma } from "@repo/database";

/**
 * Calculate a trust score for an agent based on run history, costs, and outcomes.
 * Generalized from the calculateTrustScoreTool pattern in scenario-tools.ts.
 *
 * Formula weights:
 * - Success rate: 40% (successful runs / total runs)
 * - ROI efficiency: 25% (outcome value / cost)
 * - Volume: 15% (normalized by expected run count)
 * - Error rate penalty: 20% (inverted — more errors = lower score)
 */
export async function calculateTrustScore(agentId: string): Promise<number> {
    const reputation = await prisma.agentReputation.findUnique({ where: { agentId } });

    if (!reputation || reputation.totalRuns === 0) return 0;

    const successRate = reputation.successfulRuns / reputation.totalRuns;
    const errorRate = reputation.failedRuns / reputation.totalRuns;

    const roiEfficiency =
        reputation.totalSpendUsd > 0
            ? Math.min(reputation.totalRevenueUsd / reputation.totalSpendUsd, 5) / 5
            : 0;

    // Volume normalization: 100 runs = full volume score
    const volumeScore = Math.min(reputation.totalRuns / 100, 1);

    const trustScore =
        successRate * 40 + roiEfficiency * 25 + volumeScore * 15 + (1 - errorRate) * 20;

    return Math.round(Math.max(0, Math.min(100, trustScore)) * 100) / 100;
}

/**
 * Update an agent's reputation by aggregating from AgentRun, CostEvent, and AgentOutcome.
 */
export async function updateReputation(agentId: string) {
    const [runStats, costAgg, outcomeAgg, revenueAgg] = await Promise.all([
        prisma.agentRun.groupBy({
            by: ["status"],
            where: { agentId },
            _count: true
        }),
        prisma.costEvent.aggregate({
            where: { agentId },
            _sum: { costUsd: true }
        }),
        prisma.agentOutcome.aggregate({
            where: { agentId, success: true },
            _sum: { valueUsd: true }
        }),
        prisma.agentRevenueEvent.aggregate({
            where: { agentId },
            _sum: { amountUsd: true }
        })
    ]);

    let totalRuns = 0;
    let successfulRuns = 0;
    let failedRuns = 0;
    for (const stat of runStats) {
        totalRuns += stat._count;
        const s = stat.status as string;
        if (s === "completed") successfulRuns += stat._count;
        if (s === "failed" || s === "error") failedRuns += stat._count;
    }

    const totalSpendUsd = costAgg._sum.costUsd ?? 0;
    const totalRevenueUsd = (outcomeAgg._sum.valueUsd ?? 0) + (revenueAgg._sum.amountUsd ?? 0);

    const reputation = await prisma.agentReputation.upsert({
        where: { agentId },
        create: {
            agentId,
            totalRuns,
            successfulRuns,
            failedRuns,
            totalSpendUsd,
            totalRevenueUsd,
            trustScore: 0,
            lastCalculatedAt: new Date()
        },
        update: {
            totalRuns,
            successfulRuns,
            failedRuns,
            totalSpendUsd,
            totalRevenueUsd,
            lastCalculatedAt: new Date()
        }
    });

    const trustScore = await calculateTrustScore(agentId);

    const autonomyTier = resolveAutonomyTier(trustScore);

    return prisma.agentReputation.update({
        where: { id: reputation.id },
        data: { trustScore, autonomyTier }
    });
}

function resolveAutonomyTier(trustScore: number): string {
    if (trustScore >= 75) return "autonomous";
    if (trustScore >= 40) return "semi_autonomous";
    return "supervised";
}
