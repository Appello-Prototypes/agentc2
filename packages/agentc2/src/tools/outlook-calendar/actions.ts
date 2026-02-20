/**
 * Outlook Calendar Action Tools
 *
 * Mastra tools for listing, reading, creating, and updating
 * Outlook calendar events via Microsoft Graph.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

// ── Shared Graph helper (same pattern as outlook-mail) ─────────────

async function callGraph(params: {
    connectionId: string;
    path: string;
    method?: string;
    body?: unknown;
}) {
    const { prisma } = await import("@repo/database");
    const { createDecipheriv } = await import("crypto");

    const connection = await prisma.integrationConnection.findUnique({
        where: { id: params.connectionId }
    });

    if (!connection || !connection.isActive) {
        throw new Error("Microsoft connection not found or inactive");
    }

    let creds: Record<string, unknown> = {};
    if (connection.credentials && typeof connection.credentials === "object") {
        const value = connection.credentials as Record<string, unknown>;
        if (value.__enc === "v1") {
            const key = process.env.CREDENTIAL_ENCRYPTION_KEY;
            if (key) {
                const buf = Buffer.from(key, "hex");
                if (buf.length === 32) {
                    const iv = Buffer.from(value.iv as string, "base64");
                    const tag = Buffer.from(value.tag as string, "base64");
                    const encrypted = Buffer.from(value.data as string, "base64");
                    const decipher = createDecipheriv("aes-256-gcm", buf, iv);
                    decipher.setAuthTag(tag);
                    const decrypted = Buffer.concat([
                        decipher.update(encrypted),
                        decipher.final()
                    ]).toString("utf8");
                    try {
                        creds = JSON.parse(decrypted);
                    } catch {
                        /* empty */
                    }
                }
            }
        } else {
            creds = value;
        }
    }

    const accessToken = creds.accessToken as string;
    if (!accessToken) {
        throw new Error("No access token found for Microsoft connection");
    }

    const url = params.path.startsWith("http") ? params.path : `${GRAPH_BASE}${params.path}`;

    const response = await fetch(url, {
        method: params.method || "GET",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        },
        body: params.body ? JSON.stringify(params.body) : undefined
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`Graph API error (${response.status}): ${errorText}`);
    }

    if (response.status === 204) return {};
    return response.json();
}

// ── Tools ──────────────────────────────────────────────────────────

export const outlookCalendarListEventsTool = createTool({
    id: "outlook-calendar-list-events",
    description:
        "List upcoming calendar events from Outlook. Returns subject, start/end times, location, and attendees.",
    inputSchema: z.object({
        connectionId: z.string().describe("Microsoft IntegrationConnection ID"),
        top: z.number().optional().default(10).describe("Number of events to return (max 50)"),
        startDateTime: z
            .string()
            .optional()
            .describe("Start of time range (ISO 8601). Defaults to now."),
        endDateTime: z
            .string()
            .optional()
            .describe("End of time range (ISO 8601). Defaults to 30 days from now.")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        events: z.array(z.record(z.unknown())),
        error: z.string().optional()
    }),
    execute: async ({ connectionId, top, startDateTime, endDateTime }) => {
        try {
            const now = new Date();
            const startDt = startDateTime || now.toISOString();
            const endDt =
                endDateTime || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

            const result = (await callGraph({
                connectionId,
                path: `/me/calendarView?startDateTime=${encodeURIComponent(startDt)}&endDateTime=${encodeURIComponent(endDt)}&$top=${Math.min(top || 10, 50)}&$orderby=start/dateTime&$select=id,subject,bodyPreview,start,end,isAllDay,location,organizer,attendees,webLink`
            })) as { value?: unknown[] };

            return {
                success: true,
                events: (result.value as Record<string, unknown>[]) || []
            };
        } catch (error) {
            return {
                success: false,
                events: [],
                error: error instanceof Error ? error.message : "Failed to list events"
            };
        }
    }
});

export const outlookCalendarGetEventTool = createTool({
    id: "outlook-calendar-get-event",
    description: "Get a specific Outlook calendar event by ID.",
    inputSchema: z.object({
        connectionId: z.string().describe("Microsoft IntegrationConnection ID"),
        eventId: z.string().describe("The Outlook event ID")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        event: z.record(z.unknown()).optional(),
        error: z.string().optional()
    }),
    execute: async ({ connectionId, eventId }) => {
        try {
            const result = await callGraph({
                connectionId,
                path: `/me/events/${eventId}?$select=id,subject,body,bodyPreview,start,end,isAllDay,location,organizer,attendees,recurrence,sensitivity,webLink`
            });
            return { success: true, event: result as Record<string, unknown> };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get event"
            };
        }
    }
});

export const outlookCalendarCreateEventTool = createTool({
    id: "outlook-calendar-create-event",
    description:
        "Create a new calendar event in Outlook. Supports subject, start/end times, location, body, and attendees.",
    inputSchema: z.object({
        connectionId: z.string().describe("Microsoft IntegrationConnection ID"),
        subject: z.string().describe("Event subject/title"),
        startDateTime: z.string().describe("Start date-time in ISO 8601 format"),
        startTimeZone: z.string().optional().default("UTC").describe("Time zone for start"),
        endDateTime: z.string().describe("End date-time in ISO 8601 format"),
        endTimeZone: z.string().optional().default("UTC").describe("Time zone for end"),
        body: z.string().optional().describe("Event body/description"),
        location: z.string().optional().describe("Event location"),
        attendees: z.array(z.string().email()).optional().describe("Attendee email addresses"),
        isAllDay: z.boolean().optional().default(false).describe("Whether this is an all-day event")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        event: z.record(z.unknown()).optional(),
        error: z.string().optional()
    }),
    execute: async ({
        connectionId,
        subject,
        startDateTime,
        startTimeZone,
        endDateTime,
        endTimeZone,
        body,
        location,
        attendees,
        isAllDay
    }) => {
        try {
            const result = await callGraph({
                connectionId,
                path: "/me/events",
                method: "POST",
                body: {
                    subject,
                    start: { dateTime: startDateTime, timeZone: startTimeZone || "UTC" },
                    end: { dateTime: endDateTime, timeZone: endTimeZone || "UTC" },
                    isAllDay: isAllDay || false,
                    ...(body ? { body: { contentType: "Text", content: body } } : {}),
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
            return { success: true, event: result as Record<string, unknown> };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Failed to create event"
            };
        }
    }
});

export const outlookCalendarUpdateEventTool = createTool({
    id: "outlook-calendar-update-event",
    description: "Update an existing Outlook calendar event.",
    inputSchema: z.object({
        connectionId: z.string().describe("Microsoft IntegrationConnection ID"),
        eventId: z.string().describe("The Outlook event ID to update"),
        subject: z.string().optional().describe("New subject"),
        startDateTime: z.string().optional().describe("New start date-time (ISO 8601)"),
        startTimeZone: z.string().optional().describe("Time zone for start"),
        endDateTime: z.string().optional().describe("New end date-time (ISO 8601)"),
        endTimeZone: z.string().optional().describe("Time zone for end"),
        body: z.string().optional().describe("New body/description"),
        location: z.string().optional().describe("New location")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        event: z.record(z.unknown()).optional(),
        error: z.string().optional()
    }),
    execute: async ({
        connectionId,
        eventId,
        subject,
        startDateTime,
        startTimeZone,
        endDateTime,
        endTimeZone,
        body,
        location
    }) => {
        try {
            const patchBody: Record<string, unknown> = {};
            if (subject !== undefined) patchBody.subject = subject;
            if (body !== undefined) patchBody.body = { contentType: "Text", content: body };
            if (startDateTime !== undefined)
                patchBody.start = {
                    dateTime: startDateTime,
                    timeZone: startTimeZone || "UTC"
                };
            if (endDateTime !== undefined)
                patchBody.end = {
                    dateTime: endDateTime,
                    timeZone: endTimeZone || "UTC"
                };
            if (location !== undefined) patchBody.location = { displayName: location };

            const result = await callGraph({
                connectionId,
                path: `/me/events/${eventId}`,
                method: "PATCH",
                body: patchBody
            });
            return { success: true, event: result as Record<string, unknown> };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Failed to update event"
            };
        }
    }
});
