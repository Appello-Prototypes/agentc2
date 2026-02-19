import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

async function checkOrgAdmin(userId: string, orgId: string) {
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
    if (!membership || !["owner", "admin"].includes(membership.role)) return null;

    return organization;
}

/**
 * GET /api/organizations/[orgId]/subscription
 *
 * Returns the current subscription, plan details, and available plans.
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
        const org = await checkOrgAdmin(session.userId, orgId);
        if (!org) {
            return NextResponse.json(
                { success: false, error: "Forbidden or not found" },
                { status: 403 }
            );
        }

        const [subscription, plans] = await Promise.all([
            prisma.orgSubscription.findUnique({
                where: { organizationId: org.id },
                include: { plan: true }
            }),
            prisma.pricingPlan.findMany({
                where: { isActive: true },
                orderBy: { sortOrder: "asc" }
            })
        ]);

        return NextResponse.json({
            success: true,
            subscription: subscription
                ? {
                      id: subscription.id,
                      status: subscription.status,
                      billingCycle: subscription.billingCycle,
                      plan: subscription.plan,
                      includedCreditsUsd: subscription.includedCreditsUsd,
                      usedCreditsUsd: subscription.usedCreditsUsd,
                      overageSpendLimitUsd: subscription.overageSpendLimitUsd,
                      overageAccruedUsd: subscription.overageAccruedUsd,
                      seatCount: subscription.seatCount,
                      currentPeriodStart: subscription.currentPeriodStart,
                      currentPeriodEnd: subscription.currentPeriodEnd,
                      stripeSubscriptionId: subscription.stripeSubscriptionId,
                      stripeCustomerId: subscription.stripeCustomerId
                  }
                : null,
            availablePlans: plans
        });
    } catch (error) {
        console.error("[Subscription GET] Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Failed" },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/organizations/[orgId]/subscription
 *
 * Update subscription settings (overage spend limit, seat count).
 * Plan changes would go through Stripe checkout in production.
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
        const org = await checkOrgAdmin(session.userId, orgId);
        if (!org) {
            return NextResponse.json(
                { success: false, error: "Forbidden or not found" },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { overageSpendLimitUsd, seatCount } = body;

        const subscription = await prisma.orgSubscription.findUnique({
            where: { organizationId: org.id }
        });

        if (!subscription) {
            return NextResponse.json(
                { success: false, error: "No active subscription" },
                { status: 400 }
            );
        }

        const updated = await prisma.orgSubscription.update({
            where: { id: subscription.id },
            data: {
                overageSpendLimitUsd:
                    overageSpendLimitUsd !== undefined ? overageSpendLimitUsd : undefined,
                seatCount: seatCount !== undefined ? seatCount : undefined
            },
            include: { plan: true }
        });

        return NextResponse.json({ success: true, subscription: updated });
    } catch (error) {
        console.error("[Subscription PUT] Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Failed" },
            { status: 500 }
        );
    }
}
