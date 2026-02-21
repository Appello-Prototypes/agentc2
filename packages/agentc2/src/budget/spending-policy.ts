import { prisma } from "@repo/database";

export type SpendingTier = "read_only" | "spend_with_approval" | "spend_autonomous";

export interface SpendingPermission {
    allowed: boolean;
    tier: SpendingTier;
    requiresApproval: boolean;
    maxPerActionUsd: number | null;
    maxPerSessionUsd: number | null;
    reason?: string;
}

export async function checkSpendingPermission(
    agentId: string,
    amountUsd: number
): Promise<SpendingPermission> {
    const policy = await prisma.budgetPolicy.findUnique({
        where: { agentId }
    });

    if (!policy) {
        return {
            allowed: false,
            tier: "read_only",
            requiresApproval: false,
            maxPerActionUsd: null,
            maxPerSessionUsd: null,
            reason: "No budget policy configured for this agent"
        };
    }

    const tier = (policy.spendingTier as SpendingTier) || "read_only";

    if (tier === "read_only") {
        return {
            allowed: false,
            tier,
            requiresApproval: false,
            maxPerActionUsd: policy.maxPerActionUsd,
            maxPerSessionUsd: policy.maxPerSessionUsd,
            reason: "Agent spending tier is read_only — financial tools are disabled"
        };
    }

    if (policy.maxPerActionUsd && amountUsd > policy.maxPerActionUsd) {
        return {
            allowed: false,
            tier,
            requiresApproval: true,
            maxPerActionUsd: policy.maxPerActionUsd,
            maxPerSessionUsd: policy.maxPerSessionUsd,
            reason: `Amount $${amountUsd} exceeds per-action limit of $${policy.maxPerActionUsd}`
        };
    }

    if (tier === "spend_with_approval") {
        return {
            allowed: false,
            tier,
            requiresApproval: true,
            maxPerActionUsd: policy.maxPerActionUsd,
            maxPerSessionUsd: policy.maxPerSessionUsd,
            reason: "Agent requires approval for financial actions"
        };
    }

    // spend_autonomous
    return {
        allowed: true,
        tier,
        requiresApproval: false,
        maxPerActionUsd: policy.maxPerActionUsd,
        maxPerSessionUsd: policy.maxPerSessionUsd
    };
}
