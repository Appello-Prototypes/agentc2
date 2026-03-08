import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { resolveChronoGolfCredentials } from "./golf-credentials";

const CHRONOGOLF_BASE_URL = "https://www.chronogolf.com";
const FETCH_TIMEOUT_MS = 20_000;
const UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const chronogolfBookTool = createTool({
    id: "chronogolf-book",
    description:
        "Book a tee time on ChronoGolf (Lightspeed Golf). Use AFTER chronogolf-search to get the " +
        "courseId and teeTimeId. ALWAYS confirm with the user before calling this tool. " +
        "Requires CHRONOGOLF_API_KEY environment variable.",
    inputSchema: z.object({
        courseId: z.string().describe("ChronoGolf course ID from chronogolf-search results"),
        teeTimeId: z.string().describe("Tee time ID from chronogolf-search results"),
        players: z.number().min(1).max(4).describe("Number of players"),
        customerFirstName: z.string().describe("Customer first name"),
        customerLastName: z.string().describe("Customer last name"),
        customerEmail: z.string().describe("Customer email address"),
        customerPhone: z.string().optional().describe("Customer phone number")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        platform: z.literal("chronogolf"),
        confirmationNumber: z.string().optional(),
        courseName: z.string().optional(),
        date: z.string().optional(),
        time: z.string().optional(),
        players: z.number().optional(),
        totalPrice: z.string().optional(),
        error: z.string().optional(),
        apiKeyMissing: z.boolean().optional()
    }),
    execute: async ({
        courseId,
        teeTimeId,
        players,
        customerFirstName,
        customerLastName,
        customerEmail,
        customerPhone
    }) => {
        const creds = await resolveChronoGolfCredentials();
        if (!creds) {
            return {
                success: false,
                platform: "chronogolf" as const,
                error:
                    "ChronoGolf Partner API key not configured. " +
                    "Add your API key via Settings > Integrations > ChronoGolf, " +
                    "or set CHRONOGOLF_API_KEY in environment variables.",
                apiKeyMissing: true
            };
        }
        const apiKey = creds.apiKey;

        try {
            const url = `${CHRONOGOLF_BASE_URL}/api/partner/v2/reservations`;

            const body = {
                course_id: courseId,
                tee_time_id: teeTimeId,
                players,
                customer: {
                    first_name: customerFirstName,
                    last_name: customerLastName,
                    email: customerEmail,
                    phone: customerPhone
                }
            };

            const response = await fetch(url, {
                method: "POST",
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
                headers: {
                    "User-Agent": UA,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    Authorization: `Bearer ${apiKey}`
                },
                body: JSON.stringify(body)
            });

            if (response.status === 401 || response.status === 403) {
                return {
                    success: false,
                    platform: "chronogolf" as const,
                    error: "ChronoGolf API authentication failed. Check your API key."
                };
            }

            if (response.status === 409) {
                return {
                    success: false,
                    platform: "chronogolf" as const,
                    error: "This tee time is no longer available. It may have been booked by someone else."
                };
            }

            if (response.status >= 400) {
                const errorText = await response.text();
                return {
                    success: false,
                    platform: "chronogolf" as const,
                    error: `ChronoGolf booking failed (HTTP ${response.status}): ${errorText.substring(0, 200)}`
                };
            }

            const data = await response.json();

            return {
                success: true,
                platform: "chronogolf" as const,
                confirmationNumber: data.confirmation_number || data.id || "PENDING",
                courseName: data.course_name || data.course?.name,
                date: data.date,
                time: data.time,
                players: data.players || players,
                totalPrice:
                    data.total_price != null ? `$${Number(data.total_price).toFixed(2)}` : undefined
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            if (msg.includes("TimeoutError") || msg.includes("aborted")) {
                return {
                    success: false,
                    platform: "chronogolf" as const,
                    error: "ChronoGolf API did not respond within 20 seconds."
                };
            }
            return {
                success: false,
                platform: "chronogolf" as const,
                error: `ChronoGolf booking failed: ${msg}`
            };
        }
    }
});
