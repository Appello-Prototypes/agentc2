import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@repo/database";
import { deployPlaybook } from "@repo/agentc2";
import { encryptString } from "@/lib/credential-crypto";

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

        // For paid playbooks, check purchase exists (publishers can skip)
        const isPublisher = playbook.publisherOrgId === organizationId;
        if (playbook.pricingModel !== "FREE" && !isPublisher) {
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

        // Auto-create default webhook trigger for SDLC playbook workflows
        if (playbook.slug === "sdlc-flywheel" && installation.createdWorkflowIds.length > 0) {
            try {
                const sdlcTriage = await prisma.workflow.findFirst({
                    where: {
                        id: { in: installation.createdWorkflowIds },
                        slug: { contains: "sdlc-triage" }
                    },
                    select: { id: true, slug: true }
                });

                if (sdlcTriage) {
                    const webhookPath = `trigger_${randomBytes(16).toString("hex")}`;
                    const webhookSecretPlain = randomBytes(32).toString("hex");
                    const webhookSecret = encryptString(webhookSecretPlain);

                    const sdlcBugfix = await prisma.workflow.findFirst({
                        where: {
                            id: { in: installation.createdWorkflowIds },
                            slug: { contains: "sdlc-bugfix" }
                        },
                        select: { slug: true }
                    });
                    const sdlcFeature = await prisma.workflow.findFirst({
                        where: {
                            id: { in: installation.createdWorkflowIds },
                            slug: { contains: "sdlc-feature" }
                        },
                        select: { slug: true }
                    });

                    await prisma.agentTrigger.create({
                        data: {
                            entityType: "workflow",
                            workflowId: sdlcTriage.id,
                            workspaceId,
                            name: "SDLC GitHub Webhook",
                            description: "Triggers SDLC workflows when a GitHub Issue is labeled.",
                            triggerType: "webhook",
                            webhookPath,
                            webhookSecret,
                            filterJson: {
                                triggerLabel: "agentc2-sdlc",
                                githubEvents: ["issues"],
                                githubActions: ["labeled"]
                            },
                            inputMapping: {
                                config: {
                                    workflowRouting: {
                                        bug: sdlcBugfix?.slug ?? "sdlc-bugfix",
                                        feature: sdlcFeature?.slug ?? "sdlc-feature",
                                        default: sdlcTriage.slug
                                    },
                                    fieldMapping: {
                                        title: "issue.title",
                                        description: "issue.body",
                                        repository: "repository.full_name"
                                    }
                                }
                            },
                            isActive: true
                        }
                    });
                }
            } catch (triggerError) {
                console.warn("[playbooks] Failed to create SDLC webhook trigger:", triggerError);
            }
        }

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
 * GET /api/playbooks/[slug]/deploy
 * Check deployment status — returns all installations for this playbook/org
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

        const installations = await prisma.playbookInstallation.findMany({
            where: {
                playbookId: playbook.id,
                targetOrgId: authResult.context.organizationId,
                status: { not: "UNINSTALLED" }
            },
            orderBy: { createdAt: "desc" }
        });

        if (installations.length === 0) {
            return NextResponse.json({ error: "No installation found" }, { status: 404 });
        }

        return NextResponse.json({
            installations,
            status: installations[0].status,
            testResults: installations[0].testResults,
            integrationStatus: installations[0].integrationStatus,
            createdAt: installations[0].createdAt,
            updatedAt: installations[0].updatedAt
        });
    } catch (error) {
        console.error("[playbooks] Deploy status error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}
