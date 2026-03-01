import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdmin, AdminAuthError } from "@repo/admin-auth";

type Params = { params: Promise<{ orgId: string }> };

/**
 * GET /admin/api/tenants/:orgId/workflows
 * List workflows belonging to an organization's workspaces.
 */
export async function GET(request: NextRequest, { params }: Params) {
    try {
        await requireAdmin(request, "platform_admin");
        const { orgId } = await params;

        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { id: true, name: true }
        });
        if (!org) {
            return NextResponse.json({ error: "Organization not found" }, { status: 404 });
        }

        const workflows = await prisma.workflow.findMany({
            where: {
                workspace: { organizationId: orgId }
            },
            select: {
                id: true,
                slug: true,
                name: true,
                description: true,
                isActive: true,
                version: true,
                workspaceId: true,
                workspace: { select: { name: true } },
                createdAt: true
            },
            orderBy: { name: "asc" }
        });

        const installations = await prisma.playbookInstallation.findMany({
            where: { targetOrgId: orgId, status: "ACTIVE" },
            select: {
                createdWorkflowIds: true,
                playbook: { select: { name: true, slug: true } }
            }
        });

        const workflowPlaybookMap = new Map<string, { name: string; slug: string }>();
        for (const inst of installations) {
            for (const wfId of inst.createdWorkflowIds) {
                workflowPlaybookMap.set(wfId, inst.playbook);
            }
        }

        const enriched = workflows.map((wf) => ({
            id: wf.id,
            slug: wf.slug,
            name: wf.name,
            description: wf.description,
            isActive: wf.isActive,
            version: wf.version,
            workspaceName: wf.workspace?.name ?? null,
            playbookSource: workflowPlaybookMap.get(wf.id) ?? null,
            createdAt: wf.createdAt
        }));

        return NextResponse.json({ workflows: enriched, organization: org });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[Admin Tenants] Workflows error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
