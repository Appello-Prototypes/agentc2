/**
 * Google Calendar Delete Event Tool
 *
 * Deletes a Google Calendar event. Includes a confirmDelete safeguard —
 * when confirmDelete is false (default), fetches and returns event details
 * as a preview. The agent must show the preview and get explicit user
 * approval before calling again with confirmDelete=true.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
    callCalendarApi,
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
    description?: string;
    location?: string;
    attendees?: Array<{ email?: string; displayName?: string }>;
};

export const googleCalendarDeleteEventTool = createTool({
    id: "google-calendar-delete-event",
    description:
        "Delete a Google Calendar event. IMPORTANT: You MUST show the user the event details and get their explicit confirmation BEFORE calling this tool with confirmDelete=true. When confirmDelete is false (default), returns a preview of the event without deleting it.",
    inputSchema: z.object({
        eventId: z.string().describe("The Google Calendar event ID to delete"),
        calendarId: z.string().default("primary").describe("Calendar ID (defaults to 'primary')"),
        confirmDelete: z
            .boolean()
            .default(false)
            .describe(
                "Set to true only AFTER showing the user the event details and getting their explicit approval. When false, returns a preview instead of deleting."
            ),
        gmailAddress: z
            .string()
            .default("")
            .describe("Google account email. Leave empty to auto-detect from connected account.")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        preview: z.boolean().optional(),
        deleted: z.boolean().optional(),
        eventId: z.string().optional(),
        summary: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
        description: z.string().optional(),
        location: z.string().optional(),
        attendees: z.string().optional(),
        error: z.string().optional()
    }),
    execute: async ({ eventId, calendarId, confirmDelete, gmailAddress }) => {
        const address = await resolveGmailAddress(gmailAddress);
        const calendar = calendarId || "primary";
        try {
            const scopeCheck = await checkGoogleScopes(address, CALENDAR_WRITE_SCOPES);
            if (!scopeCheck.ok) {
                return {
                    success: false,
                    error: `Google Calendar delete requires scope: ${scopeCheck.missing.join(", ")}. Re-authorize Google OAuth to grant calendar write access.`
                };
            }

            // If confirmDelete is false, fetch the event and return a preview
            if (!confirmDelete) {
                const getResponse = await callCalendarApi(
                    address,
                    `/calendars/${encodeURIComponent(calendar)}/events/${encodeURIComponent(eventId)}`
                );

                if (!getResponse.ok) {
                    const errorText = await getResponse.text();
                    return {
                        success: false,
                        error: `Failed to fetch event for preview (${getResponse.status}): ${errorText}`
                    };
                }

                const event = (await getResponse.json()) as CalendarEventResponse;
                const attendeeList = event.attendees
                    ?.map((a) => a.displayName || a.email || "")
                    .filter(Boolean)
                    .join(", ");

                return {
                    success: true,
                    preview: true,
                    deleted: false,
                    eventId: event.id || eventId,
                    summary: event.summary || "(no title)",
                    start: event.start?.dateTime || event.start?.date || "",
                    end: event.end?.dateTime || event.end?.date || "",
                    description: event.description || "",
                    location: event.location || "",
                    attendees: attendeeList || ""
                };
            }

            // confirmDelete is true — perform the actual deletion
            const response = await callCalendarApiWithBody(
                address,
                `/calendars/${encodeURIComponent(calendar)}/events/${encodeURIComponent(eventId)}`,
                {
                    method: "DELETE",
                    params: { sendUpdates: "all" }
                }
            );

            // Google Calendar DELETE returns 204 No Content on success
            if (response.status === 204 || response.ok) {
                return {
                    success: true,
                    preview: false,
                    deleted: true,
                    eventId
                };
            }

            const errorText = await response.text();
            return {
                success: false,
                error: `Calendar delete failed (${response.status}): ${errorText}`
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }
});
