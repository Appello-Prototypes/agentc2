/**
 * Google Calendar Update Event Tool
 *
 * Updates an existing Google Calendar event (PATCH).
 * Requires the calendar.events scope.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
    callCalendarApiWithBody,
    checkGoogleScopes,
    CALENDAR_WRITE_SCOPES,
    resolveGmailAddress
} from "./shared";

type CalendarEventResponse = {
    id?: string;
    summary?: string;
    htmlLink?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    status?: string;
};

export const googleCalendarUpdateEventTool = createTool({
    id: "google-calendar-update-event",
    description:
        "Update an existing Google Calendar event. Only provide the fields you want to change — unspecified fields are left untouched. Use get-event first to confirm the current state.",
    inputSchema: z.object({
        eventId: z.string().describe("The Google Calendar event ID to update"),
        summary: z.string().optional().describe("New event title"),
        startDateTime: z.string().optional().describe("New start date/time in ISO 8601 format"),
        endDateTime: z.string().optional().describe("New end date/time in ISO 8601 format"),
        description: z.string().optional().describe("New event description"),
        location: z.string().optional().describe("New event location"),
        attendees: z
            .string()
            .optional()
            .describe("Comma-separated email addresses (replaces existing attendees)"),
        timeZone: z
            .string()
            .default("America/Toronto")
            .describe("IANA timezone (defaults to America/Toronto)"),
        calendarId: z.string().default("primary").describe("Calendar ID (defaults to 'primary')"),
        gmailAddress: z
            .string()
            .default("")
            .describe("Google account email. Leave empty to auto-detect from connected account.")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        eventId: z.string().optional(),
        link: z.string().optional(),
        summary: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
        error: z.string().optional()
    }),
    execute: async ({
        eventId,
        summary,
        startDateTime,
        endDateTime,
        description,
        location,
        attendees,
        timeZone,
        calendarId,
        gmailAddress
    }) => {
        const address = await resolveGmailAddress(gmailAddress);
        const calendar = calendarId || "primary";
        try {
            const scopeCheck = await checkGoogleScopes(address, CALENDAR_WRITE_SCOPES);
            if (!scopeCheck.ok) {
                return {
                    success: false,
                    error: `Google Calendar update requires scope: ${scopeCheck.missing.join(", ")}. Re-authorize Google OAuth to grant calendar write access.`
                };
            }

            // Build PATCH body with only provided fields
            const patchBody: Record<string, unknown> = {};
            if (summary !== undefined) patchBody.summary = summary;
            if (description !== undefined) patchBody.description = description;
            if (location !== undefined) patchBody.location = location;
            if (startDateTime) {
                patchBody.start = { dateTime: startDateTime, timeZone };
            }
            if (endDateTime) {
                patchBody.end = { dateTime: endDateTime, timeZone };
            }
            if (attendees !== undefined) {
                patchBody.attendees = attendees
                    .split(",")
                    .map((e) => e.trim())
                    .filter(Boolean)
                    .map((email) => ({ email }));
            }

            const response = await callCalendarApiWithBody(
                address,
                `/calendars/${encodeURIComponent(calendar)}/events/${encodeURIComponent(eventId)}`,
                {
                    method: "PATCH",
                    body: patchBody,
                    params: { sendUpdates: "all" }
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                return {
                    success: false,
                    error: `Calendar update failed (${response.status}): ${errorText}`
                };
            }

            const data = (await response.json()) as CalendarEventResponse;
            return {
                success: true,
                eventId: data.id || "",
                link: data.htmlLink || "",
                summary: data.summary || "",
                start: data.start?.dateTime || data.start?.date || "",
                end: data.end?.dateTime || data.end?.date || ""
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }
});
