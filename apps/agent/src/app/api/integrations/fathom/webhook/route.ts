import { NextRequest, NextResponse } from "next/server";
import { prisma, TriggerEventStatus, type Prisma } from "@repo/database";
import { inngest } from "@/lib/inngest";
import { resolveIdentity } from "@/lib/identity";
import { buildTriggerPayloadSnapshot, createTriggerEventRecord } from "@/lib/trigger-events";

type FathomPayload = Record<string, unknown>;

const resolveMeetingId = (payload: FathomPayload) => {
    return (
        (typeof payload.meetingId === "string" && payload.meetingId) ||
        (typeof payload.meeting_id === "string" && payload.meeting_id) ||
        (typeof payload.id === "string" && payload.id) ||
        null
    );
};

const resolveMeetingTitle = (payload: FathomPayload) => {
    return (
        (typeof payload.title === "string" && payload.title) ||
        (typeof payload.meetingTitle === "string" && payload.meetingTitle) ||
        null
    );
};

const resolveParticipants = (payload: FathomPayload) => {
    const participants = payload.participants || payload.attendees;
    if (!Array.isArray(participants)) return [];
    return participants.filter((entry) => entry && typeof entry === "object") as FathomPayload[];
};

/**
 * POST /api/integrations/fathom/webhook
 *
 * Fathom webhook ingestion endpoint. Stores transcripts and emits triggers.
 */
export async function POST(request: NextRequest) {
    try {
        const payload = (await request.json()) as FathomPayload;
        if (!payload || typeof payload !== "object") {
            return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const connectionId = searchParams.get("connectionId");
        const triggerIdOverride = searchParams.get("triggerId");

        let connection = null;
        if (connectionId) {
            connection = await prisma.integrationConnection.findUnique({
                where: { id: connectionId },
                include: { agentTrigger: true, provider: true }
            });
            if (connection && connection.provider?.key !== "fathom") {
                return NextResponse.json(
                    { success: false, error: "Connection is not a Fathom provider" },
                    { status: 400 }
                );
            }
        } else {
            const provider = await prisma.integrationProvider.findUnique({
                where: { key: "fathom" }
            });
            if (provider) {
                connection = await prisma.integrationConnection.findFirst({
                    where: { providerId: provider.id, isActive: true },
                    include: { agentTrigger: true }
                });
            }
        }

        if (!connection) {
            return NextResponse.json(
                { success: false, error: "Fathom connection not found" },
                { status: 404 }
            );
        }

        const meetingId = resolveMeetingId(payload);
        if (!meetingId) {
            return NextResponse.json(
                { success: false, error: "Missing meeting identifier" },
                { status: 400 }
            );
        }

        const participants = resolveParticipants(payload);
        const workspaceId = connection.agentTrigger?.workspaceId ?? null;
        const triggerId = triggerIdOverride || connection.agentTriggerId || null;

        const transcriptText =
            (typeof payload.transcript === "string" && payload.transcript) ||
            (typeof payload.transcriptText === "string" && payload.transcriptText) ||
            (typeof payload.text === "string" && payload.text) ||
            null;
        const summaryText =
            (typeof payload.summary === "string" && payload.summary) ||
            (typeof payload.summaryText === "string" && payload.summaryText) ||
            null;

        const transcript = await prisma.meetingTranscript.upsert({
            where: {
                integrationConnectionId_meetingId: {
                    integrationConnectionId: connection.id,
                    meetingId
                }
            },
            create: {
                organizationId: connection.organizationId,
                workspaceId,
                integrationConnectionId: connection.id,
                meetingId,
                title: resolveMeetingTitle(payload),
                startedAt:
                    typeof payload.startedAt === "string" ? new Date(payload.startedAt) : undefined,
                endedAt:
                    typeof payload.endedAt === "string" ? new Date(payload.endedAt) : undefined,
                participantsJson: participants as Prisma.InputJsonValue,
                transcriptText,
                summaryText,
                actionItemsJson: payload.actionItems as Prisma.InputJsonValue | undefined,
                sentimentJson: payload.sentiment as Prisma.InputJsonValue | undefined,
                metadata: payload as Prisma.InputJsonValue
            },
            update: {
                title: resolveMeetingTitle(payload),
                startedAt:
                    typeof payload.startedAt === "string" ? new Date(payload.startedAt) : undefined,
                endedAt:
                    typeof payload.endedAt === "string" ? new Date(payload.endedAt) : undefined,
                participantsJson: participants as Prisma.InputJsonValue,
                transcriptText,
                summaryText,
                actionItemsJson: payload.actionItems as Prisma.InputJsonValue | undefined,
                sentimentJson: payload.sentiment as Prisma.InputJsonValue | undefined,
                metadata: payload as Prisma.InputJsonValue
            }
        });

        await Promise.all(
            participants.map((participant) => {
                const email =
                    typeof participant.email === "string"
                        ? participant.email
                        : typeof participant.emailAddress === "string"
                          ? participant.emailAddress
                          : null;
                if (!email) return null;
                return resolveIdentity({
                    organizationId: connection.organizationId,
                    email
                });
            })
        );

        const { normalizedPayload } = buildTriggerPayloadSnapshot({
            meetingId,
            transcriptId: transcript.id,
            ...payload
        });

        const triggerEvent = await createTriggerEventRecord({
            triggerId,
            agentId: connection.agentTrigger?.agentId ?? null,
            workspaceId,
            status: TriggerEventStatus.RECEIVED,
            sourceType: "integration",
            triggerType: "event",
            entityType: "agent",
            integrationKey: "fathom",
            integrationId: connection.id,
            eventName: "fathom.transcript.received",
            payload: normalizedPayload
        });

        await prisma.crmAuditLog.create({
            data: {
                organizationId: connection.organizationId,
                workspaceId,
                integrationConnectionId: connection.id,
                eventType: "fathom.webhook",
                recordType: "meeting",
                recordId: meetingId,
                sourceType: "fathom",
                sourceId: transcript.id,
                payloadJson: normalizedPayload as Prisma.InputJsonValue
            }
        });

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

        return NextResponse.json({
            success: true,
            meetingId,
            transcriptId: transcript.id,
            triggerEventId: triggerEvent.id
        });
    } catch (error) {
        console.error("[Fathom] Webhook error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Webhook failed" },
            { status: 500 }
        );
    }
}
