/**
 * Outlook Mail Library
 *
 * Graph Mail API helpers for listing, reading, sending, and archiving
 * emails via Microsoft Graph. Also handles webhook subscription
 * creation and renewal for push notifications.
 */

import { callGraphApi } from "./microsoft-oauth";
import { prisma } from "@repo/database";
import { randomBytes } from "crypto";

// ── Types ──────────────────────────────────────────────────────────

export type OutlookMessage = {
    id: string;
    subject: string | null;
    bodyPreview: string;
    body?: { contentType: string; content: string };
    from?: { emailAddress: { name?: string; address: string } };
    toRecipients?: Array<{ emailAddress: { name?: string; address: string } }>;
    ccRecipients?: Array<{ emailAddress: { name?: string; address: string } }>;
    receivedDateTime: string;
    sentDateTime?: string;
    isRead: boolean;
    hasAttachments: boolean;
    conversationId: string;
    internetMessageId?: string;
    parentFolderId?: string;
    webLink?: string;
};

type GraphMessageList = {
    value: OutlookMessage[];
    "@odata.nextLink"?: string;
};

// ── Mail Operations ────────────────────────────────────────────────

/**
 * List recent messages from the inbox.
 */
export async function listInboxMessages(
    connectionId: string,
    options?: { top?: number; skip?: number; filter?: string }
): Promise<OutlookMessage[]> {
    const top = options?.top || 25;
    const skip = options?.skip || 0;
    const filterParam = options?.filter ? `&$filter=${encodeURIComponent(options.filter)}` : "";

    const result = await callGraphApi<GraphMessageList>({
        connectionId,
        path: `/me/mailFolders/Inbox/messages?$top=${top}&$skip=${skip}&$orderby=receivedDateTime desc&$select=id,subject,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,isRead,hasAttachments,conversationId,internetMessageId,parentFolderId,webLink${filterParam}`
    });

    return result.value || [];
}

/**
 * Get a single message by ID.
 */
export async function getMessage(connectionId: string, messageId: string): Promise<OutlookMessage> {
    return callGraphApi<OutlookMessage>({
        connectionId,
        path: `/me/messages/${messageId}?$select=id,subject,bodyPreview,body,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,isRead,hasAttachments,conversationId,internetMessageId,parentFolderId,webLink`
    });
}

/**
 * Send an email.
 */
export async function sendMessage(
    connectionId: string,
    params: {
        to: string[];
        cc?: string[];
        subject: string;
        body: string;
        contentType?: "Text" | "HTML";
    }
): Promise<void> {
    const { to, cc, subject, body, contentType = "Text" } = params;

    await callGraphApi({
        connectionId,
        path: "/me/sendMail",
        method: "POST",
        body: {
            message: {
                subject,
                body: { contentType, content: body },
                toRecipients: to.map((addr) => ({
                    emailAddress: { address: addr }
                })),
                ...(cc && cc.length > 0
                    ? {
                          ccRecipients: cc.map((addr) => ({
                              emailAddress: { address: addr }
                          }))
                      }
                    : {})
            }
        }
    });
}

/**
 * Archive a message by moving it to the Archive folder.
 */
export async function archiveMessage(connectionId: string, messageId: string): Promise<void> {
    // Graph uses the well-known folder name "archive"
    await callGraphApi({
        connectionId,
        path: `/me/messages/${messageId}/move`,
        method: "POST",
        body: { destinationId: "archive" }
    });
}

// ── Webhook Subscription Management ────────────────────────────────

const MAIL_RESOURCE = "/me/mailFolders('Inbox')/messages";
const SUBSCRIPTION_MAX_MINUTES = 4230; // ~3 days

/**
 * Get the webhook notification URL for mail.
 */
function getMailWebhookUrl(): string {
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    const isProduction = process.env.NODE_ENV === "production";
    const prefix = isProduction ? "/agent" : "";
    return `${base}${prefix}/api/microsoft/webhook`;
}

/**
 * Create a Graph mail subscription for push notifications.
 */
export async function createMailSubscription(
    connectionId: string
): Promise<{ subscriptionId: string; expiresAt: Date }> {
    const clientState = randomBytes(32).toString("hex");
    const expirationDateTime = new Date(
        Date.now() + SUBSCRIPTION_MAX_MINUTES * 60 * 1000
    ).toISOString();

    const notificationUrl = getMailWebhookUrl();

    const result = await callGraphApi<{
        id: string;
        expirationDateTime: string;
    }>({
        connectionId,
        path: "/subscriptions",
        method: "POST",
        body: {
            changeType: "created",
            notificationUrl,
            resource: MAIL_RESOURCE,
            expirationDateTime,
            clientState
        }
    });

    // Store subscription in database
    await prisma.webhookSubscription.upsert({
        where: {
            integrationConnectionId_providerKey_resourcePath: {
                integrationConnectionId: connectionId,
                providerKey: "microsoft-mail",
                resourcePath: MAIL_RESOURCE
            }
        },
        create: {
            integrationConnectionId: connectionId,
            providerKey: "microsoft-mail",
            externalSubscriptionId: result.id,
            resourcePath: MAIL_RESOURCE,
            clientState,
            notificationUrl,
            expiresAt: new Date(result.expirationDateTime),
            lastRenewedAt: new Date(),
            isActive: true
        },
        update: {
            externalSubscriptionId: result.id,
            clientState,
            notificationUrl,
            expiresAt: new Date(result.expirationDateTime),
            lastRenewedAt: new Date(),
            errorCount: 0,
            errorMessage: null,
            isActive: true
        }
    });

    return {
        subscriptionId: result.id,
        expiresAt: new Date(result.expirationDateTime)
    };
}

/**
 * Renew an existing Graph mail subscription.
 */
export async function renewMailSubscription(
    connectionId: string,
    subscriptionId: string
): Promise<Date> {
    const expirationDateTime = new Date(
        Date.now() + SUBSCRIPTION_MAX_MINUTES * 60 * 1000
    ).toISOString();

    const result = await callGraphApi<{ expirationDateTime: string }>({
        connectionId,
        path: `/subscriptions/${subscriptionId}`,
        method: "PATCH",
        body: { expirationDateTime }
    });

    const newExpiry = new Date(result.expirationDateTime);

    await prisma.webhookSubscription.updateMany({
        where: {
            integrationConnectionId: connectionId,
            providerKey: "microsoft-mail",
            externalSubscriptionId: subscriptionId
        },
        data: {
            expiresAt: newExpiry,
            lastRenewedAt: new Date(),
            errorCount: 0,
            errorMessage: null
        }
    });

    return newExpiry;
}

// ── Message Parsing Helpers ────────────────────────────────────────

/**
 * Parse an Outlook message into a normalized trigger payload.
 */
export function parseMessageToPayload(message: OutlookMessage, connectionId: string) {
    const fromEmail = message.from?.emailAddress?.address || "";
    const toEmails = (message.toRecipients || []).map((r) => r.emailAddress.address);
    const ccEmails = (message.ccRecipients || []).map((r) => r.emailAddress.address);

    return {
        integrationConnectionId: connectionId,
        messageId: message.id,
        conversationId: message.conversationId,
        from: fromEmail,
        to: toEmails,
        cc: ccEmails,
        subject: message.subject || "",
        snippet: message.bodyPreview || "",
        receivedAt: message.receivedDateTime,
        isRead: message.isRead,
        hasAttachments: message.hasAttachments,
        webLink: message.webLink || null
    };
}
