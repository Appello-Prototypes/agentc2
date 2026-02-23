import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@repo/database";
import { deployPlaybook } from "@repo/agentc2";

type Params = { params: Promise<{ slug: string }> };

/**
 * POST /api/playbooks/[slug]/deploy
 * Deploy a purchased (or free) playbook to the buyer's workspace
 */
export async function POST(request: NextRequest, { params }: Params) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const { slug } = await params;
        const { userId, organizationId } = authResult.context;
        const body = await request.json();
        const { workspaceId } = body;

        if (!workspaceId) {
            return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
        }

        const playbook = await prisma.playbook.findUnique({ where: { slug } });
        if (!playbook || playbook.status !== "PUBLISHED") {
            return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
        }

        // Check for existing installation
        const existingInstallation = await prisma.playbookInstallation.findUnique({
            where: {
                playbookId_targetOrgId: {
                    playbookId: playbook.id,
                    targetOrgId: organizationId
                }
            }
        });
        if (existingInstallation && existingInstallation.status !== "UNINSTALLED") {
            return NextResponse.json(
                { error: "Playbook already installed", installationId: existingInstallation.id },
                { status: 409 }
            );
        }

        // For paid playbooks, check purchase exists and is completed
        if (playbook.pricingModel !== "FREE") {
            const purchase = await prisma.playbookPurchase.findFirst({
                where: {
                    playbookId: playbook.id,
                    buyerOrgId: organizationId,
                    status: "COMPLETED"
                }
            });
            if (!purchase) {
                return NextResponse.json(
                    { error: "Purchase required before deployment" },
                    { status: 402 }
                );
            }
        }

        // Verify workspace belongs to org
        const workspace = await prisma.workspace.findFirst({
            where: { id: workspaceId, organizationId }
        });
        if (!workspace) {
            return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
        }

        const purchase = await prisma.playbookPurchase.findFirst({
            where: { playbookId: playbook.id, buyerOrgId: organizationId, status: "COMPLETED" }
        });

        const installation = await deployPlaybook({
            playbookId: playbook.id,
            versionNumber: playbook.version,
            targetOrgId: organizationId,
            targetWorkspaceId: workspaceId,
            userId,
            purchaseId: purchase?.id
        });

        return NextResponse.json({ installation }, { status: 201 });
    } catch (error) {
        console.error("[playbooks] Deploy error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}

/**
 * GET /api/playbooks/[slug]/deploy/status
 * Check deployment status
 */
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const { slug } = await params;

        const playbook = await prisma.playbook.findUnique({ where: { slug } });
        if (!playbook) {
            return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
        }

        const installation = await prisma.playbookInstallation.findUnique({
            where: {
                playbookId_targetOrgId: {
                    playbookId: playbook.id,
                    targetOrgId: authResult.context.organizationId
                }
            }
        });

        if (!installation) {
            return NextResponse.json({ error: "No installation found" }, { status: 404 });
        }

        return NextResponse.json({
            status: installation.status,
            testResults: installation.testResults,
            integrationStatus: installation.integrationStatus,
            createdAt: installation.createdAt,
            updatedAt: installation.updatedAt
        });
    } catch (error) {
        console.error("[playbooks] Deploy status error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}
