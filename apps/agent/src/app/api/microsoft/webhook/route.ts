import { NextRequest, NextResponse } from "next/server";
import { prisma, TriggerEventStatus } from "@repo/database";
import { inngest } from "@/lib/inngest";
import { getMessage, parseMessageToPayload } from "@/lib/outlook-mail";
import { getEvent, parseEventToPayload } from "@/lib/outlook-calendar";
import { buildTriggerPayloadSnapshot, createTriggerEventRecord } from "@/lib/trigger-events";

// ── Types ──────────────────────────────────────────────────────────

type GraphNotification = {
    subscriptionId: string;
    changeType: string;
    resource: string;
    clientState?: string;
    resourceData?: {
        id: string;
        "@odata.type"?: string;
    };
};

type GraphNotificationPayload = {
    value: GraphNotification[];
};

// ── Helpers ────────────────────────────────────────────────────────

async function findSubscription(subscriptionId: string) {
    return prisma.webhookSubscription.findFirst({
        where: {
            externalSubscriptionId: subscriptionId,
            isActive: true,
            providerKey: { startsWith: "microsoft-" }
        },
        include: {
            integrationConnection: {
                include: { provider: true }
            }
        }
    });
}

async function findTriggerForConnection(connectionId: string, eventName: string) {
    // Find the connection, then find triggers linked to agents in the same org
    const connection = await prisma.integrationConnection.findUnique({
        where: { id: connectionId }
    });
    if (!connection) return null;

    return prisma.agentTrigger.findFirst({
        where: {
            triggerType: "event",
            eventName,
            isActive: true,
            agent: {
                isActive: true,
                workspace: { organizationId: connection.organizationId }
            }
        },
        include: {
            agent: { select: { id: true, slug: true } }
        }
    });
}

// ── Route Handlers ─────────────────────────────────────────────────

/**
 * POST /api/microsoft/webhook
 *
 * Handles two cases:
 * 1. Subscription validation: Microsoft sends a POST with ?validationToken=...
 *    Must echo back as text/plain 200.
 * 2. Notification delivery: Microsoft sends change notifications in JSON body.
 */
export async function POST(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const validationToken = searchParams.get("validationToken");

    // ── Case 1: Subscription validation handshake ──────────────────
    if (validationToken) {
        return new NextResponse(validationToken, {
            status: 200,
            headers: { "Content-Type": "text/plain" }
        });
    }

    // ── Case 2: Notification delivery ──────────────────────────────
    try {
        const body = (await request.json()) as GraphNotificationPayload;
        const notifications = body.value || [];

        for (const notification of notifications) {
            try {
                await processNotification(notification);
            } catch (error) {
                console.error(
                    `[Microsoft Webhook] Failed to process notification for subscription ${notification.subscriptionId}:`,
                    error
                );
            }
        }

        // Must return 202 quickly to prevent Graph from retrying
        return NextResponse.json({ success: true }, { status: 202 });
    } catch (error) {
        console.error("[Microsoft Webhook] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to process webhook"
            },
            { status: 500 }
        );
    }
}

// ── Notification Processing ────────────────────────────────────────

async function processNotification(notification: GraphNotification) {
    const subscription = await findSubscription(notification.subscriptionId);
    if (!subscription) {
        console.warn(`[Microsoft Webhook] Unknown subscription: ${notification.subscriptionId}`);
        return;
    }

    // Verify clientState
    if (subscription.clientState && notification.clientState !== subscription.clientState) {
        console.warn(
            `[Microsoft Webhook] clientState mismatch for subscription ${notification.subscriptionId}`
        );
        return;
    }

    const connectionId = subscription.integrationConnectionId;
    const providerKey = subscription.providerKey;
    const resourceId = notification.resourceData?.id;

    if (!resourceId) {
        console.warn("[Microsoft Webhook] No resourceData.id in notification");
        return;
    }

    if (providerKey === "microsoft-mail") {
        await processMail(connectionId, resourceId);
    } else if (providerKey === "microsoft-calendar") {
        await processCalendar(
            connectionId,
            resourceId,
            notification.changeType as "created" | "updated"
        );
    }
}

async function processMail(connectionId: string, messageId: string) {
    const eventName = "microsoft.mail.received";
    const trigger = await findTriggerForConnection(connectionId, eventName);
    if (!trigger) return;

    try {
        const message = await getMessage(connectionId, messageId);
        const payload = parseMessageToPayload(message, connectionId);
        const { normalizedPayload } = buildTriggerPayloadSnapshot(payload);

        const triggerEvent = await createTriggerEventRecord({
            triggerId: trigger.id,
            agentId: trigger.agent.id,
            workspaceId: trigger.workspaceId,
            status: TriggerEventStatus.RECEIVED,
            sourceType: "integration",
            triggerType: "event",
            entityType: "agent",
            integrationKey: "microsoft",
            integrationId: connectionId,
            eventName,
            payload: normalizedPayload
        });

        await inngest.send({
            name: "agent/trigger.fire",
            data: {
                triggerId: trigger.id,
                agentId: trigger.agent.id,
                triggerEventId: triggerEvent?.id,
                payload
            }
        });
    } catch (error) {
        console.error(`[Microsoft Webhook] Mail processing error:`, error);
    }
}

async function processCalendar(
    connectionId: string,
    eventId: string,
    changeType: "created" | "updated"
) {
    const eventName =
        changeType === "created"
            ? "microsoft.calendar.event.created"
            : "microsoft.calendar.event.updated";
    const trigger = await findTriggerForConnection(connectionId, eventName);
    if (!trigger) return;

    try {
        const calEvent = await getEvent(connectionId, eventId);
        const payload = parseEventToPayload(calEvent, connectionId, changeType);
        const { normalizedPayload } = buildTriggerPayloadSnapshot(payload);

        const triggerEvent = await createTriggerEventRecord({
            triggerId: trigger.id,
            agentId: trigger.agent.id,
            workspaceId: trigger.workspaceId,
            status: TriggerEventStatus.RECEIVED,
            sourceType: "integration",
            triggerType: "event",
            entityType: "agent",
            integrationKey: "microsoft",
            integrationId: connectionId,
            eventName,
            payload: normalizedPayload
        });

        await inngest.send({
            name: "agent/trigger.fire",
            data: {
                triggerId: trigger.id,
                agentId: trigger.agent.id,
                triggerEventId: triggerEvent?.id,
                payload
            }
        });
    } catch (error) {
        console.error(`[Microsoft Webhook] Calendar processing error:`, error);
    }
}
