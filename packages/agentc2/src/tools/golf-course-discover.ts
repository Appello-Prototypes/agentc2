import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { resolveChronoGolfCredentials, resolveGolfNowCredentials } from "./golf-credentials";

const FETCH_TIMEOUT_MS = 12_000;
const UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const TEEON_COMBO_LANDING =
    "https://www.tee-on.com/PubGolf/servlet/com.teeon.teesheet.servlets.golfersection.ComboLanding";

const GOLFNORTH_KNOWN_SLUGS: Record<string, string> = {
    westminster: "Westminster Trails Golf Club",
    cobblehills: "Cobble Hills Golf Club",
    thefox: "The Fox Golf Club",
    arkona: "Arkona Fairways Golf Club",
    forest: "Forest Golf Club & Inn",
    brockvillehighland: "Brockville Highland Golf Club",
    flamboroughhills: "Flamborough Hills Golf Club",
    shantybay: "Shanty Bay Golf Club",
    lanarkhighlands: "Lanark Highlands Golf Course",
    smugglersglen: "Smuggler's Glen Golf Course"
};

const TEEON_KNOWN_CODES: Record<string, string> = {
    BYQT: "Bay of Quinte Golf Club",
    PKGC: "Pine Knot Golf Club",
    TRNT: "Trenton Golf Club",
    BRGH: "Brockville Highland Golf Club",
    GRCR: "Garrison Creek Golf Club"
};

interface DiscoveredCourse {
    name: string;
    city: string;
    platform: "chronogolf" | "golfnow" | "teeon" | "golfnorth" | "unknown";
    bookingUrl: string;
    confidence: "high" | "medium" | "low";
    notes: string;
}

export const golfCourseDiscoverTool = createTool({
    id: "golf-course-discover",
    description:
        "Discover which booking platform a golf course uses. Searches across ChronoGolf, GolfNow, " +
        "TeeOn, and GolfNorth to identify the correct booking method. Use this BEFORE attempting " +
        "to book when you don't know which platform a course uses. Returns the platform and " +
        "booking URL so you can route to the correct search/book tool.",
    inputSchema: z.object({
        query: z
            .string()
            .describe(
                "Course name or search query (e.g., 'Arrowhead Golf Club', 'courses near London Ontario')"
            ),
        city: z.string().optional().describe("City or region to narrow the search"),
        checkTeeOn: z
            .boolean()
            .optional()
            .default(true)
            .describe("Whether to check TeeOn direct (requires known course code)"),
        checkGolfNorth: z
            .boolean()
            .optional()
            .default(true)
            .describe("Whether to check GolfNorth courses"),
        checkChronoGolf: z
            .boolean()
            .optional()
            .default(true)
            .describe("Whether to check ChronoGolf (requires API key)"),
        checkGolfNow: z
            .boolean()
            .optional()
            .default(true)
            .describe("Whether to check GolfNow (requires API credentials)")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        courses: z
            .array(
                z.object({
                    name: z.string(),
                    city: z.string(),
                    platform: z.enum(["chronogolf", "golfnow", "teeon", "golfnorth", "unknown"]),
                    bookingUrl: z.string(),
                    confidence: z.enum(["high", "medium", "low"]),
                    notes: z.string()
                })
            )
            .optional(),
        totalResults: z.number().optional(),
        platformsChecked: z.array(z.string()).optional(),
        error: z.string().optional()
    }),
    execute: async ({
        query,
        city,
        checkTeeOn = true,
        checkGolfNorth = true,
        checkChronoGolf = true,
        checkGolfNow = true
    }) => {
        const queryLower = query.toLowerCase();
        const results: DiscoveredCourse[] = [];
        const platformsChecked: string[] = [];

        // 1. Check GolfNorth known courses
        if (checkGolfNorth) {
            platformsChecked.push("golfnorth");
            for (const [slug, name] of Object.entries(GOLFNORTH_KNOWN_SLUGS)) {
                if (
                    name.toLowerCase().includes(queryLower) ||
                    queryLower.includes(name.toLowerCase().split(" ")[0])
                ) {
                    results.push({
                        name,
                        city: city || "Ontario",
                        platform: "golfnorth",
                        bookingUrl: `https://admin.teeon.com/portal/golfnorth/teetimes/${slug}`,
                        confidence: "high",
                        notes: "GolfNorth course — uses TeeOn portal. Use teeon-login then navigate to the portal URL."
                    });
                }
            }
        }

        // 2. Check TeeOn known course codes
        if (checkTeeOn) {
            platformsChecked.push("teeon");
            for (const [code, name] of Object.entries(TEEON_KNOWN_CODES)) {
                if (
                    name.toLowerCase().includes(queryLower) ||
                    queryLower.includes(name.toLowerCase().split(" ")[0])
                ) {
                    results.push({
                        name,
                        city: city || "Ontario",
                        platform: "teeon",
                        bookingUrl: `${TEEON_COMBO_LANDING}?CourseCode=${code}&FromCourseWebsite=true`,
                        confidence: "high",
                        notes: `TeeOn direct — course code: ${code}. Use teeon-login then teeon-search with courseCode="${code}".`
                    });
                }
            }

            if (results.length === 0) {
                const possibleCode = query
                    .toUpperCase()
                    .replace(/[^A-Z]/g, "")
                    .substring(0, 4);
                if (possibleCode.length === 4) {
                    try {
                        const testUrl = `${TEEON_COMBO_LANDING}?CourseCode=${possibleCode}&FromCourseWebsite=true`;
                        const response = await fetch(testUrl, {
                            method: "GET",
                            redirect: "follow",
                            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
                            headers: {
                                "User-Agent": UA,
                                Accept: "text/html"
                            }
                        });
                        if (response.ok) {
                            const html = await response.text();
                            if (html.length > 5000 && !html.includes("error")) {
                                const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
                                const courseName = titleMatch
                                    ? titleMatch[1].replace(/\s*-\s*TeeOn.*$/i, "").trim()
                                    : query;
                                results.push({
                                    name: courseName,
                                    city: city || "Ontario",
                                    platform: "teeon",
                                    bookingUrl: testUrl,
                                    confidence: "medium",
                                    notes: `TeeOn direct — discovered code: ${possibleCode}. Use teeon-login then teeon-search.`
                                });
                            }
                        }
                    } catch {
                        // TeeOn probe failed — continue
                    }
                }
            }
        }

        // 3. Check ChronoGolf (if API key available)
        if (checkChronoGolf) {
            const cgCreds = await resolveChronoGolfCredentials();
            if (cgCreds) {
                platformsChecked.push("chronogolf");
                try {
                    const params = new URLSearchParams();
                    params.set("name", query);
                    if (city) params.set("city", city);

                    const url = `https://www.chronogolf.com/api/partner/v2/courses?${params.toString()}`;
                    const response = await fetch(url, {
                        method: "GET",
                        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
                        headers: {
                            "User-Agent": UA,
                            Accept: "application/json",
                            Authorization: `Bearer ${cgCreds.apiKey}`
                        }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const courses = Array.isArray(data?.courses)
                            ? data.courses
                            : Array.isArray(data)
                              ? data
                              : [];
                        for (const course of courses.slice(0, 5)) {
                            results.push({
                                name: course.name || query,
                                city: course.city || city || "Ontario",
                                platform: "chronogolf",
                                bookingUrl:
                                    course.booking_url ||
                                    `https://www.chronogolf.com/club/${course.slug || course.id}`,
                                confidence: "high",
                                notes: `ChronoGolf course — use chronogolf-search and chronogolf-book.`
                            });
                        }
                    }
                } catch {
                    // ChronoGolf API failed — continue
                }
            } else {
                platformsChecked.push("chronogolf (no API key)");
            }
        }

        // 4. Check GolfNow (if credentials available)
        if (checkGolfNow) {
            const gnCreds = await resolveGolfNowCredentials();
            if (gnCreds) {
                platformsChecked.push("golfnow");
                try {
                    const baseUrl = gnCreds.useSandbox
                        ? "https://sandbox.api.gnsvc.com"
                        : "https://api.gnsvc.com";

                    const facilitiesUrl = `${baseUrl}/rest/channel/${gnCreds.channelId}/golf-facilities?q=name&name=${encodeURIComponent(query)}&take=5`;
                    const response = await fetch(facilitiesUrl, {
                        method: "GET",
                        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
                        headers: {
                            "Content-Type": "application/json; charset=utf-8",
                            UserName: gnCreds.username,
                            Password: gnCreds.password
                        }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const facilities = Array.isArray(data)
                            ? data
                            : Array.isArray(data?.Facilities)
                              ? data.Facilities
                              : [];
                        for (const facility of facilities.slice(0, 5)) {
                            results.push({
                                name: facility.Name || facility.FacilityName || query,
                                city: facility.City || city || "Ontario",
                                platform: "golfnow",
                                bookingUrl: `https://www.golfnow.com/tee-times/facility/${facility.FacilityID || facility.Id}/search`,
                                confidence: "high",
                                notes: `GolfNow course — use golfnow-search and golfnow-book.`
                            });
                        }
                    }
                } catch {
                    // GolfNow API failed — continue
                }
            } else {
                platformsChecked.push("golfnow (no credentials)");
            }
        }

        if (results.length === 0) {
            return {
                success: true,
                courses: [],
                totalResults: 0,
                platformsChecked,
                error: `No matches found for "${query}" on any platform. Try web-search for "${query} Ontario tee times booking" to find the course's booking page.`
            };
        }

        // Deduplicate by name
        const seen = new Set<string>();
        const deduped = results.filter((r) => {
            const key = r.name.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        return {
            success: true,
            courses: deduped,
            totalResults: deduped.length,
            platformsChecked
        };
    }
});
