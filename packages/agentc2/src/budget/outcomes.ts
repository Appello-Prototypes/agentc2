import { prisma } from "@repo/database";

export async function recordOutcome(params: {
    agentId: string;
    runId?: string;
    outcomeType: string;
    valueUsd?: number;
    success?: boolean;
    metadata?: Record<string, unknown>;
}) {
    return prisma.agentOutcome.create({
        data: {
            agentId: params.agentId,
            runId: params.runId,
            outcomeType: params.outcomeType,
            valueUsd: params.valueUsd,
            success: params.success ?? true,
            metadata: params.metadata ?? undefined
        }
    });
}

export async function getAgentROI(
    agentId: string,
    periodDays: number = 30
): Promise<{
    totalCostUsd: number;
    totalOutcomeValueUsd: number;
    outcomeCount: number;
    costPerOutcome: number | null;
    roi: number | null;
}> {
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const [costAgg, outcomeAgg] = await Promise.all([
        prisma.costEvent.aggregate({
            where: { agentId, createdAt: { gte: since } },
            _sum: { costUsd: true }
        }),
        prisma.agentOutcome.aggregate({
            where: { agentId, createdAt: { gte: since }, success: true },
            _sum: { valueUsd: true },
            _count: true
        })
    ]);

    const totalCostUsd = costAgg._sum.costUsd ?? 0;
    const totalOutcomeValueUsd = outcomeAgg._sum.valueUsd ?? 0;
    const outcomeCount = outcomeAgg._count;
    const costPerOutcome = outcomeCount > 0 ? totalCostUsd / outcomeCount : null;
    const roi = totalCostUsd > 0 ? (totalOutcomeValueUsd - totalCostUsd) / totalCostUsd : null;

    return { totalCostUsd, totalOutcomeValueUsd, outcomeCount, costPerOutcome, roi };
}

export async function getCostPerOutcome(
    agentId: string,
    outcomeType: string,
    periodDays: number = 30
): Promise<{ costPerOutcome: number | null; outcomeCount: number; totalCostUsd: number }> {
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const [costAgg, outcomeCount] = await Promise.all([
        prisma.costEvent.aggregate({
            where: { agentId, createdAt: { gte: since } },
            _sum: { costUsd: true }
        }),
        prisma.agentOutcome.count({
            where: { agentId, outcomeType, createdAt: { gte: since }, success: true }
        })
    ]);

    const totalCostUsd = costAgg._sum.costUsd ?? 0;
    const costPerOutcome = outcomeCount > 0 ? totalCostUsd / outcomeCount : null;

    return { costPerOutcome, outcomeCount, totalCostUsd };
}
