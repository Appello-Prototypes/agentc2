import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@repo/database";
import { stripe, isStripeEnabled } from "@/lib/stripe";

/**
 * POST /api/stripe/connect/onboard
 * Create a Stripe Connect Express account and return the onboarding link
 */
export async function POST(request: NextRequest) {
    try {
        if (!isStripeEnabled()) {
            return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
        }

        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const { organizationId } = authResult.context;

        const org = await prisma.organization.findUniqueOrThrow({
            where: { id: organizationId }
        });

        // If already has a Connect account, return existing onboarding link
        if (org.stripeConnectAccountId) {
            const accountLink = await stripe.accountLinks.create({
                account: org.stripeConnectAccountId,
                refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/playbooks?connect=refresh`,
                return_url: `${process.env.NEXT_PUBLIC_APP_URL}/playbooks?connect=complete`,
                type: "account_onboarding"
            });

            return NextResponse.json({
                accountId: org.stripeConnectAccountId,
                onboardingUrl: accountLink.url,
                status: org.stripeConnectStatus
            });
        }

        // Create new Express account
        const account = await stripe.accounts.create({
            type: "express",
            metadata: {
                organizationId,
                organizationName: org.name
            }
        });

        // Save account ID to org
        await prisma.organization.update({
            where: { id: organizationId },
            data: {
                stripeConnectAccountId: account.id,
                stripeConnectStatus: "pending"
            }
        });

        // Generate onboarding link
        const accountLink = await stripe.accountLinks.create({
            account: account.id,
            refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/playbooks?connect=refresh`,
            return_url: `${process.env.NEXT_PUBLIC_APP_URL}/playbooks?connect=complete`,
            type: "account_onboarding"
        });

        return NextResponse.json(
            {
                accountId: account.id,
                onboardingUrl: accountLink.url,
                status: "pending"
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("[stripe/connect/onboard] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}
