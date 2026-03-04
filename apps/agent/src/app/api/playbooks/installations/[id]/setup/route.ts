import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@repo/database";
import { mapIntegrations } from "@repo/agentc2";
import type { Prisma } from "@repo/database";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/playbooks/installations/[id]/setup
 *
 * Returns the current setup state for an installation, including
 * fresh integration connection status and custom config step progress.
 */
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const { id } = await params;
        const { organizationId } = authResult.context;

        const installation = await prisma.playbookInstallation.findFirst({
            where: { id, targetOrgId: organizationId },
            include: {
                playbook: {
                    select: {
                        slug: true,
                        name: true,
                        requiredIntegrations: true,
                        iconUrl: true
                    }
                }
            }
        });

        if (!installation) {
            return NextResponse.json({ error: "Installation not found" }, { status: 404 });
        }

        const integrationStatus = await mapIntegrations({
            requiredIntegrations: installation.playbook.requiredIntegrations,
            targetOrgId: organizationId,
            targetWorkspaceId: installation.targetWorkspaceId
        });

        await prisma.playbookInstallation.update({
            where: { id },
            data: {
                integrationStatus: integrationStatus as unknown as Prisma.InputJsonValue
            }
        });

        const providers = await prisma.integrationProvider.findMany({
            where: {
                key: {
                    in: installation.playbook.requiredIntegrations
                }
            },
            select: {
                key: true,
                name: true,
                authType: true,
                category: true
            }
        });
        const providerMap = new Map(providers.map((p) => [p.key, p]));

        const integrations = integrationStatus.map(
            (m: { provider: string; connected: boolean; connectionId?: string }) => {
                const provider = providerMap.get(m.provider);
                return {
                    provider: m.provider,
                    name: provider?.name ?? m.provider,
                    authType: provider?.authType ?? "unknown",
                    category: provider?.category ?? "unknown",
                    connected: m.connected,
                    connectionId: m.connectionId ?? null
                };
            }
        );

        const customizations = (installation.customizations as Record<string, unknown>) ?? {};
        const setupConfig =
            (customizations.setupConfig as {
                headline?: string;
                description?: string;
                steps?: {
                    id: string;
                    type: string;
                    label: string;
                    description: string;
                    provider?: string;
                }[];
            }) ?? null;

        const stepData = (customizations.stepData as Record<string, unknown>) ?? {};

        const configSteps = (setupConfig?.steps ?? []).map((step) => ({
            ...step,
            completed: !!stepData[step.id],
            data: stepData[step.id] ?? null
        }));

        const allIntegrationsConnected = integrations.every(
            (i: { connected: boolean }) => i.connected
        );
        const allConfigStepsComplete = configSteps.every(
            (s: { completed: boolean }) => s.completed
        );
        const readyToActivate = allIntegrationsConnected && allConfigStepsComplete;

        return NextResponse.json({
            installation: {
                id: installation.id,
                status: installation.status,
                playbookSlug: installation.playbook.slug
            },
            playbook: {
                slug: installation.playbook.slug,
                name: installation.playbook.name,
                iconUrl: installation.playbook.iconUrl,
                requiredIntegrations: installation.playbook.requiredIntegrations
            },
            setupConfig,
            integrations,
            configSteps,
            readyToActivate
        });
    } catch (error) {
        console.error("[setup/GET]", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Internal server error"
            },
            { status: 500 }
        );
    }
}
