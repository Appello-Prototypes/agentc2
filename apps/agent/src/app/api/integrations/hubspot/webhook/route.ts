import { NextRequest, NextResponse } from "next/server";
import { prisma, TriggerEventStatus, type Prisma } from "@repo/database";
import { inngest } from "@/lib/inngest";
import { buildTriggerPayloadSnapshot, createTriggerEventRecord } from "@/lib/trigger-events";
import { resolveIdentity } from "@/lib/identity";

type HubSpotEvent = Record<string, unknown>;

const normalizeHubSpotEvents = (payload: unknown): HubSpotEvent[] => {
    if (Array.isArray(payload)) {
        return payload.filter(
            (entry) => typeof entry === "object" && entry !== null
        ) as HubSpotEvent[];
    }
    if (
        payload &&
        typeof payload === "object" &&
        Array.isArray((payload as { events?: unknown }).events)
    ) {
        return (payload as { events: unknown[] }).events.filter(
            (entry) => typeof entry === "object" && entry !== null
        ) as HubSpotEvent[];
    }
    return payload && typeof payload === "object" ? [payload as HubSpotEvent] : [];
};

const getPortalId = (events: HubSpotEvent[]) => {
    const first = events[0];
    if (!first) return null;
    const portalId = first.portalId || first.portal_id || first.portalID;
    return typeof portalId === "number" || typeof portalId === "string" ? `${portalId}` : null;
};

const getEventName = (event: HubSpotEvent) => {
    return (
        (typeof event.eventType === "string" && event.eventType) ||
        (typeof event.subscriptionType === "string" && event.subscriptionType) ||
        (typeof event.type === "string" && event.type) ||
        null
    );
};

const getRecordType = (event: HubSpotEvent) => {
    return (
        (typeof event.objectType === "string" && event.objectType) ||
        (typeof event.objectTypeId === "string" && event.objectTypeId) ||
        null
    );
};

const getRecordId = (event: HubSpotEvent) => {
    const objectId = event.objectId || event.objectID || event.recordId;
    return typeof objectId === "number" || typeof objectId === "string" ? `${objectId}` : null;
};

/**
 * POST /api/integrations/hubspot/webhook
 *
 * HubSpot webhook ingestion endpoint. Requires connectionId or a default hubspot connection.
 */
export async function POST(request: NextRequest) {
    try {
        const payload = await request.json().catch(() => null);
        const events = normalizeHubSpotEvents(payload);
        if (events.length === 0) {
            return NextResponse.json(
                { success: false, error: "No events provided" },
                { status: 400 }
            );
        }

        const { searchParams } = new URL(request.url);
        const connectionId = searchParams.get("connectionId");
        const triggerIdOverride = searchParams.get("triggerId");
        const portalId = getPortalId(events);

        let connection = null;
        if (connectionId) {
            connection = await prisma.integrationConnection.findUnique({
                where: { id: connectionId },
                include: { agentTrigger: true, provider: true }
            });
            if (connection && connection.provider?.key !== "hubspot") {
                return NextResponse.json(
                    { success: false, error: "Connection is not a HubSpot provider" },
                    { status: 400 }
                );
            }
        } else {
            const provider = await prisma.integrationProvider.findUnique({
                where: { key: "hubspot" }
            });
            if (provider) {
                connection = await prisma.integrationConnection.findFirst({
                    where: {
                        providerId: provider.id,
                        isActive: true,
                        ...(portalId
                            ? {
                                  metadata: {
                                      path: ["portalId"],
                                      equals: portalId
                                  }
                              }
                            : {})
                    },
                    include: { agentTrigger: true }
                });
            }
        }

        if (!connection) {
            return NextResponse.json(
                { success: false, error: "HubSpot connection not found" },
                { status: 404 }
            );
        }

        const triggerId = triggerIdOverride || connection.agentTriggerId || null;
        const workspaceId = connection.agentTrigger?.workspaceId ?? null;

        const results = await Promise.all(
            events.map(async (event) => {
                const { normalizedPayload } = buildTriggerPayloadSnapshot({
                    portalId,
                    ...event
                });

                const triggerEvent = await createTriggerEventRecord({
                    triggerId,
                    agentId: connection.agentTrigger?.agentId ?? null,
                    workspaceId,
                    status: TriggerEventStatus.RECEIVED,
                    sourceType: "integration",
                    triggerType: "event",
                    entityType: "agent",
                    integrationKey: "hubspot",
                    integrationId: connection.id,
                    eventName: getEventName(event),
                    payload: normalizedPayload,
                    metadata: portalId ? { portalId } : null
                });

                await prisma.crmAuditLog.create({
                    data: {
                        organizationId: connection.organizationId,
                        workspaceId,
                        integrationConnectionId: connection.id,
                        eventType: "hubspot.webhook",
                        recordType: getRecordType(event),
                        recordId: getRecordId(event),
                        sourceType: "hubspot",
                        sourceId:
                            typeof event.eventId === "number" || typeof event.eventId === "string"
                                ? `${event.eventId}`
                                : null,
                        payloadJson: normalizedPayload as Prisma.InputJsonValue
                    }
                });

                const email =
                    typeof event.email === "string"
                        ? event.email
                        : typeof event.contactEmail === "string"
                          ? event.contactEmail
                          : null;
                if (email) {
                    await resolveIdentity({
                        organizationId: connection.organizationId,
                        email,
                        hubspotContactId: getRecordId(event)
                    });
                }

                if (triggerId) {
                    const agentId = connection.agentTrigger?.agentId;
                    if (agentId) {
                        const eventPayload = {
                            triggerId,
                            agentId,
                            triggerEventId: triggerEvent.id,
                            payload: normalizedPayload
                        } as unknown as {
                            triggerId: string;
                            agentId: string;
                            payload: Record<string, unknown>;
                        };

                        await inngest.send({
                            name: "agent/trigger.fire",
                            data: eventPayload
                        });
                    }
                }

                return triggerEvent.id;
            })
        );

        return NextResponse.json({
            success: true,
            received: events.length,
            triggerEvents: results
        });
    } catch (error) {
        console.error("[HubSpot] Webhook error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Webhook failed" },
            { status: 500 }
        );
    }
}
