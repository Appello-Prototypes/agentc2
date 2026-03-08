import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { resolveChronoGolfCredentials } from "./golf-credentials";

const CHRONOGOLF_BASE_URL = "https://www.chronogolf.com";
const FETCH_TIMEOUT_MS = 15_000;
const UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const chronogolfSearchTool = createTool({
    id: "chronogolf-search",
    description:
        "Search for golf courses and available tee times on ChronoGolf (Lightspeed Golf). " +
        "Covers ~45% of Ontario courses including Thames Valley, Fanshawe, Maple Ridge, Dorchester, " +
        "The Bridges at Tillsonburg, and many more. Returns available tee times with pricing. " +
        "Requires CHRONOGOLF_API_KEY environment variable (Partner API access).",
    inputSchema: z.object({
        courseName: z
            .string()
            .optional()
            .describe("Course name to search for (partial match supported)"),
        city: z
            .string()
            .optional()
            .describe("City or region to search in (e.g., 'London', 'Ontario')"),
        date: z.string().describe("Date to search for tee times (YYYY-MM-DD format)"),
        players: z.number().min(1).max(4).default(2).describe("Number of players (1-4, default 2)"),
        holes: z.number().optional().default(18).describe("Number of holes (9 or 18, default 18)")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        platform: z.literal("chronogolf"),
        courses: z
            .array(
                z.object({
                    id: z.string(),
                    name: z.string(),
                    city: z.string().optional(),
                    availableTimes: z.array(
                        z.object({
                            time: z.string(),
                            price: z.string(),
                            holes: z.number(),
                            spotsAvailable: z.number(),
                            teeTimeId: z.string(),
                            rateType: z.string().optional()
                        })
                    )
                })
            )
            .optional(),
        totalResults: z.number().optional(),
        error: z.string().optional(),
        apiKeyMissing: z.boolean().optional()
    }),
    execute: async ({ courseName, city, date, players = 2, holes = 18 }) => {
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
            const params = new URLSearchParams();
            if (courseName) params.set("name", courseName);
            if (city) params.set("city", city);
            params.set("date", date);
            params.set("players", String(players));
            params.set("holes", String(holes));

            const url = `${CHRONOGOLF_BASE_URL}/api/partner/v2/tee-times?${params.toString()}`;

            const response = await fetch(url, {
                method: "GET",
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
                headers: {
                    "User-Agent": UA,
                    Accept: "application/json",
                    Authorization: `Bearer ${apiKey}`
                }
            });

            if (response.status === 401 || response.status === 403) {
                return {
                    success: false,
                    platform: "chronogolf" as const,
                    error: "ChronoGolf API authentication failed. Check your API key."
                };
            }

            if (response.status >= 400) {
                return {
                    success: false,
                    platform: "chronogolf" as const,
                    error: `ChronoGolf API returned HTTP ${response.status}`
                };
            }

            const data = await response.json();

            const courses = Array.isArray(data?.courses)
                ? data.courses.map(
                      (course: {
                          id?: string;
                          name?: string;
                          city?: string;
                          tee_times?: Array<{
                              time?: string;
                              price?: number;
                              holes?: number;
                              spots_available?: number;
                              id?: string;
                              rate_type?: string;
                          }>;
                      }) => ({
                          id: String(course.id || ""),
                          name: course.name || "Unknown Course",
                          city: course.city,
                          availableTimes: Array.isArray(course.tee_times)
                              ? course.tee_times.map(
                                    (tt: {
                                        time?: string;
                                        price?: number;
                                        holes?: number;
                                        spots_available?: number;
                                        id?: string;
                                        rate_type?: string;
                                    }) => ({
                                        time: tt.time || "",
                                        price: tt.price != null ? `$${tt.price.toFixed(2)}` : "N/A",
                                        holes: tt.holes || holes,
                                        spotsAvailable: tt.spots_available || 0,
                                        teeTimeId: String(tt.id || ""),
                                        rateType: tt.rate_type
                                    })
                                )
                              : []
                      })
                  )
                : [];

            return {
                success: true,
                platform: "chronogolf" as const,
                courses,
                totalResults: courses.length
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            if (msg.includes("TimeoutError") || msg.includes("aborted")) {
                return {
                    success: false,
                    platform: "chronogolf" as const,
                    error: "ChronoGolf API did not respond within 15 seconds."
                };
            }
            return {
                success: false,
                platform: "chronogolf" as const,
                error: `ChronoGolf search failed: ${msg}`
            };
        }
    }
});
