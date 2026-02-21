import { prisma } from "@repo/database";

export async function recordRevenue(params: {
    agentId: string;
    revenueType: string;
    amountUsd: number;
    currency?: string;
    source?: string;
    referenceId?: string;
    metadata?: Record<string, unknown>;
}) {
    return prisma.agentRevenueEvent.create({
        data: {
            agentId: params.agentId,
            revenueType: params.revenueType,
            amountUsd: params.amountUsd,
            currency: params.currency ?? "USD",
            source: params.source,
            referenceId: params.referenceId,
            metadata: params.metadata ?? undefined
        }
    });
}

export async function getAgentRevenue(
    agentId: string,
    periodDays: number = 30
): Promise<{
    totalRevenueUsd: number;
    eventCount: number;
    byType: Record<string, number>;
}> {
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const events = await prisma.agentRevenueEvent.findMany({
        where: { agentId, createdAt: { gte: since } },
        select: { revenueType: true, amountUsd: true }
    });

    const totalRevenueUsd = events.reduce((sum, e) => sum + e.amountUsd, 0);
    const byType: Record<string, number> = {};
    for (const e of events) {
        byType[e.revenueType] = (byType[e.revenueType] ?? 0) + e.amountUsd;
    }

    return { totalRevenueUsd, eventCount: events.length, byType };
}
