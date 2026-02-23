import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@repo/database";
import { packagePlaybook } from "@repo/agentc2";

type Params = { params: Promise<{ slug: string }> };

/**
 * POST /api/playbooks/[slug]/package
 * Package current agent system into a playbook version
 */
export async function POST(request: NextRequest, { params }: Params) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const { slug } = await params;
        const body = await request.json();

        const playbook = await prisma.playbook.findUnique({ where: { slug } });
        if (!playbook) {
            return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
        }
        if (playbook.publisherOrgId !== authResult.context.organizationId) {
            return NextResponse.json({ error: "Not authorized" }, { status: 403 });
        }

        const result = await packagePlaybook({
            name: playbook.name,
            slug: playbook.slug,
            description: playbook.description,
            category: playbook.category,
            tags: playbook.tags,
            tagline: playbook.tagline ?? undefined,
            coverImageUrl: playbook.coverImageUrl ?? undefined,
            iconUrl: playbook.iconUrl ?? undefined,
            entryAgentId: body.entryAgentId,
            entryNetworkId: body.entryNetworkId,
            entryWorkflowId: body.entryWorkflowId,
            includeSkills: body.includeSkills ?? true,
            includeDocuments: body.includeDocuments ?? true,
            includeWorkflows: body.includeWorkflows,
            includeNetworks: body.includeNetworks,
            organizationId: authResult.context.organizationId,
            userId: authResult.context.userId,
            pricingModel: playbook.pricingModel as "FREE" | "ONE_TIME" | "SUBSCRIPTION" | "PER_USE",
            priceUsd: playbook.priceUsd ?? undefined,
            monthlyPriceUsd: playbook.monthlyPriceUsd ?? undefined,
            perUsePriceUsd: playbook.perUsePriceUsd ?? undefined
        });

        return NextResponse.json(
            {
                playbook: result.playbook,
                manifest: result.manifest,
                warnings: result.warnings
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("[playbooks] Package error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}
