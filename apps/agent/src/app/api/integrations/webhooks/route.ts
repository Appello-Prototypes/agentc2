import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { randomBytes } from "crypto";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { getIntegrationProviders } from "@repo/mastra";
import { auditLog } from "@/lib/audit-log";
import { getUserOrganizationId } from "@/lib/organization";
import {
    extractTriggerInputMapping,
    mergeTriggerInputMapping,
    validateTriggerInputMapping,
    type TriggerInputMapping
} from "@/lib/unified-triggers";

/**
 * POST /api/integrations/webhooks
 *
 * Create a webhook connection and wire it to an agent trigger.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const organizationId = await getUserOrganizationId(session.user.id);
        if (!organizationId) {
            return NextResponse.json(
                { success: false, error: "Organization membership required" },
                { status: 403 }
            );
        }

        const membership = await prisma.membership.findFirst({
            where: { userId: session.user.id, organizationId }
        });
        if (!membership || !["owner", "admin"].includes(membership.role)) {
            return NextResponse.json(
                { success: false, error: "Insufficient permissions" },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { agentId, name, description, filter, inputMapping, isActive } = body as {
            agentId?: string;
            name?: string;
            description?: string;
            filter?: Record<string, unknown> | null;
            inputMapping?: TriggerInputMapping | null;
            isActive?: boolean;
        };

        if (!agentId || !name) {
            return NextResponse.json(
                { success: false, error: "Missing required fields: agentId, name" },
                { status: 400 }
            );
        }

        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ id: agentId }, { slug: agentId }],
                workspace: { organizationId }
            },
            select: { id: true, slug: true, workspaceId: true }
        });

        if (!agent) {
            return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
        }

        const mappingCandidate = extractTriggerInputMapping(inputMapping);
        if (inputMapping !== undefined && inputMapping !== null && !mappingCandidate) {
            return NextResponse.json(
                { success: false, error: "inputMapping must be an object" },
                { status: 400 }
            );
        }

        const mergedMapping = mergeTriggerInputMapping(mappingCandidate, null);
        const mappingValidation = validateTriggerInputMapping(mergedMapping);
        if (!mappingValidation.valid) {
            return NextResponse.json(
                {
                    success: false,
                    error: mappingValidation.error || "Invalid inputMapping"
                },
                { status: 400 }
            );
        }

        await getIntegrationProviders();
        const webhookProvider = await prisma.integrationProvider.findUnique({
            where: { key: "webhook" }
        });
        if (!webhookProvider) {
            return NextResponse.json(
                { success: false, error: "Webhook provider not configured" },
                { status: 500 }
            );
        }

        const webhookPath = `trigger_${randomBytes(16).toString("hex")}`;
        const webhookSecret = randomBytes(32).toString("hex");

        const trigger = await prisma.agentTrigger.create({
            data: {
                agentId: agent.id,
                workspaceId: agent.workspaceId,
                name,
                description: description || null,
                triggerType: "webhook",
                webhookPath,
                webhookSecret,
                filterJson: filter ? JSON.parse(JSON.stringify(filter)) : null,
                inputMapping: mergedMapping ? JSON.parse(JSON.stringify(mergedMapping)) : null,
                isActive: isActive !== false
            }
        });

        const connection = await prisma.integrationConnection.create({
            data: {
                providerId: webhookProvider.id,
                organizationId,
                scope: "org",
                name,
                isDefault: false,
                isActive: true,
                webhookPath,
                webhookSecret,
                agentTriggerId: trigger.id,
                metadata: {
                    agentId: agent.id,
                    agentSlug: agent.slug,
                    triggerId: trigger.id
                }
            }
        });

        await auditLog.webhookCreate(trigger.id, session.user.id, organizationId, {
            connectionId: connection.id,
            agentId: agent.id
        });

        return NextResponse.json({
            success: true,
            connection,
            webhook: {
                path: `/api/webhooks/${webhookPath}`,
                secret: webhookSecret,
                note: "Save this secret - it won't be shown again"
            }
        });
    } catch (error) {
        console.error("[Integrations Webhook] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to create webhook"
            },
            { status: 500 }
        );
    }
}
