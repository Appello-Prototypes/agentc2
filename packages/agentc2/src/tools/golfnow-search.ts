import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { resolveGolfNowCredentials } from "./golf-credentials";

const GOLFNOW_PRODUCTION_URL = "https://api.gnsvc.com";
const GOLFNOW_SANDBOX_URL = "https://sandbox.api.gnsvc.com";
const FETCH_TIMEOUT_MS = 15_000;

function getBaseUrl(useSandbox: boolean): string {
    return useSandbox ? GOLFNOW_SANDBOX_URL : GOLFNOW_PRODUCTION_URL;
}

export const golfnowSearchTool = createTool({
    id: "golfnow-search",
    description:
        "Search for golf courses and available tee times on GolfNow. " +
        "Covers ~15% of Ontario courses. Supports geolocation-based search " +
        "and date-based tee time availability. Returns tee time rates with pricing. " +
        "Requires GOLFNOW_USERNAME and GOLFNOW_PASSWORD environment variables.",
    inputSchema: z.object({
        courseName: z.string().optional().describe("Course name to search for"),
        latitude: z
            .number()
            .optional()
            .describe("Latitude for geolocation search (e.g., 43.0 for Ontario)"),
        longitude: z
            .number()
            .optional()
            .describe("Longitude for geolocation search (e.g., -81.0 for Ontario)"),
        proximityMiles: z
            .number()
            .optional()
            .default(50)
            .describe("Search radius in miles (default 50)"),
        date: z.string().describe("Date to search for tee times (YYYY-MM-DD format)"),
        players: z.number().min(1).max(4).default(2).describe("Number of players (1-4, default 2)"),
        maxResults: z
            .number()
            .optional()
            .default(20)
            .describe("Maximum number of results to return (default 20)")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        platform: z.literal("golfnow"),
        courses: z
            .array(
                z.object({
                    facilityId: z.string(),
                    name: z.string(),
                    city: z.string().optional(),
                    teeTimeRates: z.array(
                        z.object({
                            time: z.string(),
                            price: z.string(),
                            holes: z.number(),
                            players: z.number(),
                            teeTimeRateId: z.string(),
                            rateTagCodes: z.string().optional(),
                            isHotDeal: z.boolean().optional()
                        })
                    )
                })
            )
            .optional(),
        totalResults: z.number().optional(),
        error: z.string().optional(),
        apiKeyMissing: z.boolean().optional()
    }),
    execute: async ({
        courseName,
        latitude,
        longitude,
        proximityMiles = 50,
        date,
        players = 2,
        maxResults = 20
    }) => {
        const config = await resolveGolfNowCredentials();
        if (!config) {
            return {
                success: false,
                platform: "golfnow" as const,
                error:
                    "GolfNow API credentials not configured. " +
                    "Add your credentials via Settings > Integrations > GolfNow, " +
                    "or set GOLFNOW_USERNAME and GOLFNOW_PASSWORD in environment variables.",
                apiKeyMissing: true
            };
        }

        try {
            const baseUrl = getBaseUrl(config.useSandbox);
            const dateMin = `${date}T00:00:00`;
            const dateMax = `${date}T23:59:59`;

            const lat = latitude || 43.0;
            const lng = longitude || -81.0;

            const searchUrl =
                `${baseUrl}/rest/channel/${config.channelId}/facilities/tee-times` +
                `?q=geo-location` +
                `&latitude=${lat}` +
                `&longitude=${lng}` +
                `&proximity=${proximityMiles}` +
                `&date-min=${encodeURIComponent(dateMin)}` +
                `&date-max=${encodeURIComponent(dateMax)}` +
                `&take=${maxResults}`;

            const response = await fetch(searchUrl, {
                method: "GET",
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    UserName: config.username,
                    Password: config.password,
                    AdvancedErrorCodes: "True"
                }
            });

            if (response.status === 401 || response.status === 403) {
                return {
                    success: false,
                    platform: "golfnow" as const,
                    error: "GolfNow API authentication failed. Check your credentials."
                };
            }

            if (response.status >= 400) {
                const errorText = await response.text();
                return {
                    success: false,
                    platform: "golfnow" as const,
                    error: `GolfNow API returned HTTP ${response.status}: ${errorText.substring(0, 200)}`
                };
            }

            const data = await response.json();

            const teeTimeSets: Array<{
                FacilityID?: number;
                FacilityName?: string;
                FacilityCity?: string;
                Time?: string;
                HasHotDeal?: boolean;
                DisplayRate?: { Price?: number; GreensFee?: number };
                PlayerRule?: { MinPlayers?: number; MaxPlayers?: number };
                Rates?: Array<{
                    TeeTimeRateID?: number;
                    Price?: number;
                    GreensFee?: number;
                    Holes?: number;
                    MaxPlayers?: number;
                    RateTagCodes?: string;
                    Time?: string;
                }>;
            }> = Array.isArray(data?.TeeTimes) ? data.TeeTimes : [];

            const courseMap = new Map<
                string,
                {
                    facilityId: string;
                    name: string;
                    city?: string;
                    teeTimeRates: Array<{
                        time: string;
                        price: string;
                        holes: number;
                        players: number;
                        teeTimeRateId: string;
                        rateTagCodes?: string;
                        isHotDeal?: boolean;
                    }>;
                }
            >();

            for (const tt of teeTimeSets) {
                const facilityId = String(tt.FacilityID || "");
                const facilityName = tt.FacilityName || `Facility ${facilityId}`;

                if (courseName) {
                    const nameMatch = facilityName.toLowerCase().includes(courseName.toLowerCase());
                    if (!nameMatch) continue;
                }

                if (!courseMap.has(facilityId)) {
                    courseMap.set(facilityId, {
                        facilityId,
                        name: facilityName,
                        city: tt.FacilityCity,
                        teeTimeRates: []
                    });
                }

                const course = courseMap.get(facilityId)!;
                const rates = Array.isArray(tt.Rates) ? tt.Rates : [];

                for (const rate of rates) {
                    course.teeTimeRates.push({
                        time: rate.Time || tt.Time || "",
                        price:
                            rate.Price != null
                                ? `$${rate.Price.toFixed(2)}`
                                : rate.GreensFee != null
                                  ? `$${rate.GreensFee.toFixed(2)}`
                                  : "N/A",
                        holes: rate.Holes || 18,
                        players: rate.MaxPlayers || players,
                        teeTimeRateId: String(rate.TeeTimeRateID || ""),
                        rateTagCodes: rate.RateTagCodes,
                        isHotDeal: tt.HasHotDeal
                    });
                }
            }

            const courses = Array.from(courseMap.values());

            return {
                success: true,
                platform: "golfnow" as const,
                courses,
                totalResults: courses.length
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            if (msg.includes("TimeoutError") || msg.includes("aborted")) {
                return {
                    success: false,
                    platform: "golfnow" as const,
                    error: "GolfNow API did not respond within 15 seconds."
                };
            }
            return {
                success: false,
                platform: "golfnow" as const,
                error: `GolfNow search failed: ${msg}`
            };
        }
    }
});
