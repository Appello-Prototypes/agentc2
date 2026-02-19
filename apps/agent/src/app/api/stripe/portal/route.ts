import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";
import { stripe, isStripeEnabled } from "@/lib/stripe";

/**
 * POST /api/stripe/portal
 *
 * Create a Stripe Customer Portal session for self-service billing management.
 * Allows customers to update payment methods, view invoices, cancel subscriptions.
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

        const org = await prisma.organization.findUnique({
            where: { id: session.organizationId },
            select: { stripeCustomerId: true }
        });

        if (!org?.stripeCustomerId) {
            return NextResponse.json(
                { success: false, error: "No billing account found. Subscribe to a plan first." },
                { status: 400 }
            );
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

        const portalSession = await stripe.billingPortal.sessions.create({
            customer: org.stripeCustomerId,
            return_url: `${appUrl}/settings/billing`
        });

        return NextResponse.json({
            success: true,
            url: portalSession.url
        });
    } catch (error) {
        console.error("[Stripe Portal] Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Failed" },
            { status: 500 }
        );
    }
}
