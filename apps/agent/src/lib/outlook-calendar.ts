/**
 * Outlook Calendar Library
 *
 * Graph Calendar API helpers for listing, reading, creating, and
 * updating calendar events via Microsoft Graph. Also handles webhook
 * subscription creation and renewal for push notifications.
 */

import { callGraphApi } from "./microsoft-oauth";
import { prisma } from "@repo/database";
import { randomBytes } from "crypto";

// ── Types ──────────────────────────────────────────────────────────

export type OutlookCalendarEvent = {
    id: string;
    subject: string | null;
    bodyPreview?: string;
    body?: { contentType: string; content: string };
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
    isAllDay: boolean;
    location?: { displayName?: string };
    organizer?: { emailAddress: { name?: string; address: string } };
    attendees?: Array<{
        emailAddress: { name?: string; address: string };
        status?: { response: string };
        type: string;
    }>;
    recurrence?: unknown;
    showAs?: string;
    sensitivity?: string;
    webLink?: string;
    createdDateTime?: string;
    lastModifiedDateTime?: string;
};

type GraphEventList = {
    value: OutlookCalendarEvent[];
    "@odata.nextLink"?: string;
};

// ── Calendar Operations ────────────────────────────────────────────

/**
 * List upcoming calendar events.
 */
export async function listEvents(
    connectionId: string,
    options?: {
        top?: number;
        startDateTime?: string;
        endDateTime?: string;
    }
): Promise<OutlookCalendarEvent[]> {
    const top = options?.top || 25;
    const now = new Date();
    const startDt = options?.startDateTime || now.toISOString();
    const endDt =
        options?.endDateTime || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const result = await callGraphApi<GraphEventList>({
        connectionId,
        path: `/me/calendarView?startDateTime=${encodeURIComponent(startDt)}&endDateTime=${encodeURIComponent(endDt)}&$top=${top}&$orderby=start/dateTime&$select=id,subject,bodyPreview,start,end,isAllDay,location,organizer,attendees,recurrence,showAs,sensitivity,webLink,createdDateTime,lastModifiedDateTime`
    });

    return result.value || [];
}

/**
 * Get a single event by ID.
 */
export async function getEvent(
    connectionId: string,
    eventId: string
): Promise<OutlookCalendarEvent> {
    return callGraphApi<OutlookCalendarEvent>({
        connectionId,
        path: `/me/events/${eventId}?$select=id,subject,bodyPreview,body,start,end,isAllDay,location,organizer,attendees,recurrence,showAs,sensitivity,webLink,createdDateTime,lastModifiedDateTime`
    });
}

/**
 * Create a calendar event.
 */
export async function createEvent(
    connectionId: string,
    params: {
        subject: string;
        body?: string;
        contentType?: "Text" | "HTML";
        start: { dateTime: string; timeZone: string };
        end: { dateTime: string; timeZone: string };
        isAllDay?: boolean;
        location?: string;
        attendees?: string[];
    }
): Promise<OutlookCalendarEvent> {
    const {
        subject,
        body,
        contentType = "Text",
        start,
        end,
        isAllDay = false,
        location,
        attendees
    } = params;

    return callGraphApi<OutlookCalendarEvent>({
        connectionId,
        path: "/me/events",
        method: "POST",
        body: {
            subject,
            ...(body ? { body: { contentType, content: body } } : {}),
            start,
            end,
            isAllDay,
            ...(location ? { location: { displayName: location } } : {}),
            ...(attendees && attendees.length > 0
                ? {
                      attendees: attendees.map((email) => ({
                          emailAddress: { address: email },
                          type: "required"
                      }))
                  }
                : {})
        }
    });
}

/**
 * Update a calendar event.
 */
export async function updateEvent(
    connectionId: string,
    eventId: string,
    params: {
        subject?: string;
        body?: string;
        contentType?: "Text" | "HTML";
        start?: { dateTime: string; timeZone: string };
        end?: { dateTime: string; timeZone: string };
        location?: string;
    }
): Promise<OutlookCalendarEvent> {
    const { subject, body, contentType = "Text", start, end, location } = params;

    const patchBody: Record<string, unknown> = {};
    if (subject !== undefined) patchBody.subject = subject;
    if (body !== undefined) patchBody.body = { contentType, content: body };
    if (start !== undefined) patchBody.start = start;
    if (end !== undefined) patchBody.end = end;
    if (location !== undefined) patchBody.location = { displayName: location };

    return callGraphApi<OutlookCalendarEvent>({
        connectionId,
        path: `/me/events/${eventId}`,
        method: "PATCH",
        body: patchBody
    });
}

// ── Webhook Subscription Management ────────────────────────────────

const CALENDAR_RESOURCE = "/me/events";
const SUBSCRIPTION_MAX_MINUTES = 4230; // ~3 days

function getCalendarWebhookUrl(): string {
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    const isProduction = process.env.NODE_ENV === "production";
    const prefix = isProduction ? "/agent" : "";
    return `${base}${prefix}/api/microsoft/webhook`;
}

/**
 * Create a Graph calendar subscription for push notifications.
 */
export async function createCalendarSubscription(
    connectionId: string
): Promise<{ subscriptionId: string; expiresAt: Date }> {
    const clientState = randomBytes(32).toString("hex");
    const expirationDateTime = new Date(
        Date.now() + SUBSCRIPTION_MAX_MINUTES * 60 * 1000
    ).toISOString();

    const notificationUrl = getCalendarWebhookUrl();

    const result = await callGraphApi<{
        id: string;
        expirationDateTime: string;
    }>({
        connectionId,
        path: "/subscriptions",
        method: "POST",
        body: {
            changeType: "created,updated",
            notificationUrl,
            resource: CALENDAR_RESOURCE,
            expirationDateTime,
            clientState
        }
    });

    await prisma.webhookSubscription.upsert({
        where: {
            integrationConnectionId_providerKey_resourcePath: {
                integrationConnectionId: connectionId,
                providerKey: "microsoft-calendar",
                resourcePath: CALENDAR_RESOURCE
            }
        },
        create: {
            integrationConnectionId: connectionId,
            providerKey: "microsoft-calendar",
            externalSubscriptionId: result.id,
            resourcePath: CALENDAR_RESOURCE,
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
 * Renew an existing Graph calendar subscription.
 */
export async function renewCalendarSubscription(
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
            providerKey: "microsoft-calendar",
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

/**
 * Parse a Graph event into a normalized trigger payload.
 */
export function parseEventToPayload(
    event: OutlookCalendarEvent,
    connectionId: string,
    changeType: "created" | "updated"
) {
    return {
        integrationConnectionId: connectionId,
        changeType,
        eventId: event.id,
        subject: event.subject || "",
        startAt: event.start?.dateTime,
        startTimeZone: event.start?.timeZone,
        endAt: event.end?.dateTime,
        endTimeZone: event.end?.timeZone,
        isAllDay: event.isAllDay,
        location: event.location?.displayName || null,
        organizerEmail: event.organizer?.emailAddress?.address || null,
        attendees: (event.attendees || []).map((a) => ({
            email: a.emailAddress.address,
            name: a.emailAddress.name,
            status: a.status?.response
        })),
        sensitivity: event.sensitivity || "normal",
        webLink: event.webLink || null
    };
}
