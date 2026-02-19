import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";
import { stripe, isStripeEnabled } from "@/lib/stripe";

/**
 * POST /api/stripe/checkout
 *
 * Create a Stripe Checkout session for plan subscription.
 * Body: { planSlug, billingCycle?: "monthly" | "annual" }
 *
 * Returns the Checkout session URL to redirect the user to.
 */
export async function POST(request: NextRequest) {
    try {
        if (!isStripeEnabled()) {
            return NextResponse.json(
                { success: false, error: "Stripe is not configured" },
                { status: 503 }
            );
        }

        const session = await authenticateRequest(request);
        if (!session) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { planSlug, billingCycle = "monthly" } = body;

        if (!planSlug) {
            return NextResponse.json(
                { success: false, error: "planSlug is required" },
                { status: 400 }
            );
        }

        const plan = await prisma.pricingPlan.findUnique({
            where: { slug: planSlug }
        });
        if (!plan || !plan.isActive) {
            return NextResponse.json(
                { success: false, error: "Plan not found or inactive" },
                { status: 404 }
            );
        }

        if (plan.monthlyPriceUsd === 0) {
            return NextResponse.json(
                { success: false, error: "Free plans do not require checkout" },
                { status: 400 }
            );
        }

        const org = await prisma.organization.findUnique({
            where: { id: session.organizationId },
            include: { subscription: true }
        });
        if (!org) {
            return NextResponse.json(
                { success: false, error: "Organization not found" },
                { status: 404 }
            );
        }

        const membership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.userId,
                    organizationId: org.id
                }
            }
        });
        if (!membership || !["owner", "admin"].includes(membership.role)) {
            return NextResponse.json(
                { success: false, error: "Only owners and admins can manage billing" },
                { status: 403 }
            );
        }

        let stripeCustomerId = org.stripeCustomerId;

        if (!stripeCustomerId) {
            const user = await prisma.user.findUnique({
                where: { id: session.userId },
                select: { email: true, name: true }
            });

            const customer = await stripe.customers.create({
                email: user?.email ?? undefined,
                name: org.name,
                metadata: {
                    organizationId: org.id,
                    organizationSlug: org.slug
                }
            });

            stripeCustomerId = customer.id;

            await prisma.organization.update({
                where: { id: org.id },
                data: { stripeCustomerId: customer.id }
            });
        }

        const priceUsd =
            billingCycle === "annual" && plan.annualPriceUsd
                ? plan.annualPriceUsd
                : plan.monthlyPriceUsd;

        const interval = billingCycle === "annual" ? "year" : "month";

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
        const successUrl = `${appUrl}/settings/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${appUrl}/settings/billing?checkout=canceled`;

        const checkoutSession = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            mode: "subscription",
            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: `AgentC2 ${plan.name}`,
                            description: plan.description ?? undefined
                        },
                        unit_amount: Math.round(priceUsd * 100),
                        recurring: { interval }
                    },
                    quantity: 1
                }
            ],
            metadata: {
                organizationId: org.id,
                planId: plan.id,
                planSlug: plan.slug,
                billingCycle
            },
            subscription_data: {
                metadata: {
                    organizationId: org.id,
                    planId: plan.id,
                    planSlug: plan.slug,
                    billingCycle
                }
            },
            success_url: successUrl,
            cancel_url: cancelUrl,
            allow_promotion_codes: true
        });

        return NextResponse.json({
            success: true,
            url: checkoutSession.url,
            sessionId: checkoutSession.id
        });
    } catch (error) {
        console.error("[Stripe Checkout] Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Failed" },
            { status: 500 }
        );
    }
}
