import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@repo/database";
import { stripe, isStripeEnabled } from "@/lib/stripe";

/**
 * GET /api/stripe/connect/status
 * Check Connect account status
 */
export async function GET(request: NextRequest) {
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
            return NextResponse.json({
                connected: false,
                status: null,
                accountId: null
            });
        }

        const account = await stripe.accounts.retrieve(org.stripeConnectAccountId);

        const status = account.charges_enabled
            ? "active"
            : account.requirements?.disabled_reason
              ? "restricted"
              : "pending";

        // Update cached status
        if (status !== org.stripeConnectStatus) {
            await prisma.organization.update({
                where: { id: org.id },
                data: { stripeConnectStatus: status }
            });
        }

        return NextResponse.json({
            connected: true,
            status,
            accountId: org.stripeConnectAccountId,
            chargesEnabled: account.charges_enabled,
            payoutsEnabled: account.payouts_enabled,
            detailsSubmitted: account.details_submitted
        });
    } catch (error) {
        console.error("[stripe/connect/status] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}
