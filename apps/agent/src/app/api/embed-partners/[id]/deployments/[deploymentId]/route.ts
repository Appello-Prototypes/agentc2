import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth } from "@/lib/authz/require-auth";
import { requireOrgRole } from "@/lib/authz/require-org-role";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; deploymentId: string }> }
) {
    const authResult = await requireAuth(request);
    if (authResult.response) return authResult.response;
    const { userId, organizationId } = authResult.context;

    const roleResult = await requireOrgRole(userId, organizationId);
    if (roleResult.response) return roleResult.response;

    const { id, deploymentId } = await params;

    try {
        const deployment = await prisma.embedDeployment.findUnique({
            where: { id: deploymentId },
            include: {
                partner: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        organizationId: true
                    }
                },
                agent: {
                    select: { id: true, slug: true, name: true }
                }
            }
        });

        if (
            !deployment ||
            deployment.partnerId !== id ||
            deployment.partner.organizationId !== organizationId
        ) {
            return NextResponse.json(
                { success: false, error: "Deployment not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            deployment: {
                id: deployment.id,
                label: deployment.label,
                mode: deployment.mode,
                deploymentToken: deployment.deploymentToken,
                features: deployment.features,
                branding: deployment.branding,
                embedConfig: deployment.embedConfig,
                allowedDomains: deployment.allowedDomains,
                isActive: deployment.isActive,
                createdAt: deployment.createdAt,
                updatedAt: deployment.updatedAt,
                partner: {
                    id: deployment.partner.id,
                    name: deployment.partner.name,
                    slug: deployment.partner.slug
                },
                agent: deployment.agent
                    ? {
                          id: deployment.agent.id,
                          slug: deployment.agent.slug,
                          name: deployment.agent.name
                      }
                    : null
            }
        });
    } catch (error) {
        console.error("[EmbedDeployments API] Get error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get deployment"
            },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; deploymentId: string }> }
) {
    const authResult = await requireAuth(request);
    if (authResult.response) return authResult.response;
    const { userId, organizationId } = authResult.context;

    const roleResult = await requireOrgRole(userId, organizationId);
    if (roleResult.response) return roleResult.response;

    const { id, deploymentId } = await params;

    try {
        const existing = await prisma.embedDeployment.findUnique({
            where: { id: deploymentId },
            include: {
                partner: { select: { organizationId: true } }
            }
        });

        if (
            !existing ||
            existing.partnerId !== id ||
            existing.partner.organizationId !== organizationId
        ) {
            return NextResponse.json(
                { success: false, error: "Deployment not found" },
                { status: 404 }
            );
        }

        const body = await request.json();
        const { label, mode, agentId, features, branding, embedConfig, allowedDomains, isActive } =
            body as {
                label?: string;
                mode?: string;
                agentId?: string | null;
                features?: string[];
                branding?: Record<string, unknown>;
                embedConfig?: Record<string, unknown>;
                allowedDomains?: string[];
                isActive?: boolean;
            };

        if (mode) {
            const validModes = ["chat-widget", "agent", "workspace"];
            if (!validModes.includes(mode)) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `mode must be one of: ${validModes.join(", ")}`
                    },
                    { status: 400 }
                );
            }
        }

        if (agentId) {
            const agent = await prisma.agent.findUnique({
                where: { id: agentId },
                select: { workspace: { select: { organizationId: true } } }
            });
            if (!agent || agent.workspace?.organizationId !== organizationId) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "Agent not found in this organization"
                    },
                    { status: 404 }
                );
            }
        }

        const updateData: Record<string, unknown> = {};
        if (label !== undefined) updateData.label = label;
        if (mode !== undefined) updateData.mode = mode;
        if (agentId !== undefined) updateData.agentId = agentId;
        if (features !== undefined) updateData.features = features;
        if (branding !== undefined) updateData.branding = branding;
        if (embedConfig !== undefined) updateData.embedConfig = embedConfig;
        if (allowedDomains !== undefined) updateData.allowedDomains = allowedDomains;
        if (isActive !== undefined) updateData.isActive = isActive;

        const deployment = await prisma.embedDeployment.update({
            where: { id: deploymentId },
            data: updateData,
            include: {
                agent: {
                    select: { id: true, slug: true, name: true }
                }
            }
        });

        return NextResponse.json({
            success: true,
            deployment: {
                id: deployment.id,
                label: deployment.label,
                mode: deployment.mode,
                deploymentToken: deployment.deploymentToken,
                features: deployment.features,
                branding: deployment.branding,
                embedConfig: deployment.embedConfig,
                allowedDomains: deployment.allowedDomains,
                isActive: deployment.isActive,
                updatedAt: deployment.updatedAt,
                agent: deployment.agent
                    ? {
                          id: deployment.agent.id,
                          slug: deployment.agent.slug,
                          name: deployment.agent.name
                      }
                    : null
            }
        });
    } catch (error) {
        console.error("[EmbedDeployments API] Update error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to update deployment"
            },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; deploymentId: string }> }
) {
    const authResult = await requireAuth(request);
    if (authResult.response) return authResult.response;
    const { userId, organizationId } = authResult.context;

    const roleResult = await requireOrgRole(userId, organizationId);
    if (roleResult.response) return roleResult.response;

    const { id, deploymentId } = await params;

    try {
        const existing = await prisma.embedDeployment.findUnique({
            where: { id: deploymentId },
            include: {
                partner: { select: { organizationId: true } }
            }
        });

        if (
            !existing ||
            existing.partnerId !== id ||
            existing.partner.organizationId !== organizationId
        ) {
            return NextResponse.json(
                { success: false, error: "Deployment not found" },
                { status: 404 }
            );
        }

        await prisma.embedDeployment.delete({ where: { id: deploymentId } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[EmbedDeployments API] Delete error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to delete deployment"
            },
            { status: 500 }
        );
    }
}
