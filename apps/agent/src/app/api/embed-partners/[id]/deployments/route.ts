import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth } from "@/lib/authz/require-auth";
import { requireOrgRole } from "@/lib/authz/require-org-role";
import { generateDeploymentToken } from "@/lib/embed-deployment";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const authResult = await requireAuth(request);
    if (authResult.response) return authResult.response;
    const { userId, organizationId } = authResult.context;

    const roleResult = await requireOrgRole(userId, organizationId);
    if (roleResult.response) return roleResult.response;

    const { id } = await params;

    try {
        const partner = await prisma.embedPartner.findUnique({
            where: { id },
            select: { organizationId: true }
        });
        if (!partner || partner.organizationId !== organizationId) {
            return NextResponse.json(
                { success: false, error: "Partner not found" },
                { status: 404 }
            );
        }

        const deployments = await prisma.embedDeployment.findMany({
            where: { partnerId: id },
            include: {
                agent: {
                    select: { id: true, slug: true, name: true }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json({
            success: true,
            deployments: deployments.map((d) => ({
                id: d.id,
                label: d.label,
                mode: d.mode,
                deploymentToken: d.deploymentToken,
                features: d.features,
                branding: d.branding,
                embedConfig: d.embedConfig,
                allowedDomains: d.allowedDomains,
                isActive: d.isActive,
                createdAt: d.createdAt,
                updatedAt: d.updatedAt,
                agent: d.agent ? { id: d.agent.id, slug: d.agent.slug, name: d.agent.name } : null
            }))
        });
    } catch (error) {
        console.error("[EmbedDeployments API] List error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list deployments"
            },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const authResult = await requireAuth(request);
    if (authResult.response) return authResult.response;
    const { userId, organizationId } = authResult.context;

    const roleResult = await requireOrgRole(userId, organizationId);
    if (roleResult.response) return roleResult.response;

    const { id } = await params;

    try {
        const partner = await prisma.embedPartner.findUnique({
            where: { id },
            select: { organizationId: true }
        });
        if (!partner || partner.organizationId !== organizationId) {
            return NextResponse.json(
                { success: false, error: "Partner not found" },
                { status: 404 }
            );
        }

        const body = await request.json();
        const { label, mode, agentId, features, branding, embedConfig, allowedDomains } = body as {
            label?: string;
            mode?: string;
            agentId?: string | null;
            features?: string[];
            branding?: Record<string, unknown>;
            embedConfig?: Record<string, unknown>;
            allowedDomains?: string[];
        };

        if (!label) {
            return NextResponse.json(
                { success: false, error: "label is required" },
                { status: 400 }
            );
        }

        const validModes = ["chat-widget", "agent", "workspace"];
        if (mode && !validModes.includes(mode)) {
            return NextResponse.json(
                {
                    success: false,
                    error: `mode must be one of: ${validModes.join(", ")}`
                },
                { status: 400 }
            );
        }

        if (agentId) {
            const agent = await prisma.agent.findUnique({
                where: { id: agentId },
                select: { workspace: { select: { organizationId: true } } }
            });
            if (!agent || agent.workspace?.organizationId !== organizationId) {
                return NextResponse.json(
                    { success: false, error: "Agent not found in this organization" },
                    { status: 404 }
                );
            }
        }

        const deploymentToken = generateDeploymentToken();

        const deployment = await prisma.embedDeployment.create({
            data: {
                partnerId: id,
                label,
                mode: mode || "chat-widget",
                agentId: agentId || null,
                deploymentToken,
                features: features || ["chat"],
                branding: branding || undefined,
                embedConfig: embedConfig || undefined,
                allowedDomains: allowedDomains || []
            }
        });

        let agentInfo: { id: string; slug: string; name: string } | null = null;
        if (deployment.agentId) {
            agentInfo = await prisma.agent.findUnique({
                where: { id: deployment.agentId },
                select: { id: true, slug: true, name: true }
            });
        }

        return NextResponse.json(
            {
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
                    agent: agentInfo
                }
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("[EmbedDeployments API] Create error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to create deployment"
            },
            { status: 500 }
        );
    }
}
