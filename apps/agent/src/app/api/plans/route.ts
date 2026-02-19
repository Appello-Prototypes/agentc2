import { NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /api/plans
 *
 * Public endpoint returning all active pricing plans.
 */
export async function GET() {
    try {
        const plans = await prisma.pricingPlan.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            select: {
                id: true,
                slug: true,
                name: true,
                description: true,
                monthlyPriceUsd: true,
                annualPriceUsd: true,
                perSeatPricing: true,
                includedCreditsUsd: true,
                markupMultiplier: true,
                overageEnabled: true,
                maxAgents: true,
                maxSeats: true,
                maxRunsPerMonth: true,
                maxWorkspaces: true,
                maxIntegrations: true,
                features: true
            }
        });

        return NextResponse.json({ success: true, plans });
    } catch (error) {
        console.error("[Plans GET] Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Failed" },
            { status: 500 }
        );
    }
}
