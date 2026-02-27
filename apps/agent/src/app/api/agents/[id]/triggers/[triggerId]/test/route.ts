import { NextRequest, NextResponse } from "next/server";
import { prisma, TriggerEventStatus } from "@repo/database";
import { inngest } from "@/lib/inngest";
import {
    buildTriggerPayloadSnapshot,
    buildTriggerTestPayload,
    createTriggerEventRecord,
    updateTriggerEventRecord
} from "@/lib/trigger-events";

/**
 * POST /api/agents/[id]/triggers/[triggerId]/test
 *
 * Fire a test payload through a trigger for validation.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; triggerId: string }> }
) {
    try {
        const { id, triggerId } = await params;
        const body = await request.json().catch(() => ({}));

        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id }]
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        const trigger = await prisma.agentTrigger.findFirst({
            where: { id: triggerId, agentId: agent.id },
            include: {
                agent: {
                    select: { id: true, slug: true, isActive: true }
                }
            }
        });

        if (!trigger || !trigger.agent) {
            return NextResponse.json(
                { success: false, error: `Trigger '${triggerId}' not found` },
                { status: 404 }
            );
        }

        const basePayload =
            trigger.filterJson && typeof trigger.filterJson === "object"
                ? (trigger.filterJson as Record<string, unknown>)
                : {};
        const overrides =
            body?.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
                ? (body.payload as Record<string, unknown>)
                : null;
        const testPayload = buildTriggerTestPayload(basePayload, overrides);
        const { normalizedPayload } = buildTriggerPayloadSnapshot(testPayload);

        const triggerEvent = await createTriggerEventRecord({
            triggerId: trigger.id,
            agentId: trigger.agent.id,
            workspaceId: trigger.workspaceId,
            status: TriggerEventStatus.RECEIVED,
            sourceType: trigger.triggerType === "webhook" ? "webhook" : "event",
            triggerType: trigger.triggerType,
            entityType: "agent",
            integrationKey: trigger.eventName === "gmail.message.received" ? "gmail" : null,
            eventName: trigger.eventName,
            webhookPath: trigger.webhookPath,
            payload: normalizedPayload,
            metadata: { test: true }
        });

        if (!trigger.isActive) {
            await updateTriggerEventRecord(triggerEvent.id, {
                status: TriggerEventStatus.SKIPPED,
                errorMessage: "Trigger is disabled"
            });
            return NextResponse.json(
                { success: false, error: "Trigger is disabled" },
                { status: 403 }
            );
        }

        if (!trigger.agent.isActive) {
            await updateTriggerEventRecord(triggerEvent.id, {
                status: TriggerEventStatus.SKIPPED,
                errorMessage: "Agent is disabled"
            });
            return NextResponse.json(
                { success: false, error: "Agent is disabled" },
                { status: 403 }
            );
        }

        await inngest.send({
            name: "agent/trigger.fire",
            data: {
                triggerId: trigger.id,
                agentId: trigger.agent.id,
                triggerEventId: triggerEvent.id,
                payload: {
                    ...normalizedPayload,
                    _trigger: {
                        id: trigger.id,
                        name: trigger.name,
                        type: trigger.triggerType,
                        eventName: trigger.eventName
                    },
                    _test: true
                }
            }
        });

        return NextResponse.json({
            success: true,
            triggerEventId: triggerEvent.id
        });
    } catch (error) {
        console.error("[Triggers] Error testing trigger:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to test trigger"
            },
            { status: 500 }
        );
    }
}
