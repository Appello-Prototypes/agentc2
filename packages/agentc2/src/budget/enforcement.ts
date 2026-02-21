import { prisma } from "@repo/database";

export interface BudgetCheckContext {
    agentId: string;
    userId?: string | null;
    organizationId?: string | null;
}

export interface BudgetViolation {
    level: "subscription" | "org" | "user" | "agent";
    currentSpendUsd: number;
    limitUsd: number;
    percentUsed: number;
    message: string;
}

export interface BudgetCheckResult {
    allowed: boolean;
    violations: BudgetViolation[];
    warnings: BudgetViolation[];
    reservationId?: string;
}

function startOfMonth(): Date {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
}

async function sumCostEventsSince(filter: Record<string, unknown>, since: Date): Promise<number> {
    const events = await prisma.costEvent.findMany({
        where: {
            ...filter,
            createdAt: { gte: since },
            status: { not: "CANCELLED" }
        },
        select: { billedCostUsd: true, costUsd: true }
    });
    return events.reduce((s, e) => s + (e.billedCostUsd ?? e.costUsd ?? 0), 0);
}

/**
 * Create a budget reservation before agent execution to prevent race conditions.
 * The reservation holds an estimated maximum cost until finalized or cancelled.
 */
export async function createBudgetReservation(
    runId: string,
    agentId: string,
    estimatedCostUsd: number,
    options?: { tenantId?: string | null; userId?: string | null }
): Promise<string> {
    const reservation = await prisma.costEvent.create({
        data: {
            runId,
            agentId,
            tenantId: options?.tenantId,
            userId: options?.userId,
            provider: "reservation",
            modelName: "estimated",
            costUsd: estimatedCostUsd,
            billedCostUsd: estimatedCostUsd,
            status: "RESERVED"
        }
    });
    return reservation.id;
}

/**
 * Finalize a budget reservation with actual cost. Replaces estimated cost with real values.
 */
export async function finalizeBudgetReservation(
    reservationId: string,
    actualCostUsd: number
): Promise<void> {
    await prisma.costEvent.update({
        where: { id: reservationId },
        data: {
            status: "FINALIZED",
            costUsd: actualCostUsd,
            billedCostUsd: actualCostUsd,
            modelName: "actual"
        }
    });
}

/**
 * Cancel a budget reservation (agent execution failed or was aborted).
 */
export async function cancelBudgetReservation(reservationId: string): Promise<void> {
    await prisma.costEvent.update({
        where: { id: reservationId },
        data: {
            status: "CANCELLED",
            costUsd: 0,
            billedCostUsd: 0
        }
    });
}

/**
 * Clean up stale reservations older than the given age (default 30 minutes).
 * Should be called periodically (e.g., via Inngest cron).
 */
export async function cleanupStaleReservations(maxAgeMs: number = 30 * 60 * 1000): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeMs);
    const result = await prisma.costEvent.updateMany({
        where: {
            status: "RESERVED",
            createdAt: { lt: cutoff }
        },
        data: { status: "CANCELLED", costUsd: 0, billedCostUsd: 0 }
    });
    return result.count;
}

export class BudgetEnforcementService {
    /**
     * Run the full budget hierarchy check before allowing an agent run.
     * Returns whether the run is allowed and any violations/warnings encountered.
     */
    async check(ctx: BudgetCheckContext): Promise<BudgetCheckResult> {
        const violations: BudgetViolation[] = [];
        const warnings: BudgetViolation[] = [];
        const monthStart = startOfMonth();

        // 1. Subscription credit check
        if (ctx.organizationId) {
            const sub = await prisma.orgSubscription.findUnique({
                where: { organizationId: ctx.organizationId },
                include: { plan: true }
            });

            if (sub && sub.status === "active") {
                const totalCredits = sub.includedCreditsUsd;
                const used = sub.usedCreditsUsd;
                const pct = totalCredits > 0 ? (used / totalCredits) * 100 : 0;

                if (totalCredits > 0 && used >= totalCredits) {
                    if (!sub.plan.overageEnabled) {
                        violations.push({
                            level: "subscription",
                            currentSpendUsd: used,
                            limitUsd: totalCredits,
                            percentUsed: pct,
                            message: `Included credits exhausted ($${used.toFixed(2)} / $${totalCredits.toFixed(2)}). Overage is not enabled on the ${sub.plan.name} plan.`
                        });
                    } else if (
                        sub.overageSpendLimitUsd != null &&
                        sub.overageAccruedUsd >= sub.overageSpendLimitUsd
                    ) {
                        violations.push({
                            level: "subscription",
                            currentSpendUsd: sub.overageAccruedUsd,
                            limitUsd: sub.overageSpendLimitUsd,
                            percentUsed: 100,
                            message: `Overage spend limit reached ($${sub.overageAccruedUsd.toFixed(2)} / $${sub.overageSpendLimitUsd.toFixed(2)}).`
                        });
                    }
                } else if (pct >= 80 && totalCredits > 0) {
                    warnings.push({
                        level: "subscription",
                        currentSpendUsd: used,
                        limitUsd: totalCredits,
                        percentUsed: pct,
                        message: `${Math.round(pct)}% of included credits used ($${used.toFixed(2)} / $${totalCredits.toFixed(2)}).`
                    });
                }
            }
        }

        // 2. Org budget check
        if (ctx.organizationId) {
            const policy = await prisma.orgBudgetPolicy.findUnique({
                where: { organizationId: ctx.organizationId }
            });

            if (policy?.enabled && policy.monthlyLimitUsd != null) {
                const orgSpend = await sumCostEventsSince(
                    { tenantId: ctx.organizationId },
                    monthStart
                );
                const pct = (orgSpend / policy.monthlyLimitUsd) * 100;

                if (orgSpend >= policy.monthlyLimitUsd && policy.hardLimit) {
                    violations.push({
                        level: "org",
                        currentSpendUsd: orgSpend,
                        limitUsd: policy.monthlyLimitUsd,
                        percentUsed: pct,
                        message: `Organization monthly budget exceeded ($${orgSpend.toFixed(2)} / $${policy.monthlyLimitUsd.toFixed(2)}).`
                    });
                } else if (policy.alertAtPct && pct >= policy.alertAtPct) {
                    warnings.push({
                        level: "org",
                        currentSpendUsd: orgSpend,
                        limitUsd: policy.monthlyLimitUsd,
                        percentUsed: pct,
                        message: `Organization budget at ${Math.round(pct)}% ($${orgSpend.toFixed(2)} / $${policy.monthlyLimitUsd.toFixed(2)}).`
                    });
                }
            }
        }

        // 3. User budget check
        if (ctx.userId && ctx.organizationId) {
            const userPolicy = await prisma.userBudgetPolicy.findUnique({
                where: {
                    userId_organizationId: {
                        userId: ctx.userId,
                        organizationId: ctx.organizationId
                    }
                }
            });

            if (userPolicy?.enabled && userPolicy.monthlyLimitUsd != null) {
                const userSpend = await sumCostEventsSince(
                    { userId: ctx.userId, tenantId: ctx.organizationId },
                    monthStart
                );
                const pct = (userSpend / userPolicy.monthlyLimitUsd) * 100;

                if (userSpend >= userPolicy.monthlyLimitUsd && userPolicy.hardLimit) {
                    violations.push({
                        level: "user",
                        currentSpendUsd: userSpend,
                        limitUsd: userPolicy.monthlyLimitUsd,
                        percentUsed: pct,
                        message: `User monthly budget exceeded ($${userSpend.toFixed(2)} / $${userPolicy.monthlyLimitUsd.toFixed(2)}).`
                    });
                } else if (userPolicy.alertAtPct && pct >= userPolicy.alertAtPct) {
                    warnings.push({
                        level: "user",
                        currentSpendUsd: userSpend,
                        limitUsd: userPolicy.monthlyLimitUsd,
                        percentUsed: pct,
                        message: `User budget at ${Math.round(pct)}% ($${userSpend.toFixed(2)} / $${userPolicy.monthlyLimitUsd.toFixed(2)}).`
                    });
                }
            }
        }

        // 4. Agent budget check
        const agentPolicy = await prisma.budgetPolicy.findUnique({
            where: { agentId: ctx.agentId }
        });

        if (agentPolicy?.enabled && agentPolicy.monthlyLimitUsd != null) {
            const agentSpend = await sumCostEventsSince({ agentId: ctx.agentId }, monthStart);
            const pct = (agentSpend / agentPolicy.monthlyLimitUsd) * 100;

            if (agentSpend >= agentPolicy.monthlyLimitUsd && agentPolicy.hardLimit) {
                violations.push({
                    level: "agent",
                    currentSpendUsd: agentSpend,
                    limitUsd: agentPolicy.monthlyLimitUsd,
                    percentUsed: pct,
                    message: `Agent monthly budget exceeded ($${agentSpend.toFixed(2)} / $${agentPolicy.monthlyLimitUsd.toFixed(2)}).`
                });
            } else if (agentPolicy.alertAtPct && pct >= agentPolicy.alertAtPct) {
                warnings.push({
                    level: "agent",
                    currentSpendUsd: agentSpend,
                    limitUsd: agentPolicy.monthlyLimitUsd,
                    percentUsed: pct,
                    message: `Agent budget at ${Math.round(pct)}% ($${agentSpend.toFixed(2)} / $${agentPolicy.monthlyLimitUsd.toFixed(2)}).`
                });
            }
        }

        // Persist alerts for any warnings that cross thresholds
        for (const w of warnings) {
            await this.maybeCreateAlert(ctx, w, "threshold_warning");
        }
        for (const v of violations) {
            await this.maybeCreateAlert(ctx, v, "limit_reached");
        }

        return {
            allowed: violations.length === 0,
            violations,
            warnings
        };
    }

    private async maybeCreateAlert(
        ctx: BudgetCheckContext,
        violation: BudgetViolation,
        type: string
    ): Promise<void> {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const existing = await prisma.budgetAlert.findFirst({
            where: {
                organizationId: ctx.organizationId ?? undefined,
                userId: violation.level === "user" ? ctx.userId : undefined,
                agentId: violation.level === "agent" ? ctx.agentId : undefined,
                level: violation.level,
                type,
                createdAt: { gte: oneHourAgo }
            }
        });

        if (existing) return;

        await prisma.budgetAlert.create({
            data: {
                organizationId: ctx.organizationId,
                userId: violation.level === "user" ? ctx.userId : undefined,
                agentId: violation.level === "agent" ? ctx.agentId : undefined,
                level: violation.level,
                type,
                percentUsed: violation.percentUsed,
                currentSpendUsd: violation.currentSpendUsd,
                limitUsd: violation.limitUsd,
                message: violation.message
            }
        });
    }
}

export const budgetEnforcement = new BudgetEnforcementService();
