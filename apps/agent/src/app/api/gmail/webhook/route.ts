import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { prisma, TriggerEventStatus } from "@repo/database";
import { inngest } from "@/lib/inngest";
import { getGmailClient, getMessage, listHistory } from "@/lib/gmail";
import { buildTriggerPayloadSnapshot, createTriggerEventRecord } from "@/lib/trigger-events";
import { resolveIdentity } from "@/lib/identity";

const DEFAULT_BUSINESS_HOURS = { start: 9, end: 17, timezone: "UTC" };

const getSenderDomain = (email?: string) => {
    if (!email) return null;
    const parts = email.split("@");
    if (parts.length !== 2) return null;
    return parts[1]?.toLowerCase() || null;
};

const isWithinBusinessHours = (date: Date, timezone: string, start: number, end: number) => {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        hour12: false
    });
    const hour = Number(formatter.format(date));
    return hour >= start && hour < end;
};

const verifyPubSubRequest = async (request: NextRequest) => {
    const verificationToken = process.env.GMAIL_PUBSUB_VERIFICATION_TOKEN;
    const { searchParams } = new URL(request.url);
    const tokenParam = searchParams.get("token");
    const headerToken = request.headers.get("x-pubsub-token");

    if (verificationToken) {
        if (verificationToken !== tokenParam && verificationToken !== headerToken) {
            throw new Error("Invalid Pub/Sub verification token");
        }
        return;
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        throw new Error("Missing Pub/Sub authorization");
    }

    const jwt = authHeader.replace("Bearer ", "");
    const client = new OAuth2Client();
    await client.verifyIdToken({
        idToken: jwt,
        audience: request.url
    });
};

/**
 * POST /api/gmail/webhook
 *
 * Pub/Sub push endpoint for Gmail watch notifications.
 */
export async function POST(request: NextRequest) {
    try {
        await verifyPubSubRequest(request);

        const body = await request.json();
        const messageData = body?.message?.data;

        if (!messageData) {
            return NextResponse.json(
                { success: false, error: "Missing Pub/Sub message" },
                { status: 400 }
            );
        }

        const decoded = JSON.parse(Buffer.from(messageData, "base64").toString("utf8"));
        const gmailAddress = decoded.emailAddress as string | undefined;
        const historyId = decoded.historyId != null ? String(decoded.historyId) : undefined;

        if (!gmailAddress || !historyId) {
            return NextResponse.json(
                { success: false, error: "Invalid Gmail notification payload" },
                { status: 400 }
            );
        }

        const integration = await prisma.gmailIntegration.findFirst({
            where: { gmailAddress, isActive: true },
            include: {
                workspace: {
                    select: { organizationId: true }
                },
                agent: {
                    select: { id: true, slug: true, isActive: true }
                }
            }
        });

        const organizationId = integration?.workspace?.organizationId;
        if (!integration || !organizationId) {
            return NextResponse.json({ success: true, processed: 0 });
        }

        if (!integration.agent.isActive) {
            await createTriggerEventRecord({
                agentId: integration.agentId,
                workspaceId: integration.workspaceId,
                status: TriggerEventStatus.SKIPPED,
                sourceType: "integration",
                triggerType: "event",
                entityType: "agent",
                integrationKey: "gmail",
                integrationId: integration.id,
                eventName: "gmail.message.received",
                payload: { gmailAddress, historyId },
                errorMessage: "Agent is disabled"
            });
            return NextResponse.json({ success: true, processed: 0 });
        }

        const trigger = await prisma.agentTrigger.findFirst({
            where: {
                agentId: integration.agentId,
                triggerType: "event",
                eventName: "gmail.message.received",
                isActive: true
            }
        });

        if (!trigger) {
            await createTriggerEventRecord({
                agentId: integration.agentId,
                workspaceId: integration.workspaceId,
                status: TriggerEventStatus.SKIPPED,
                sourceType: "integration",
                triggerType: "event",
                entityType: "agent",
                integrationKey: "gmail",
                integrationId: integration.id,
                eventName: "gmail.message.received",
                payload: { gmailAddress, historyId },
                errorMessage: "Gmail trigger not configured"
            });
            return NextResponse.json(
                { success: false, error: "Gmail trigger not configured" },
                { status: 400 }
            );
        }

        const gmail = await getGmailClient(organizationId, gmailAddress);

        if (!integration.historyId) {
            await prisma.gmailIntegration.update({
                where: { id: integration.id },
                data: { historyId }
            });
            return NextResponse.json({ success: true, processed: 0 });
        }

        const messageIds = await listHistory(gmail, integration.historyId);

        if (messageIds.length === 0) {
            await prisma.gmailIntegration.update({
                where: { id: integration.id },
                data: { historyId }
            });
            return NextResponse.json({ success: true, processed: 0 });
        }

        const messages = await Promise.all(messageIds.map((id) => getMessage(gmail, id)));

        const gmailProvider = await prisma.integrationProvider.findUnique({
            where: { key: "gmail" }
        });
        const connection = gmailProvider
            ? await prisma.integrationConnection.findFirst({
                  where: {
                      providerId: gmailProvider.id,
                      organizationId,
                      credentials: {
                          path: ["gmailAddress"],
                          equals: gmailAddress
                      }
                  }
              })
            : null;

        if (connection && !integration.integrationConnectionId) {
            await prisma.gmailIntegration.update({
                where: { id: integration.id },
                data: { integrationConnectionId: connection.id }
            });
        }

        const organizationDomains = await prisma.organizationDomain.findMany({
            where: { organizationId },
            select: { domain: true }
        });
        const domainSet = new Set(organizationDomains.map((entry) => entry.domain.toLowerCase()));

        const enrichedMessages = messages.map((message) => {
            const senderEmail = message.parsedFrom[0];
            const senderDomain = getSenderDomain(senderEmail);
            const senderType = senderDomain
                ? domainSet.has(senderDomain)
                    ? "internal"
                    : "external"
                : "unknown";
            const receivedAt = message.internalDate
                ? new Date(Number(message.internalDate))
                : message.date
                  ? new Date(message.date)
                  : new Date();
            const inBusinessHours = isWithinBusinessHours(
                receivedAt,
                DEFAULT_BUSINESS_HOURS.timezone,
                DEFAULT_BUSINESS_HOURS.start,
                DEFAULT_BUSINESS_HOURS.end
            );
            const isForwarded = message.subject?.toLowerCase().startsWith("fwd:") || false;
            const isImportant = (message.labels || []).some((label) =>
                ["IMPORTANT", "STARRED"].includes(label)
            );

            const payload = {
                gmailAddress,
                integrationConnectionId: connection?.id || null,
                threadId: message.threadId,
                messageId: message.messageId,
                from: message.from,
                to: message.to,
                cc: message.cc,
                bcc: message.bcc,
                parsedTo: message.parsedTo,
                parsedCc: message.parsedCc,
                parsedBcc: message.parsedBcc,
                subject: message.subject,
                snippet: message.snippet,
                date: message.date,
                labels: message.labels,
                hasAttachments: message.hasAttachments,
                attachments: message.attachments,
                bodyText: message.bodyText,
                bodyHtml: message.bodyHtml,
                senderEmail,
                senderDomain,
                senderType,
                isForwarded,
                isImportant,
                inBusinessHours,
                receivedAt: receivedAt.toISOString(),
                _slackUserId: integration.slackUserId
            };

            return {
                message,
                payload,
                receivedAt,
                senderEmail
            };
        });

        const triggerEvents = await Promise.all(
            enrichedMessages.map(({ payload }) => {
                const { normalizedPayload } = buildTriggerPayloadSnapshot(payload);

                return createTriggerEventRecord({
                    triggerId: trigger.id,
                    agentId: integration.agentId,
                    workspaceId: integration.workspaceId,
                    status: TriggerEventStatus.RECEIVED,
                    sourceType: "integration",
                    triggerType: "event",
                    entityType: "agent",
                    integrationKey: "gmail",
                    integrationId: connection?.id || integration.id,
                    eventName: "gmail.message.received",
                    payload: normalizedPayload
                });
            })
        );

        await Promise.all(
            enrichedMessages.map(async ({ message, receivedAt, senderEmail }) => {
                if (!connection) return;
                const direction =
                    senderEmail && senderEmail.toLowerCase() === gmailAddress.toLowerCase()
                        ? "outbound"
                        : "inbound";

                const thread = await prisma.emailThread.upsert({
                    where: {
                        integrationConnectionId_threadId: {
                            integrationConnectionId: connection.id,
                            threadId: message.threadId
                        }
                    },
                    create: {
                        organizationId,
                        workspaceId: integration.workspaceId,
                        integrationConnectionId: connection.id,
                        threadId: message.threadId,
                        subject: message.subject || null,
                        participantsJson: {
                            from: message.parsedFrom,
                            to: message.parsedTo,
                            cc: message.parsedCc
                        },
                        lastMessageAt: receivedAt,
                        lastInboundAt: direction === "inbound" ? receivedAt : null,
                        lastOutboundAt: direction === "outbound" ? receivedAt : null
                    },
                    update: {
                        subject: message.subject || null,
                        lastMessageAt: receivedAt,
                        lastInboundAt: direction === "inbound" ? receivedAt : undefined,
                        lastOutboundAt: direction === "outbound" ? receivedAt : undefined
                    }
                });

                await prisma.emailMessage.upsert({
                    where: {
                        integrationConnectionId_messageId: {
                            integrationConnectionId: connection.id,
                            messageId: message.messageId
                        }
                    },
                    create: {
                        threadId: thread.id,
                        integrationConnectionId: connection.id,
                        messageId: message.messageId,
                        direction,
                        fromAddress: message.from || null,
                        toAddressesJson: message.parsedTo,
                        ccAddressesJson: message.parsedCc,
                        bccAddressesJson: message.parsedBcc,
                        subject: message.subject || null,
                        snippet: message.snippet || null,
                        bodyText: message.bodyText || null,
                        bodyHtml: message.bodyHtml || null,
                        receivedAt,
                        labelsJson: message.labels,
                        hasAttachments: message.hasAttachments,
                        attachmentsJson: message.attachments,
                        metadata: {
                            gmailThreadId: message.threadId,
                            gmailInternalDate: message.internalDate,
                            messageIdHeader: message.messageIdHeader
                        }
                    },
                    update: {}
                });

                await prisma.crmAuditLog.create({
                    data: {
                        organizationId,
                        workspaceId: integration.workspaceId,
                        integrationConnectionId: connection.id,
                        eventType: "gmail.message.ingested",
                        recordType: "email_message",
                        recordId: message.messageId,
                        sourceType: "gmail",
                        sourceId: message.messageId,
                        payloadJson: {
                            threadId: thread.threadId,
                            subject: message.subject,
                            from: message.from,
                            to: message.to,
                            direction
                        }
                    }
                });

                if (senderEmail) {
                    await resolveIdentity({
                        organizationId,
                        email: senderEmail
                    });
                }
            })
        );

        await Promise.all(
            enrichedMessages.map(({ payload }, index) => {
                return inngest.send({
                    name: "agent/trigger.fire",
                    data: {
                        triggerId: trigger.id,
                        agentId: integration.agentId,
                        triggerEventId: triggerEvents[index]?.id,
                        payload
                    }
                });
            })
        );

        await prisma.gmailIntegration.update({
            where: { id: integration.id },
            data: { historyId }
        });

        return NextResponse.json({
            success: true,
            processed: messages.length
        });
    } catch (error) {
        console.error("[Gmail Webhook] Error:", error);

        // If Gmail API quota is exceeded, return 200 so Pub/Sub acknowledges
        // the message and stops retrying. This prevents a cascade where backlogged
        // notifications keep hammering the quota and never drain.
        const isQuotaError =
            error instanceof Error &&
            (error.message.includes("Quota exceeded") ||
                error.message.includes("Rate Limit Exceeded"));
        if (isQuotaError) {
            console.warn("[Gmail Webhook] Quota exceeded — acknowledging to drain backlog");
            return NextResponse.json({
                success: false,
                error: "Quota exceeded, message acknowledged to prevent retry storm",
                retryable: false
            });
        }

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to process Gmail webhook"
            },
            { status: 500 }
        );
    }
}
