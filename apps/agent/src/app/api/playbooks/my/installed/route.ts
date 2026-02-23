import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@repo/database";

/**
 * GET /api/playbooks/my/installed
 * List my installed playbooks
 */
export async function GET(request: NextRequest) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const installations = await prisma.playbookInstallation.findMany({
            where: {
                targetOrgId: authResult.context.organizationId,
                status: { not: "UNINSTALLED" }
            },
            orderBy: { createdAt: "desc" },
            include: {
                playbook: {
                    select: {
                        slug: true,
                        name: true,
                        tagline: true,
                        category: true,
                        iconUrl: true,
                        publisherOrg: {
                            select: { name: true, slug: true }
                        }
                    }
                }
            }
        });

        return NextResponse.json({ installations });
    } catch (error) {
        console.error("[playbooks] My installed error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}
