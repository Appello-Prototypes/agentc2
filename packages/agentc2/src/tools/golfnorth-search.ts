import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const GOLFNORTH_COURSES_URL = "https://www.golfnorth.ca/courses/";
const TEEON_PORTAL_BASE = "https://admin.teeon.com/portal/golfnorth/teetimes";
const FETCH_TIMEOUT_MS = 15_000;
const UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const KNOWN_GOLFNORTH_COURSES: Array<{
    name: string;
    slug: string;
    city: string;
    region: string;
}> = [
    {
        name: "Westminster Trails Golf Club",
        slug: "westminster",
        city: "London",
        region: "Southwestern Ontario"
    },
    {
        name: "Cobble Hills Golf Club",
        slug: "cobblehills",
        city: "Thamesford",
        region: "Southwestern Ontario"
    },
    {
        name: "The Fox Golf Club",
        slug: "thefox",
        city: "Granton",
        region: "Southwestern Ontario"
    },
    {
        name: "Arkona Fairways Golf Club",
        slug: "arkona",
        city: "Arkona",
        region: "Southwestern Ontario"
    },
    {
        name: "Forest Golf Club & Inn",
        slug: "forest",
        city: "Forest",
        region: "Southwestern Ontario"
    },
    {
        name: "Brockville Highland Golf Club",
        slug: "brockvillehighland",
        city: "Brockville",
        region: "Eastern Ontario"
    },
    {
        name: "Flamborough Hills Golf Club",
        slug: "flamboroughhills",
        city: "Flamborough",
        region: "Golden Horseshoe"
    },
    {
        name: "Shanty Bay Golf Club",
        slug: "shantybay",
        city: "Shanty Bay",
        region: "Central Ontario"
    },
    {
        name: "Lanark Highlands Golf Course",
        slug: "lanarkhighlands",
        city: "Lanark",
        region: "Eastern Ontario"
    },
    {
        name: "Smuggler's Glen Golf Course",
        slug: "smugglersglen",
        city: "Gananoque",
        region: "Eastern Ontario"
    }
];

export const golfnorthSearchTool = createTool({
    id: "golfnorth-search",
    description:
        "Search for GolfNorth courses in Ontario. GolfNorth operates ~30 courses across Ontario " +
        "and uses TeeOn's portal backend for online bookings. Returns course details with " +
        "TeeOn portal booking URLs. Use teeon-login and teeon-search with the portal URL for booking. " +
        "No API key required — uses a cached course list with live validation.",
    inputSchema: z.object({
        courseName: z
            .string()
            .optional()
            .describe("Course name to search for (partial match supported)"),
        city: z.string().optional().describe("City to search in (e.g., 'London', 'Brockville')"),
        region: z
            .string()
            .optional()
            .describe("Region to search in (e.g., 'Southwestern Ontario', 'Eastern Ontario')"),
        validateUrls: z
            .boolean()
            .optional()
            .default(false)
            .describe("If true, validates that the TeeOn portal URLs are accessible (slower)")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        platform: z.literal("golfnorth"),
        courses: z
            .array(
                z.object({
                    name: z.string(),
                    slug: z.string(),
                    city: z.string(),
                    region: z.string(),
                    teeOnPortalUrl: z.string(),
                    bookingUrl: z.string(),
                    validated: z.boolean().optional(),
                    isAccessible: z.boolean().optional()
                })
            )
            .optional(),
        totalResults: z.number().optional(),
        error: z.string().optional()
    }),
    execute: async ({ courseName, city, region, validateUrls = false }) => {
        try {
            let courses = [...KNOWN_GOLFNORTH_COURSES];

            if (courseName) {
                const query = courseName.toLowerCase();
                courses = courses.filter((c) => c.name.toLowerCase().includes(query));
            }

            if (city) {
                const query = city.toLowerCase();
                courses = courses.filter((c) => c.city.toLowerCase().includes(query));
            }

            if (region) {
                const query = region.toLowerCase();
                courses = courses.filter((c) => c.region.toLowerCase().includes(query));
            }

            if (courses.length === 0 && courseName) {
                try {
                    const response = await fetch(GOLFNORTH_COURSES_URL, {
                        method: "GET",
                        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
                        headers: { "User-Agent": UA, Accept: "text/html" }
                    });

                    if (response.ok) {
                        const html = await response.text();
                        const regex =
                            /<a[^>]*href="[^"]*\/courses\/([^/"]+)\/?[^"]*"[^>]*>([^<]+)<\/a>/gi;
                        let match: RegExpExecArray | null;
                        while ((match = regex.exec(html)) !== null) {
                            const slug = match[1].toLowerCase();
                            const name = match[2].trim();
                            if (name.toLowerCase().includes(courseName.toLowerCase())) {
                                courses.push({
                                    name,
                                    slug,
                                    city: "Ontario",
                                    region: "Ontario"
                                });
                            }
                        }
                    }
                } catch {
                    // Fall through — the dynamic scrape is best-effort
                }
            }

            const results = await Promise.all(
                courses.map(async (course) => {
                    const portalUrl = `${TEEON_PORTAL_BASE}/${course.slug}`;
                    const bookingUrl = portalUrl;

                    let validated: boolean | undefined;
                    let isAccessible: boolean | undefined;

                    if (validateUrls) {
                        try {
                            const headResp = await fetch(portalUrl, {
                                method: "HEAD",
                                signal: AbortSignal.timeout(8000),
                                redirect: "follow",
                                headers: { "User-Agent": UA }
                            });
                            validated = true;
                            isAccessible = headResp.status >= 200 && headResp.status < 400;
                        } catch {
                            validated = true;
                            isAccessible = false;
                        }
                    }

                    return {
                        name: course.name,
                        slug: course.slug,
                        city: course.city,
                        region: course.region,
                        teeOnPortalUrl: portalUrl,
                        bookingUrl,
                        validated,
                        isAccessible
                    };
                })
            );

            return {
                success: true,
                platform: "golfnorth" as const,
                courses: results,
                totalResults: results.length
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                platform: "golfnorth" as const,
                error: `GolfNorth search failed: ${msg}`
            };
        }
    }
});
