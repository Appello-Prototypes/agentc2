/**
 * Google Calendar Search Events Tool
 *
 * Searches Google Calendar events within a time range by text query.
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
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    attendees?: Array<{ email?: string; displayName?: string; responseStatus?: string }>;
    htmlLink?: string;
    status?: string;
    organizer?: { email?: string; displayName?: string };
};

type CalendarListResponse = {
    items?: CalendarEvent[];
    nextPageToken?: string;
};

export const googleCalendarSearchEventsTool = createTool({
    id: "google-calendar-search-events",
    description:
        "Search Google Calendar events by text query within a time range. Returns matching events with attendees, times, and locations. Useful for checking upcoming meetings with a company or person.",
    inputSchema: z.object({
        query: z
            .string()
            .describe(
                "Text to search for in event summaries, descriptions, locations, and attendees"
            ),
        timeMin: z
            .string()
            .describe("Start of time range in ISO 8601 format (e.g., '2026-02-12T00:00:00Z')"),
        timeMax: z
            .string()
            .describe("End of time range in ISO 8601 format (e.g., '2026-02-19T00:00:00Z')"),
        calendarId: z
            .string()
            .default("primary")
            .describe("Calendar ID to search (defaults to 'primary')"),
        maxResults: z
            .number()
            .min(1)
            .max(20)
            .default(10)
            .describe("Maximum number of results (1-20, default 10)"),
        gmailAddress: z
            .string()
            .default("")
            .describe("Google account email. Leave empty to auto-detect from connected account.")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        events: z.array(
            z.object({
                id: z.string(),
                summary: z.string(),
                start: z.string(),
                end: z.string(),
                location: z.string(),
                attendees: z.array(
                    z.object({
                        email: z.string(),
                        name: z.string(),
                        status: z.string()
                    })
                ),
                link: z.string()
            })
        ),
        error: z.string().optional()
    }),
    execute: async ({ query, timeMin, timeMax, calendarId, maxResults, gmailAddress }) => {
        const address = await resolveGmailAddress(gmailAddress);
        const calendar = calendarId || "primary";
        try {
            // Pre-flight scope check: verify calendar.readonly was granted
            const scopeCheck = await checkGoogleScopes(address, CALENDAR_READ_SCOPES);
            if (!scopeCheck.ok) {
                return {
                    success: false,
                    events: [],
                    error:
                        `Google Calendar requires scope: ${scopeCheck.missing.join(", ")}. ` +
                        `Re-authorize Google OAuth to grant calendar access.`
                };
            }

            const response = await callCalendarApi(
                address,
                `/calendars/${encodeURIComponent(calendar)}/events`,
                {
                    q: query,
                    timeMin: timeMin.includes("T") ? timeMin : `${timeMin}T00:00:00Z`,
                    timeMax: timeMax.includes("T") ? timeMax : `${timeMax}T23:59:59Z`,
                    maxResults: String(maxResults || 10),
                    singleEvents: "true",
                    orderBy: "startTime"
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                // Provide clear message if scope is missing
                if (response.status === 403 || response.status === 401) {
                    return {
                        success: false,
                        events: [],
                        error: `Calendar access denied (${response.status}). The Google OAuth token may need calendar scopes. Re-authorize at /api/integrations/gmail/sync. Details: ${errorText}`
                    };
                }
                return {
                    success: false,
                    events: [],
                    error: `Calendar API error (${response.status}): ${errorText}`
                };
            }

            const data = (await response.json()) as CalendarListResponse;
            const events = (data.items || []).map((event) => ({
                id: event.id || "",
                summary: event.summary || "(no title)",
                start: event.start?.dateTime || event.start?.date || "",
                end: event.end?.dateTime || event.end?.date || "",
                location: event.location || "",
                attendees: (event.attendees || []).map((a) => ({
                    email: a.email || "",
                    name: a.displayName || "",
                    status: a.responseStatus || "needsAction"
                })),
                link: event.htmlLink || ""
            }));

            return {
                success: true,
                events
            };
        } catch (error) {
            return {
                success: false,
                events: [],
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }
});
