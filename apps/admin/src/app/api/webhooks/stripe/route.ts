import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { stripe, STRIPE_WEBHOOK_SECRET, isStripeEnabled } from "@/lib/stripe";
import type Stripe from "stripe";

/**
 * Compute subscription period start/end from billing_cycle_anchor and start_date.
 * In Stripe API 2026-01-28.clover, current_period_start/end were removed.
 */
function computePeriodDates(sub: Stripe.Subscription): {
    periodStart: Date;
    periodEnd: Date;
} {
    const anchor = sub.billing_cycle_anchor;
    const startDate = sub.start_date;
    const now = Math.floor(Date.now() / 1000);

    const baseTs = anchor || startDate;
    const periodStart = new Date(baseTs * 1000);

    const end = new Date(periodStart);
    while (end.getTime() / 1000 <= now) {
        end.setMonth(end.getMonth() + 1);
    }
    const periodEnd = end;

    return { periodStart: new Date(Math.max(startDate, baseTs) * 1000), periodEnd };
}

/**
 * POST /api/webhooks/stripe
 *
 * Platform-level Stripe webhook handler. Processes subscription lifecycle events
 * to keep OrgSubscription records in sync with Stripe.
 *
 * Lives in the admin app because webhook secrets are a platform concern,
 * not something individual tenants should configure.
 *
 * Events handled:
 * - checkout.session.completed  → Create OrgSubscription
 * - customer.subscription.created → Sync subscription details
 * - customer.subscription.updated → Sync status, plan changes, period updates
 * - customer.subscription.deleted → Mark subscription as canceled
 * - invoice.payment_succeeded    → Reset credits on new period, confirm active
 * - invoice.payment_failed       → Mark subscription as past_due
 */
export async function POST(request: NextRequest) {
    if (!isStripeEnabled()) {
        return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
    }

    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
        return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
    }

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error("[Stripe Webhook] Signature verification failed:", err);
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    console.log(`[Stripe Webhook] Received: ${event.type} (${event.id})`);

    try {
        switch (event.type) {
            case "checkout.session.completed":
                await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
                break;

            case "customer.subscription.created":
            case "customer.subscription.updated":
                await handleSubscriptionUpsert(event.data.object as Stripe.Subscription);
                break;

            case "customer.subscription.deleted":
                await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
                break;

            case "invoice.payment_succeeded":
                await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
                break;

            case "invoice.payment_failed":
                await handlePaymentFailed(event.data.object as Stripe.Invoice);
                break;

            default:
                console.log(`[Stripe Webhook] Unhandled event: ${event.type}`);
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error(`[Stripe Webhook] Error handling ${event.type}:`, error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Handler failed" },
            { status: 500 }
        );
    }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const orgId = session.metadata?.organizationId;
    const planId = session.metadata?.planId;
    const billingCycle = session.metadata?.billingCycle || "monthly";

    if (!orgId || !planId) {
        console.error("[Stripe Webhook] Checkout missing metadata:", session.metadata);
        return;
    }

    const plan = await prisma.pricingPlan.findUnique({ where: { id: planId } });
    if (!plan) {
        console.error(`[Stripe Webhook] Plan not found: ${planId}`);
        return;
    }

    const stripeSubId =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

    if (!stripeSubId) {
        console.error("[Stripe Webhook] No subscription ID in checkout session");
        return;
    }

    const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
    const { periodStart, periodEnd } = computePeriodDates(stripeSub);

    await prisma.orgSubscription.upsert({
        where: { organizationId: orgId },
        update: {
            planId: plan.id,
            status: "active",
            billingCycle,
            stripeSubscriptionId: stripeSubId,
            stripeCustomerId:
                typeof session.customer === "string"
                    ? session.customer
                    : (session.customer?.id ?? null),
            includedCreditsUsd: plan.includedCreditsUsd,
            usedCreditsUsd: 0,
            overageAccruedUsd: 0,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd
        },
        create: {
            organizationId: orgId,
            planId: plan.id,
            status: "active",
            billingCycle,
            stripeSubscriptionId: stripeSubId,
            stripeCustomerId:
                typeof session.customer === "string"
                    ? session.customer
                    : (session.customer?.id ?? null),
            includedCreditsUsd: plan.includedCreditsUsd,
            usedCreditsUsd: 0,
            overageAccruedUsd: 0,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd
        }
    });

    await prisma.organization.update({
        where: { id: orgId },
        data: {
            status: "active",
            maxAgents: plan.maxAgents,
            maxWorkspaces: plan.maxWorkspaces,
            maxRunsPerMonth: plan.maxRunsPerMonth,
            maxSeats: plan.maxSeats,
            maxStorageBytes: plan.maxStorageBytes
        }
    });

    console.log(
        `[Stripe Webhook] Subscription created for org ${orgId}: ${plan.name} (${billingCycle})`
    );
}

async function handleSubscriptionUpsert(sub: Stripe.Subscription) {
    const orgId = sub.metadata?.organizationId;
    if (!orgId) {
        console.warn("[Stripe Webhook] Subscription missing organizationId metadata");
        return;
    }

    const planId = sub.metadata?.planId;
    const plan = planId ? await prisma.pricingPlan.findUnique({ where: { id: planId } }) : null;

    const statusMap: Record<string, string> = {
        active: "active",
        trialing: "trialing",
        past_due: "past_due",
        canceled: "canceled",
        unpaid: "past_due",
        incomplete: "trialing",
        incomplete_expired: "canceled",
        paused: "paused"
    };

    const mappedStatus = statusMap[sub.status] ?? sub.status;
    const { periodStart, periodEnd } = computePeriodDates(sub);

    const updateData: Record<string, unknown> = {
        status: mappedStatus,
        stripeSubscriptionId: sub.id,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
        trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null
    };

    if (plan) {
        updateData.planId = plan.id;
        updateData.includedCreditsUsd = plan.includedCreditsUsd;
    }

    const existing = await prisma.orgSubscription.findUnique({
        where: { organizationId: orgId }
    });

    if (existing) {
        await prisma.orgSubscription.update({
            where: { organizationId: orgId },
            data: updateData
        });
    } else if (plan) {
        await prisma.orgSubscription.create({
            data: {
                organizationId: orgId,
                planId: plan.id,
                status: mappedStatus,
                billingCycle: sub.metadata?.billingCycle ?? "monthly",
                stripeSubscriptionId: sub.id,
                stripeCustomerId:
                    typeof sub.customer === "string" ? sub.customer : (sub.customer?.id ?? null),
                includedCreditsUsd: plan.includedCreditsUsd,
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd
            }
        });
    }

    if (plan) {
        await prisma.organization.update({
            where: { id: orgId },
            data: {
                status:
                    mappedStatus === "active" || mappedStatus === "trialing"
                        ? "active"
                        : "past_due",
                maxAgents: plan.maxAgents,
                maxWorkspaces: plan.maxWorkspaces,
                maxRunsPerMonth: plan.maxRunsPerMonth,
                maxSeats: plan.maxSeats,
                maxStorageBytes: plan.maxStorageBytes
            }
        });
    }

    console.log(`[Stripe Webhook] Subscription ${sub.id} synced for org ${orgId}: ${mappedStatus}`);
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
    const orgId = sub.metadata?.organizationId;
    if (!orgId) return;

    await prisma.orgSubscription.updateMany({
        where: { organizationId: orgId, stripeSubscriptionId: sub.id },
        data: {
            status: "canceled",
            canceledAt: new Date()
        }
    });

    await prisma.organization.update({
        where: { id: orgId },
        data: { status: "deactivated" }
    });

    console.log(`[Stripe Webhook] Subscription canceled for org ${orgId}`);
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
    if (invoice.billing_reason !== "subscription_cycle") return;

    const customerId =
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;

    if (!customerId) return;

    const org = await prisma.organization.findFirst({
        where: { stripeCustomerId: customerId }
    });
    if (!org) return;

    const sub = await prisma.orgSubscription.findUnique({
        where: { organizationId: org.id },
        include: { plan: true }
    });
    if (!sub) return;

    const now = new Date();
    const nextPeriodEnd = new Date(now);
    if (sub.billingCycle === "annual") {
        nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1);
    } else {
        nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
    }

    await prisma.orgSubscription.update({
        where: { id: sub.id },
        data: {
            status: "active",
            usedCreditsUsd: 0,
            overageAccruedUsd: 0,
            includedCreditsUsd: sub.plan.includedCreditsUsd,
            currentPeriodStart: now,
            currentPeriodEnd: nextPeriodEnd
        }
    });

    await prisma.organization.update({
        where: { id: org.id },
        data: { status: "active" }
    });

    console.log(`[Stripe Webhook] Credits reset for org ${org.id} — new billing period`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
    const customerId =
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;

    if (!customerId) return;

    const org = await prisma.organization.findFirst({
        where: { stripeCustomerId: customerId }
    });
    if (!org) return;

    await prisma.orgSubscription.updateMany({
        where: { organizationId: org.id },
        data: { status: "past_due" }
    });

    await prisma.organization.update({
        where: { id: org.id },
        data: { status: "past_due" }
    });

    console.log(`[Stripe Webhook] Payment failed for org ${org.id} — marked past_due`);
}
