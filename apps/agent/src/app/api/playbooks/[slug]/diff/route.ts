import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@repo/database";

type Params = { params: Promise<{ slug: string }> };

interface FieldDiff {
    field: string;
    status: "unchanged" | "added" | "removed" | "modified";
    installedValue?: unknown;
    latestValue?: unknown;
    currentValue?: unknown;
    customized: boolean;
}

interface ComponentDiff {
    type: "agent" | "workflow" | "network";
    sourceSlug: string;
    installedSlug?: string;
    status: "unchanged" | "added" | "removed" | "modified";
    fields: FieldDiff[];
}

const AGENT_DIFF_FIELDS = [
    "instructions",
    "modelProvider",
    "modelName",
    "temperature",
    "maxTokens",
    "memoryEnabled",
    "memoryConfig",
    "maxSteps",
    "description",
    "routingConfig",
    "contextConfig"
] as const;

const WORKFLOW_DIFF_FIELDS = [
    "description",
    "definitionJson",
    "inputSchemaJson",
    "outputSchemaJson",
    "maxSteps",
    "timeout",
    "retryConfig"
] as const;

const NETWORK_DIFF_FIELDS = [
    "description",
    "instructions",
    "modelProvider",
    "modelName",
    "temperature",
    "topologyJson",
    "memoryConfig",
    "maxSteps"
] as const;

function diffFields(
    installedSnapshot: Record<string, unknown>,
    latestSnapshot: Record<string, unknown>,
    currentEntity: Record<string, unknown> | null,
    fieldList: readonly string[],
    trackedCustomizedFields?: string[]
): FieldDiff[] {
    const trackedSet = new Set(trackedCustomizedFields ?? []);
    const diffs: FieldDiff[] = [];
    for (const field of fieldList) {
        const installedVal = installedSnapshot[field];
        const latestVal = latestSnapshot[field];
        const currentVal = currentEntity?.[field];

        const installedStr = JSON.stringify(installedVal);
        const latestStr = JSON.stringify(latestVal);
        const currentStr = currentEntity ? JSON.stringify(currentVal) : installedStr;

        const changed = installedStr !== latestStr;
        const customized =
            trackedSet.has(field) || (currentEntity ? currentStr !== installedStr : false);

        if (!changed) {
            diffs.push({ field, status: "unchanged", customized });
            continue;
        }

        diffs.push({
            field,
            status:
                installedVal === undefined
                    ? "added"
                    : latestVal === undefined
                      ? "removed"
                      : "modified",
            installedValue: installedVal,
            latestValue: latestVal,
            currentValue: currentVal,
            customized
        });
    }
    return diffs;
}

/**
 * GET /api/playbooks/[slug]/diff?installationId=xxx
 * Compare installed version vs latest playbook version
 */
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const { slug } = await params;
        const installationId = request.nextUrl.searchParams.get("installationId");

        if (!installationId) {
            return NextResponse.json(
                { error: "installationId query param required" },
                { status: 400 }
            );
        }

        const playbook = await prisma.playbook.findUnique({ where: { slug } });
        if (!playbook) {
            return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
        }

        const installation = await prisma.playbookInstallation.findUnique({
            where: { id: installationId }
        });
        if (!installation) {
            return NextResponse.json({ error: "Installation not found" }, { status: 404 });
        }
        if (installation.targetOrgId !== authResult.context.organizationId) {
            return NextResponse.json({ error: "Not authorized" }, { status: 403 });
        }

        const [installedVersion, latestVersion] = await Promise.all([
            prisma.playbookVersion.findFirst({
                where: { playbookId: playbook.id, version: installation.versionInstalled }
            }),
            prisma.playbookVersion.findFirst({
                where: { playbookId: playbook.id, version: playbook.version }
            })
        ]);

        if (!installedVersion || !latestVersion) {
            return NextResponse.json({ error: "Version manifests not found" }, { status: 404 });
        }

        if (installation.versionInstalled >= playbook.version) {
            return NextResponse.json({
                upToDate: true,
                installedVersion: installation.versionInstalled,
                latestVersion: playbook.version,
                components: []
            });
        }

        const installedManifest = installedVersion.manifest as Record<string, unknown>;
        const latestManifest = latestVersion.manifest as Record<string, unknown>;

        const installedAgents = (installedManifest.agents ?? []) as Record<string, unknown>[];
        const latestAgents = (latestManifest.agents ?? []) as Record<string, unknown>[];
        const installedWorkflows = (installedManifest.workflows ?? []) as Record<string, unknown>[];
        const latestWorkflows = (latestManifest.workflows ?? []) as Record<string, unknown>[];
        const installedNetworks = (installedManifest.networks ?? []) as Record<string, unknown>[];
        const latestNetworks = (latestManifest.networks ?? []) as Record<string, unknown>[];

        const components: ComponentDiff[] = [];

        // Diff agents
        const currentAgents =
            installation.createdAgentIds.length > 0
                ? await prisma.agent.findMany({
                      where: { id: { in: installation.createdAgentIds } }
                  })
                : [];

        for (const latestAgent of latestAgents) {
            const sourceSlug = latestAgent.slug as string;
            const installedAgent = installedAgents.find((a) => (a.slug as string) === sourceSlug);
            const currentAgent = currentAgents.find((a) => a.sourceAgentSlug === sourceSlug);

            if (!installedAgent) {
                components.push({
                    type: "agent",
                    sourceSlug,
                    status: "added",
                    fields: []
                });
                continue;
            }

            const fields = diffFields(
                installedAgent as Record<string, unknown>,
                latestAgent as Record<string, unknown>,
                currentAgent as unknown as Record<string, unknown> | null,
                AGENT_DIFF_FIELDS,
                (currentAgent as unknown as Record<string, unknown> | null)?.customizedFields as
                    | string[]
                    | undefined
            );

            // Diff tools
            const installedTools = ((installedAgent.tools ?? []) as { toolId: string }[]).map(
                (t) => t.toolId
            );
            const latestTools = ((latestAgent.tools ?? []) as { toolId: string }[]).map(
                (t) => t.toolId
            );
            const toolsChanged =
                JSON.stringify(installedTools.sort()) !== JSON.stringify(latestTools.sort());
            if (toolsChanged) {
                fields.push({
                    field: "tools",
                    status: "modified",
                    installedValue: installedTools,
                    latestValue: latestTools,
                    customized: false
                });
            }

            const hasChanges = fields.some((f) => f.status !== "unchanged");
            components.push({
                type: "agent",
                sourceSlug,
                installedSlug: currentAgent?.slug,
                status: hasChanges ? "modified" : "unchanged",
                fields
            });
        }

        // Detect removed agents
        for (const ia of installedAgents) {
            if (!latestAgents.find((a) => (a.slug as string) === (ia.slug as string))) {
                components.push({
                    type: "agent",
                    sourceSlug: ia.slug as string,
                    status: "removed",
                    fields: []
                });
            }
        }

        // Diff workflows
        const currentWorkflows =
            installation.createdWorkflowIds.length > 0
                ? await prisma.workflow.findMany({
                      where: { id: { in: installation.createdWorkflowIds } }
                  })
                : [];

        for (const latestWf of latestWorkflows) {
            const sourceSlug = latestWf.slug as string;
            const installedWf = installedWorkflows.find((w) => (w.slug as string) === sourceSlug);
            const currentWf = currentWorkflows.find((w) => w.sourceWorkflowSlug === sourceSlug);

            if (!installedWf) {
                components.push({
                    type: "workflow",
                    sourceSlug,
                    status: "added",
                    fields: []
                });
                continue;
            }

            const fields = diffFields(
                installedWf as Record<string, unknown>,
                latestWf as Record<string, unknown>,
                currentWf as unknown as Record<string, unknown> | null,
                WORKFLOW_DIFF_FIELDS,
                (currentWf as unknown as Record<string, unknown> | null)?.customizedFields as
                    | string[]
                    | undefined
            );

            const hasChanges = fields.some((f) => f.status !== "unchanged");
            components.push({
                type: "workflow",
                sourceSlug,
                installedSlug: currentWf?.slug,
                status: hasChanges ? "modified" : "unchanged",
                fields
            });
        }

        // Diff networks
        const currentNetworks =
            installation.createdNetworkIds.length > 0
                ? await prisma.network.findMany({
                      where: { id: { in: installation.createdNetworkIds } }
                  })
                : [];

        for (const latestNet of latestNetworks) {
            const sourceSlug = latestNet.slug as string;
            const installedNet = installedNetworks.find((n) => (n.slug as string) === sourceSlug);
            const currentNet = currentNetworks.find((n) => n.sourceNetworkSlug === sourceSlug);

            if (!installedNet) {
                components.push({
                    type: "network",
                    sourceSlug,
                    status: "added",
                    fields: []
                });
                continue;
            }

            const fields = diffFields(
                installedNet as Record<string, unknown>,
                latestNet as Record<string, unknown>,
                currentNet as unknown as Record<string, unknown> | null,
                NETWORK_DIFF_FIELDS,
                (currentNet as unknown as Record<string, unknown> | null)?.customizedFields as
                    | string[]
                    | undefined
            );

            const hasChanges = fields.some((f) => f.status !== "unchanged");
            components.push({
                type: "network",
                sourceSlug,
                installedSlug: currentNet?.slug,
                status: hasChanges ? "modified" : "unchanged",
                fields
            });
        }

        return NextResponse.json({
            upToDate: false,
            installedVersion: installation.versionInstalled,
            latestVersion: playbook.version,
            components
        });
    } catch (error) {
        console.error("[playbooks] Diff error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}
