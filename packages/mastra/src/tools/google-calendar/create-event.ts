/**
 * Google Calendar Create Event Tool
 *
 * Creates a new Google Calendar event. Includes a confirmCreate safeguard —
 * when confirmCreate is false (default), returns a preview instead of creating.
 * The agent must show the preview and get explicit user approval before
 * calling again with confirmCreate=true.
 *
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

export const googleCalendarCreateEventTool = createTool({
    id: "google-calendar-create-event",
    description:
        "Create a new Google Calendar event. IMPORTANT: You MUST show the user a preview of the event details and get their explicit confirmation BEFORE calling with confirmCreate=true. When confirmCreate is false (default), returns a preview without creating.",
    inputSchema: z.object({
        summary: z.string().describe("Event title"),
        startDateTime: z
            .string()
            .describe("Start date/time in ISO 8601 format (e.g., '2026-02-14T10:00:00')"),
        endDateTime: z
            .string()
            .describe("End date/time in ISO 8601 format (e.g., '2026-02-14T11:00:00')"),
        description: z.string().optional().describe("Event description or notes"),
        location: z.string().optional().describe("Event location"),
        attendees: z.string().optional().describe("Comma-separated email addresses of attendees"),
        timeZone: z
            .string()
            .default("America/Toronto")
            .describe("IANA timezone (defaults to America/Toronto)"),
        calendarId: z.string().default("primary").describe("Calendar ID (defaults to 'primary')"),
        confirmCreate: z
            .boolean()
            .default(false)
            .describe(
                "Set to true only AFTER showing the user a preview and getting their explicit approval. When false, returns a preview instead of creating."
            ),
        gmailAddress: z
            .string()
            .default("")
            .describe("Google account email. Leave empty to auto-detect from connected account.")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        preview: z.boolean().optional(),
        eventId: z.string().optional(),
        link: z.string().optional(),
        summary: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
        attendees: z.string().optional(),
        error: z.string().optional()
    }),
    execute: async ({
        summary,
        startDateTime,
        endDateTime,
        description,
        location,
        attendees,
        timeZone,
        calendarId,
        confirmCreate,
        gmailAddress
    }) => {
        const address = await resolveGmailAddress(gmailAddress);
        const calendar = calendarId || "primary";
        try {
            // If confirmCreate is false, return a preview
            if (!confirmCreate) {
                return {
                    success: true,
                    preview: true,
                    summary,
                    start: startDateTime,
                    end: endDateTime,
                    attendees: attendees || ""
                };
            }

            const scopeCheck = await checkGoogleScopes(address, CALENDAR_WRITE_SCOPES);
            if (!scopeCheck.ok) {
                return {
                    success: false,
                    error: `Google Calendar create requires scope: ${scopeCheck.missing.join(", ")}. Re-authorize Google OAuth to grant calendar write access.`
                };
            }

            // Build event body
            const eventBody: Record<string, unknown> = {
                summary,
                start: { dateTime: startDateTime, timeZone },
                end: { dateTime: endDateTime, timeZone }
            };
            if (description) eventBody.description = description;
            if (location) eventBody.location = location;
            if (attendees) {
                eventBody.attendees = attendees
                    .split(",")
                    .map((e) => e.trim())
                    .filter(Boolean)
                    .map((email) => ({ email }));
            }

            const response = await callCalendarApiWithBody(
                address,
                `/calendars/${encodeURIComponent(calendar)}/events`,
                {
                    method: "POST",
                    body: eventBody,
                    params: { sendUpdates: "all" }
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                return {
                    success: false,
                    error: `Calendar create failed (${response.status}): ${errorText}`
                };
            }

            const data = (await response.json()) as CalendarEventResponse;
            return {
                success: true,
                preview: false,
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
