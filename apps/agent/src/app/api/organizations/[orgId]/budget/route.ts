import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

async function checkOrgAccess(
    userId: string,
    orgId: string,
    requiredRoles: string[] = ["owner", "admin"]
) {
    const organization = await prisma.organization.findFirst({
        where: { OR: [{ id: orgId }, { slug: orgId }] }
    });
    if (!organization) return null;

    const membership = await prisma.membership.findUnique({
        where: {
            userId_organizationId: {
                userId,
                organizationId: organization.id
            }
        }
    });
    if (!membership || !requiredRoles.includes(membership.role)) return null;

    return organization;
}

/**
 * GET /api/organizations/[orgId]/budget
 *
 * Returns the full budget state for an organization:
 * - Subscription + plan details
 * - Org budget policy
 * - Per-user budget policies
 * - Current month usage summary
 * - Recent budget alerts
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const session = await authenticateRequest(request);
        if (!session) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { orgId } = await params;
        const org = await checkOrgAccess(session.userId, orgId, [
            "owner",
            "admin",
            "member",
            "viewer"
        ]);
        if (!org) {
            return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
        }

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const [subscription, orgBudget, userBudgets, alerts, costEvents] = await Promise.all([
            prisma.orgSubscription.findUnique({
                where: { organizationId: org.id },
                include: { plan: true }
            }),
            prisma.orgBudgetPolicy.findUnique({
                where: { organizationId: org.id }
            }),
            prisma.userBudgetPolicy.findMany({
                where: { organizationId: org.id }
            }),
            prisma.budgetAlert.findMany({
                where: { organizationId: org.id },
                orderBy: { createdAt: "desc" },
                take: 20
            }),
            prisma.costEvent.findMany({
                where: {
                    tenantId: org.id,
                    createdAt: { gte: startOfMonth }
                },
                select: {
                    costUsd: true,
                    billedCostUsd: true,
                    platformCostUsd: true,
                    userId: true,
                    agentId: true
                }
            })
        ]);

        const totalCostUsd = costEvents.reduce(
            (s, e) => s + (e.billedCostUsd ?? e.costUsd ?? 0),
            0
        );
        const totalPlatformCostUsd = costEvents.reduce(
            (s, e) => s + (e.platformCostUsd ?? e.costUsd ?? 0),
            0
        );

        const byUser: Record<string, number> = {};
        const byAgent: Record<string, number> = {};
        for (const e of costEvents) {
            if (e.userId) {
                byUser[e.userId] = (byUser[e.userId] ?? 0) + (e.billedCostUsd ?? e.costUsd ?? 0);
            }
            byAgent[e.agentId] = (byAgent[e.agentId] ?? 0) + (e.billedCostUsd ?? e.costUsd ?? 0);
        }

        return NextResponse.json({
            success: true,
            subscription: subscription
                ? {
                      id: subscription.id,
                      planSlug: subscription.plan.slug,
                      planName: subscription.plan.name,
                      status: subscription.status,
                      billingCycle: subscription.billingCycle,
                      monthlyPriceUsd: subscription.plan.monthlyPriceUsd,
                      includedCreditsUsd: subscription.includedCreditsUsd,
                      usedCreditsUsd: subscription.usedCreditsUsd,
                      overageEnabled: subscription.plan.overageEnabled,
                      overageSpendLimitUsd: subscription.overageSpendLimitUsd,
                      overageAccruedUsd: subscription.overageAccruedUsd,
                      currentPeriodStart: subscription.currentPeriodStart,
                      currentPeriodEnd: subscription.currentPeriodEnd,
                      seatCount: subscription.seatCount,
                      features: subscription.plan.features,
                      limits: {
                          maxAgents: subscription.plan.maxAgents,
                          maxSeats: subscription.plan.maxSeats,
                          maxRunsPerMonth: subscription.plan.maxRunsPerMonth,
                          maxWorkspaces: subscription.plan.maxWorkspaces,
                          maxIntegrations: subscription.plan.maxIntegrations
                      }
                  }
                : null,
            orgBudget: orgBudget
                ? {
                      id: orgBudget.id,
                      enabled: orgBudget.enabled,
                      monthlyLimitUsd: orgBudget.monthlyLimitUsd,
                      alertAtPct: orgBudget.alertAtPct,
                      hardLimit: orgBudget.hardLimit,
                      defaultUserBudgetUsd: orgBudget.defaultUserBudgetUsd
                  }
                : null,
            userBudgets: userBudgets.map((ub) => ({
                id: ub.id,
                userId: ub.userId,
                enabled: ub.enabled,
                monthlyLimitUsd: ub.monthlyLimitUsd,
                alertAtPct: ub.alertAtPct,
                hardLimit: ub.hardLimit,
                currentSpendUsd: byUser[ub.userId] ?? 0
            })),
            usage: {
                currentMonthBilledUsd: Math.round(totalCostUsd * 100) / 100,
                byAgent,
                byUser,
                period: {
                    from: startOfMonth.toISOString(),
                    to: new Date().toISOString()
                }
            },
            alerts
        });
    } catch (error) {
        console.error("[Org Budget GET] Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Failed" },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/organizations/[orgId]/budget
 *
 * Update the org-level budget policy.
 * Requires owner or admin role.
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const session = await authenticateRequest(request);
        if (!session) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { orgId } = await params;
        const org = await checkOrgAccess(session.userId, orgId);
        if (!org) {
            return NextResponse.json(
                { success: false, error: "Forbidden or not found" },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { enabled, monthlyLimitUsd, alertAtPct, hardLimit, defaultUserBudgetUsd } = body;

        const policy = await prisma.orgBudgetPolicy.upsert({
            where: { organizationId: org.id },
            update: {
                enabled: enabled ?? undefined,
                monthlyLimitUsd: monthlyLimitUsd ?? undefined,
                alertAtPct: alertAtPct ?? undefined,
                hardLimit: hardLimit ?? undefined,
                defaultUserBudgetUsd: defaultUserBudgetUsd ?? undefined
            },
            create: {
                organizationId: org.id,
                enabled: enabled ?? false,
                monthlyLimitUsd: monthlyLimitUsd ?? null,
                alertAtPct: alertAtPct ?? 80,
                hardLimit: hardLimit ?? true,
                defaultUserBudgetUsd: defaultUserBudgetUsd ?? null
            }
        });

        return NextResponse.json({ success: true, orgBudget: policy });
    } catch (error) {
        console.error("[Org Budget PUT] Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Failed" },
            { status: 500 }
        );
    }
}
