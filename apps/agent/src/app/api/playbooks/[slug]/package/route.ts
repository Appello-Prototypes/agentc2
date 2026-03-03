import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@repo/database";
import { repackagePlaybook } from "@repo/agentc2";

type Params = { params: Promise<{ slug: string }> };

/**
 * POST /api/playbooks/[slug]/package
 * Snapshot agent system into a new playbook version
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

        const result = await repackagePlaybook({
            playbookId: playbook.id,
            entryAgentId: body.entryAgentId,
            entryNetworkId: body.entryNetworkId,
            entryWorkflowId: body.entryWorkflowId,
            includeSkills: body.includeSkills ?? true,
            includeDocuments: body.includeDocuments ?? true,
            includeWorkflows: body.includeWorkflows,
            includeNetworks: body.includeNetworks,
            organizationId: authResult.context.organizationId,
            userId: authResult.context.userId,
            changelog: body.changelog,
            mode: body.mode
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
