import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@repo/database";

/**
 * GET /api/playbooks/my/published
 * List my published playbooks
 */
export async function GET(request: NextRequest) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const playbooks = await prisma.playbook.findMany({
            where: { publisherOrgId: authResult.context.organizationId },
            orderBy: { updatedAt: "desc" },
            select: {
                id: true,
                slug: true,
                name: true,
                tagline: true,
                status: true,
                category: true,
                pricingModel: true,
                priceUsd: true,
                installCount: true,
                averageRating: true,
                reviewCount: true,
                trustScore: true,
                version: true,
                createdAt: true,
                updatedAt: true,
                _count: { select: { components: true, purchases: true } }
            }
        });

        return NextResponse.json({ playbooks });
    } catch (error) {
        console.error("[playbooks] My published error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}
