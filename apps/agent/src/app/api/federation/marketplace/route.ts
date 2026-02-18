import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /api/federation/marketplace
 *
 * Public listing of agents that have active federation exposures.
 * Returns a list of publicly discoverable agents and their orgs.
 */
export async function GET(_request: NextRequest) {
    try {
        const exposures = await prisma.federationExposure.findMany({
            where: { enabled: true },
            select: {
                agent: {
                    select: {
                        id: true,
                        slug: true,
                        name: true,
                        description: true,
                        tools: { select: { toolId: true }, take: 10 },
                        workspace: {
                            select: {
                                organization: {
                                    select: {
                                        name: true,
                                        slug: true,
                                        status: true
                                    }
                                }
                            }
                        }
                    }
                },
                exposedSkills: true
            },
            distinct: ["agentId"]
        });

        const agents = exposures
            .filter((e) => e.agent.workspace?.organization?.status === "active")
            .map((e) => ({
                id: e.agent.id,
                name: e.agent.name,
                slug: e.agent.slug,
                description: e.agent.description,
                orgName: e.agent.workspace?.organization?.name ?? "",
                orgSlug: e.agent.workspace?.organization?.slug ?? "",
                skills:
                    e.exposedSkills.length > 0
                        ? e.exposedSkills
                        : e.agent.tools.map((t) => t.toolId)
            }));

        return NextResponse.json({ success: true, agents });
    } catch (error) {
        console.error("[Federation] Marketplace error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to load marketplace" },
            { status: 500 }
        );
    }
}
