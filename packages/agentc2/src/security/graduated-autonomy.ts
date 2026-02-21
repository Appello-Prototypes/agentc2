import { prisma } from "@repo/database";

export type AutonomyLevel = "supervised" | "semi_autonomous" | "autonomous";

export interface AutonomyDecision {
    level: AutonomyLevel;
    trustScore: number;
    requiresApproval: boolean;
    maxAutonomousSpendUsd: number | null;
    reason: string;
}

/**
 * Resolve the current autonomy level for an agent based on trust score and policies.
 * Maps trust score to spending permissions via graduated tiers.
 */
export async function resolveAutonomyLevel(agentId: string): Promise<AutonomyDecision> {
    const [reputation, budgetPolicy] = await Promise.all([
        prisma.agentReputation.findUnique({ where: { agentId } }),
        prisma.budgetPolicy.findUnique({ where: { agentId } })
    ]);

    const trustScore = reputation?.trustScore ?? 0;
    const autonomyTier = (reputation?.autonomyTier ?? "supervised") as AutonomyLevel;

    switch (autonomyTier) {
        case "autonomous":
            return {
                level: "autonomous",
                trustScore,
                requiresApproval: false,
                maxAutonomousSpendUsd: budgetPolicy?.maxPerActionUsd ?? null,
                reason: `Trust score ${trustScore} >= 75 — full autonomy within budget limits`
            };

        case "semi_autonomous":
            return {
                level: "semi_autonomous",
                trustScore,
                requiresApproval: true,
                maxAutonomousSpendUsd: budgetPolicy?.maxPerActionUsd
                    ? budgetPolicy.maxPerActionUsd * 0.25
                    : null,
                reason: `Trust score ${trustScore} (40-75) — approval required above threshold`
            };

        default:
            return {
                level: "supervised",
                trustScore,
                requiresApproval: true,
                maxAutonomousSpendUsd: 0,
                reason: `Trust score ${trustScore} < 40 — all financial actions require approval`
            };
    }
}
