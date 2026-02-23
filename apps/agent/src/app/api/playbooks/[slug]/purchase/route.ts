import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@repo/database";

type Params = { params: Promise<{ slug: string }> };

/**
 * POST /api/playbooks/[slug]/purchase
 * Purchase a playbook
 */
export async function POST(request: NextRequest, { params }: Params) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const { slug } = await params;
        const { userId, organizationId } = authResult.context;

        const playbook = await prisma.playbook.findUnique({ where: { slug } });
        if (!playbook || playbook.status !== "PUBLISHED") {
            return NextResponse.json(
                { error: "Playbook not found or not published" },
                { status: 404 }
            );
        }

        if (playbook.publisherOrgId === organizationId) {
            return NextResponse.json(
                { error: "Cannot purchase your own playbook" },
                { status: 400 }
            );
        }

        // Check for existing purchase
        const existingPurchase = await prisma.playbookPurchase.findFirst({
            where: { playbookId: playbook.id, buyerOrgId: organizationId, status: "COMPLETED" }
        });
        if (existingPurchase) {
            return NextResponse.json(
                { error: "Already purchased", purchaseId: existingPurchase.id },
                { status: 409 }
            );
        }

        if (playbook.pricingModel === "FREE") {
            // Free path — no Stripe interaction
            const purchase = await prisma.playbookPurchase.create({
                data: {
                    playbookId: playbook.id,
                    buyerOrgId: organizationId,
                    buyerUserId: userId,
                    status: "COMPLETED",
                    pricingModel: "FREE",
                    amountUsd: 0,
                    platformFeeUsd: 0,
                    sellerPayoutUsd: 0
                }
            });

            return NextResponse.json({ purchase, deployReady: true }, { status: 201 });
        }

        // Paid path — create Stripe PaymentIntent
        // For now, create a pending purchase. Stripe integration in Phase 7.
        const amount =
            playbook.pricingModel === "ONE_TIME"
                ? (playbook.priceUsd ?? 0)
                : playbook.pricingModel === "SUBSCRIPTION"
                  ? (playbook.monthlyPriceUsd ?? 0)
                  : (playbook.perUsePriceUsd ?? 0);

        const platformFee = amount * 0.15;
        const sellerPayout = amount - platformFee;

        const purchase = await prisma.playbookPurchase.create({
            data: {
                playbookId: playbook.id,
                buyerOrgId: organizationId,
                buyerUserId: userId,
                status: "PENDING",
                pricingModel: playbook.pricingModel,
                amountUsd: amount,
                platformFeeUsd: platformFee,
                sellerPayoutUsd: sellerPayout
            }
        });

        return NextResponse.json({ purchase, deployReady: false }, { status: 201 });
    } catch (error) {
        console.error("[playbooks] Purchase error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}
