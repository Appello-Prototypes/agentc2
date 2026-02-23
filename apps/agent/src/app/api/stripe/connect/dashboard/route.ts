import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@repo/database";
import { stripe, isStripeEnabled } from "@/lib/stripe";

/**
 * POST /api/stripe/connect/dashboard
 * Return Express dashboard link for seller
 */
export async function POST(request: NextRequest) {
    try {
        if (!isStripeEnabled()) {
            return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
        }

        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const org = await prisma.organization.findUniqueOrThrow({
            where: { id: authResult.context.organizationId }
        });

        if (!org.stripeConnectAccountId) {
            return NextResponse.json(
                { error: "No Connect account found. Complete onboarding first." },
                { status: 400 }
            );
        }

        const loginLink = await stripe.accounts.createLoginLink(org.stripeConnectAccountId);

        return NextResponse.json({ url: loginLink.url });
    } catch (error) {
        console.error("[stripe/connect/dashboard] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}
