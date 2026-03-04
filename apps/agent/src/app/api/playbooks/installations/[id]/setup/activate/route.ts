import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@repo/database";
import { mapIntegrations } from "@repo/agentc2";
import type { Prisma } from "@repo/database";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/playbooks/installations/[id]/setup/activate
 *
 * Marks the installation as ACTIVE after verifying all required
 * integrations are connected and all config steps are complete.
 */
export async function POST(request: NextRequest, { params }: Params) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const { id } = await params;
        const { organizationId } = authResult.context;

        const installation = await prisma.playbookInstallation.findFirst({
            where: { id, targetOrgId: organizationId },
            include: {
                playbook: {
                    select: { requiredIntegrations: true }
                }
            }
        });

        if (!installation) {
            return NextResponse.json({ error: "Installation not found" }, { status: 404 });
        }

        if (installation.status !== "CONFIGURING" && installation.status !== "TESTING") {
            return NextResponse.json(
                {
                    error: `Cannot activate installation with status: ${installation.status}`
                },
                { status: 400 }
            );
        }

        const integrationStatus = await mapIntegrations({
            requiredIntegrations: installation.playbook.requiredIntegrations,
            targetOrgId: organizationId,
            targetWorkspaceId: installation.targetWorkspaceId
        });

        const disconnected = integrationStatus.filter((m: { connected: boolean }) => !m.connected);

        if (disconnected.length > 0) {
            return NextResponse.json(
                {
                    error: "Not all integrations are connected",
                    disconnected: disconnected.map((m: { provider: string }) => m.provider)
                },
                { status: 400 }
            );
        }

        const customizations = (installation.customizations as Record<string, unknown>) ?? {};
        const setupConfig =
            (customizations.setupConfig as {
                steps?: { id: string }[];
            }) ?? null;
        const stepData = (customizations.stepData as Record<string, unknown>) ?? {};

        const incompleteSteps = (setupConfig?.steps ?? []).filter((step) => !stepData[step.id]);

        if (incompleteSteps.length > 0) {
            return NextResponse.json(
                {
                    error: "Not all configuration steps are complete",
                    incompleteSteps: incompleteSteps.map((s) => s.id)
                },
                { status: 400 }
            );
        }

        const updatedCustomizations = {
            ...customizations,
            setupCompletedAt: new Date().toISOString()
        };

        await prisma.playbookInstallation.update({
            where: { id },
            data: {
                status: "ACTIVE",
                integrationStatus: integrationStatus as unknown as Prisma.InputJsonValue,
                customizations: updatedCustomizations as Prisma.InputJsonValue
            }
        });

        return NextResponse.json({ success: true, status: "ACTIVE" });
    } catch (error) {
        console.error("[setup/activate]", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Internal server error"
            },
            { status: 500 }
        );
    }
}
