/**
 * Google Calendar Search Events Tool
 *
 * Searches Google Calendar events within a time range by text query.
 * Uses the same Google OAuth credentials as Gmail (requires calendar scope).
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getAccessToken, refreshAccessToken, decrypt, checkGoogleScopes } from "../gmail/shared";
import { prisma } from "@repo/database";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

/**
 * Make an authenticated Google Calendar API call with automatic token refresh on 401.
 */
const callCalendarApi = async (
    gmailAddress: string,
    path: string,
    params?: Record<string, string>
): Promise<Response> => {
    let token = await getAccessToken(gmailAddress);

    const url = new URL(`${CALENDAR_API}${path}`);
    if (params) {
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    let response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` }
    });

    // Retry once with refreshed token on 401
    if (response.status === 401) {
        const provider = await prisma.integrationProvider.findUnique({
            where: { key: "gmail" }
        });
        const integration = await prisma.gmailIntegration.findFirst({
            where: { gmailAddress, isActive: true },
            include: { workspace: { select: { organizationId: true } } }
        });
        const organizationId = integration?.workspace?.organizationId;
        if (provider && organizationId) {
            const connection = await prisma.integrationConnection.findFirst({
                where: {
                    organizationId,
                    providerId: provider.id,
                    isActive: true,
                    OR: [
                        { metadata: { path: ["gmailAddress"], equals: gmailAddress } },
                        { credentials: { path: ["gmailAddress"], equals: gmailAddress } }
                    ]
                }
            });
            const creds = decrypt(connection?.credentials);
            if (creds?.refreshToken) {
                const refreshed = await refreshAccessToken(creds.refreshToken as string);
                if (refreshed) {
                    token = refreshed;
                    response = await fetch(url.toString(), {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                }
            }
        }
    }

    return response;
};

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
            .email()
            .default("corey@useappello.com")
            .describe("The Google account email (defaults to corey@useappello.com)")
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
        const address = gmailAddress || "corey@useappello.com";
        const calendar = calendarId || "primary";
        try {
            // Pre-flight scope check: verify calendar.readonly was granted
            const scopeCheck = await checkGoogleScopes(address, [
                "https://www.googleapis.com/auth/calendar.readonly"
            ]);
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
