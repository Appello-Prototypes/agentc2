import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { randomBytes } from "crypto";

/**
 * GET /api/agents/[id]/triggers
 *
 * List all triggers for an agent
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        // Find agent
        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id: id }]
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        // Get triggers
        const triggers = await prisma.agentTrigger.findMany({
            where: { agentId: agent.id },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json({
            success: true,
            triggers: triggers.map((t) => ({
                id: t.id,
                name: t.name,
                description: t.description,
                triggerType: t.triggerType,
                eventName: t.eventName,
                webhookPath: t.webhookPath,
                // Don't expose webhook secret
                hasWebhookSecret: !!t.webhookSecret,
                filterJson: t.filterJson,
                inputMapping: t.inputMapping,
                isActive: t.isActive,
                lastTriggeredAt: t.lastTriggeredAt,
                triggerCount: t.triggerCount,
                createdAt: t.createdAt,
                updatedAt: t.updatedAt
            })),
            total: triggers.length
        });
    } catch (error) {
        console.error("[Triggers] Error listing:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list triggers"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/agents/[id]/triggers
 *
 * Create a new trigger for an agent
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();

        const { name, description, triggerType, eventName, filter, inputMapping, isActive } = body;

        if (!name || !triggerType) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Missing required fields: name, triggerType"
                },
                { status: 400 }
            );
        }

        // Validate trigger type
        const validTypes = ["webhook", "event", "mcp"];
        if (!validTypes.includes(triggerType)) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Invalid triggerType. Must be one of: ${validTypes.join(", ")}`
                },
                { status: 400 }
            );
        }

        // Find agent
        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id: id }]
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        // Generate webhook path and secret for webhook triggers
        let webhookPath: string | null = null;
        let webhookSecret: string | null = null;

        if (triggerType === "webhook") {
            webhookPath = `trigger_${randomBytes(16).toString("hex")}`;
            webhookSecret = randomBytes(32).toString("hex");
        }

        // Create trigger
        const trigger = await prisma.agentTrigger.create({
            data: {
                agentId: agent.id,
                workspaceId: agent.workspaceId,
                name,
                description,
                triggerType,
                eventName,
                webhookPath,
                webhookSecret,
                filterJson: filter ? JSON.parse(JSON.stringify(filter)) : null,
                inputMapping: inputMapping ? JSON.parse(JSON.stringify(inputMapping)) : null,
                isActive: isActive !== false
            }
        });

        const response: Record<string, unknown> = {
            success: true,
            trigger: {
                id: trigger.id,
                name: trigger.name,
                description: trigger.description,
                triggerType: trigger.triggerType,
                eventName: trigger.eventName,
                isActive: trigger.isActive,
                createdAt: trigger.createdAt
            }
        };

        // Include webhook details for webhook triggers
        if (triggerType === "webhook") {
            response.webhook = {
                path: `/api/webhooks/${webhookPath}`,
                secret: webhookSecret,
                note: "Save this secret - it won't be shown again"
            };
        }

        return NextResponse.json(response);
    } catch (error) {
        console.error("[Triggers] Error creating:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to create trigger"
            },
            { status: 500 }
        );
    }
}
