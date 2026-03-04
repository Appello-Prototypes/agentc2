import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@repo/database";

type Params = { params: Promise<{ id: string }> };

const AGENT_MERGEABLE_FIELDS = new Set([
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
    "contextConfig",
    "tools"
]);

const WORKFLOW_MERGEABLE_FIELDS = new Set([
    "description",
    "definitionJson",
    "inputSchemaJson",
    "outputSchemaJson",
    "maxSteps",
    "timeout",
    "retryConfig"
]);

const NETWORK_MERGEABLE_FIELDS = new Set([
    "description",
    "instructions",
    "modelProvider",
    "modelName",
    "temperature",
    "topologyJson",
    "memoryConfig",
    "maxSteps"
]);

interface AcceptedChanges {
    agents: Record<string, { fields: string[] }>;
    workflows: Record<string, { fields: string[] }>;
    networks: Record<string, { fields: string[] }>;
}

/**
 * POST /api/playbooks/installations/[id]/merge
 * Apply selected field updates from the latest playbook version
 */
export async function POST(request: NextRequest, { params }: Params) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const { id } = await params;
        const body = await request.json();
        const { acceptedChanges } = body as { acceptedChanges: AcceptedChanges };

        if (!acceptedChanges) {
            return NextResponse.json({ error: "acceptedChanges is required" }, { status: 400 });
        }

        const installation = await prisma.playbookInstallation.findUnique({
            where: { id },
            include: { playbook: true }
        });

        if (!installation) {
            return NextResponse.json({ error: "Installation not found" }, { status: 404 });
        }

        if (installation.targetOrgId !== authResult.context.organizationId) {
            return NextResponse.json({ error: "Not authorized" }, { status: 403 });
        }

        const latestVersion = await prisma.playbookVersion.findFirst({
            where: {
                playbookId: installation.playbookId,
                version: installation.playbook.version
            }
        });

        if (!latestVersion) {
            return NextResponse.json(
                { error: "Latest version manifest not found" },
                { status: 404 }
            );
        }

        const manifest = latestVersion.manifest as Record<string, unknown>;
        const latestAgents = (manifest.agents ?? []) as Record<string, unknown>[];
        const latestWorkflows = (manifest.workflows ?? []) as Record<string, unknown>[];
        const latestNetworks = (manifest.networks ?? []) as Record<string, unknown>[];

        const updates: string[] = [];

        // Merge agent changes
        for (const [sourceSlug, { fields }] of Object.entries(acceptedChanges.agents ?? {})) {
            const validFields = fields.filter((f) => AGENT_MERGEABLE_FIELDS.has(f));
            if (validFields.length === 0) continue;

            const snapshot = latestAgents.find((a) => (a.slug as string) === sourceSlug);
            if (!snapshot) continue;

            const agent = await prisma.agent.findFirst({
                where: {
                    id: { in: installation.createdAgentIds },
                    sourceAgentSlug: sourceSlug
                }
            });
            if (!agent) continue;

            // Handle tools separately — update AgentTool junction table
            if (validFields.includes("tools")) {
                const toolSnapshots = (snapshot.tools ?? []) as { toolId: string }[];
                const newToolIds = toolSnapshots.map((t) => t.toolId);

                await prisma.agentTool.deleteMany({
                    where: { agentId: agent.id }
                });
                if (newToolIds.length > 0) {
                    await prisma.agentTool.createMany({
                        data: newToolIds.map((toolId) => ({
                            agentId: agent.id,
                            toolId
                        }))
                    });
                }
            }

            // Build update data for scalar fields
            const scalarFields = validFields.filter((f) => f !== "tools");
            if (scalarFields.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data: Record<string, any> = {};
                for (const field of scalarFields) {
                    data[field] = snapshot[field] ?? null;
                }
                data.sourceAgentVersion = installation.playbook.version;

                await prisma.agent.update({
                    where: { id: agent.id },
                    data
                });
            }

            updates.push(`agent:${sourceSlug} (${validFields.join(", ")})`);
        }

        // Merge workflow changes
        for (const [sourceSlug, { fields }] of Object.entries(acceptedChanges.workflows ?? {})) {
            const validFields = fields.filter((f) => WORKFLOW_MERGEABLE_FIELDS.has(f));
            if (validFields.length === 0) continue;

            const snapshot = latestWorkflows.find((w) => (w.slug as string) === sourceSlug);
            if (!snapshot) continue;

            const workflow = await prisma.workflow.findFirst({
                where: {
                    id: { in: installation.createdWorkflowIds },
                    sourceWorkflowSlug: sourceSlug
                }
            });
            if (!workflow) continue;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data: Record<string, any> = {};
            for (const field of validFields) {
                data[field] = snapshot[field] ?? null;
            }
            data.sourceWorkflowVersion = installation.playbook.version;

            await prisma.workflow.update({
                where: { id: workflow.id },
                data
            });

            updates.push(`workflow:${sourceSlug} (${validFields.join(", ")})`);
        }

        // Merge network changes
        for (const [sourceSlug, { fields }] of Object.entries(acceptedChanges.networks ?? {})) {
            const validFields = fields.filter((f) => NETWORK_MERGEABLE_FIELDS.has(f));
            if (validFields.length === 0) continue;

            const snapshot = latestNetworks.find((n) => (n.slug as string) === sourceSlug);
            if (!snapshot) continue;

            const network = await prisma.network.findFirst({
                where: {
                    id: { in: installation.createdNetworkIds },
                    sourceNetworkSlug: sourceSlug
                }
            });
            if (!network) continue;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data: Record<string, any> = {};
            for (const field of validFields) {
                data[field] = snapshot[field] ?? null;
            }
            data.sourceNetworkVersion = installation.playbook.version;

            await prisma.network.update({
                where: { id: network.id },
                data
            });

            updates.push(`network:${sourceSlug} (${validFields.join(", ")})`);
        }

        // Update installation version and record rejected changes
        const customizations = (installation.customizations as Record<string, unknown>) ?? {};
        const rejectedAtVersion =
            (customizations.rejectedAtVersion as Record<string, unknown>) ?? {};
        rejectedAtVersion[String(installation.playbook.version)] = {
            mergedAt: new Date().toISOString(),
            appliedUpdates: updates
        };

        await prisma.playbookInstallation.update({
            where: { id },
            data: {
                versionInstalled: installation.playbook.version,
                lastCheckedAt: new Date(),
                customizations: {
                    ...customizations,
                    rejectedAtVersion
                }
            }
        });

        return NextResponse.json({
            success: true,
            message: `Applied ${updates.length} update(s)`,
            updates
        });
    } catch (error) {
        console.error("[playbooks] Merge error:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Internal error"
            },
            { status: 500 }
        );
    }
}
