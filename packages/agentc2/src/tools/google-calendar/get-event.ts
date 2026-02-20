/**
 * Google Calendar Get Event Tool
 *
 * Gets the details of a specific Google Calendar event by ID.
 * Uses the same Google OAuth credentials as Gmail (requires calendar scope).
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
    callCalendarApi,
    checkGoogleScopes,
    CALENDAR_READ_SCOPES,
    resolveGmailAddress
} from "./shared";

type CalendarEvent = {
    id?: string;
    summary?: string;
    description?: string;
    location?: string;
    start?: { dateTime?: string; date?: string; timeZone?: string };
    end?: { dateTime?: string; date?: string; timeZone?: string };
    attendees?: Array<{
        email?: string;
        displayName?: string;
        responseStatus?: string;
        organizer?: boolean;
    }>;
    htmlLink?: string;
    status?: string;
    organizer?: { email?: string; displayName?: string; self?: boolean };
    creator?: { email?: string; displayName?: string };
    created?: string;
    updated?: string;
    recurrence?: string[];
    conferenceData?: {
        entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
    };
};

export const googleCalendarGetEventTool = createTool({
    id: "google-calendar-get-event",
    description:
        "Get the full details of a specific Google Calendar event by its event ID. Returns attendees, description, conference links, recurrence, and more.",
    inputSchema: z.object({
        eventId: z.string().describe("The Google Calendar event ID"),
        calendarId: z.string().default("primary").describe("Calendar ID (defaults to 'primary')"),
        gmailAddress: z
            .string()
            .default("")
            .describe("Google account email. Leave empty to auto-detect from connected account.")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        event: z
            .object({
                id: z.string(),
                summary: z.string(),
                description: z.string(),
                start: z.string(),
                end: z.string(),
                location: z.string(),
                status: z.string(),
                organizer: z.string(),
                attendees: z.array(
                    z.object({
                        email: z.string(),
                        name: z.string(),
                        status: z.string()
                    })
                ),
                link: z.string(),
                conferenceLink: z.string(),
                created: z.string(),
                updated: z.string()
            })
            .optional(),
        error: z.string().optional()
    }),
    execute: async ({ eventId, calendarId, gmailAddress }) => {
        const address = await resolveGmailAddress(gmailAddress);
        const calendar = calendarId || "primary";
        try {
            const scopeCheck = await checkGoogleScopes(address, CALENDAR_READ_SCOPES);
            if (!scopeCheck.ok) {
                return {
                    success: false,
                    error: `Google Calendar requires scope: ${scopeCheck.missing.join(", ")}. Re-authorize Google OAuth to grant calendar access.`
                };
            }

            const response = await callCalendarApi(
                address,
                `/calendars/${encodeURIComponent(calendar)}/events/${encodeURIComponent(eventId)}`
            );

            if (!response.ok) {
                const errorText = await response.text();
                return {
                    success: false,
                    error: `Calendar API error (${response.status}): ${errorText}`
                };
            }

            const data = (await response.json()) as CalendarEvent;

            // Extract conference link (Google Meet, Zoom, etc.)
            const conferenceLink =
                data.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === "video")
                    ?.uri || "";

            return {
                success: true,
                event: {
                    id: data.id || "",
                    summary: data.summary || "(no title)",
                    description: data.description || "",
                    start: data.start?.dateTime || data.start?.date || "",
                    end: data.end?.dateTime || data.end?.date || "",
                    location: data.location || "",
                    status: data.status || "",
                    organizer: data.organizer?.email || data.organizer?.displayName || "",
                    attendees: (data.attendees || []).map((a) => ({
                        email: a.email || "",
                        name: a.displayName || "",
                        status: a.responseStatus || "needsAction"
                    })),
                    link: data.htmlLink || "",
                    conferenceLink,
                    created: data.created || "",
                    updated: data.updated || ""
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }
});
