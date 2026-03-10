import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 10_000;

const TEEON_COURSES: Record<string, string> = {
    BYQT: "Bay of Quinte Golf Club",
    PKGC: "Pine Knot Golf Club",
    TRNT: "Trenton Golf Club",
    BRGH: "Brockville Highland Golf Club",
    GRCR: "Garrison Creek Golf Club"
};

const GOLFNORTH_COURSES: Record<string, string> = {
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

const CLOSED_PATTERNS = [
    "course is closed",
    "currently closed",
    "not available",
    "season has ended",
    "closed for the season",
    "opening soon"
];

const courseStatusSchema = z.object({
    name: z.string(),
    code: z.string(),
    platform: z.enum(["teeon", "golfnorth"]),
    isOpen: z.boolean(),
    webBookingEnabled: z.boolean(),
    url: z.string()
});

type CourseStatus = z.infer<typeof courseStatusSchema>;

async function checkCourse(
    name: string,
    code: string,
    platform: "teeon" | "golfnorth",
    url: string,
    cookies: string
): Promise<CourseStatus> {
    const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
            "User-Agent": UA,
            Accept: "text/html",
            Cookie: cookies
        }
    });

    if (response.status >= 400) {
        return { name, code, platform, isOpen: false, webBookingEnabled: false, url };
    }

    const html = await response.text();

    if (html.length < 5000) {
        return { name, code, platform, isOpen: false, webBookingEnabled: false, url };
    }

    const htmlLower = html.toLowerCase();
    const isClosed = CLOSED_PATTERNS.some((p) => htmlLower.includes(p));
    const webBookingEnabled = html.includes("MemberTeeSheetGolferSection");

    return {
        name,
        code,
        platform,
        isOpen: !isClosed,
        webBookingEnabled,
        url
    };
}

export const teeonScanCoursesTool = createTool({
    id: "teeon-scan-courses",
    description:
        "Batch check all known TeeOn and GolfNorth courses to see which are currently " +
        "accepting online bookings. Fetches each course's landing page in parallel and " +
        "reports whether the page loaded, whether web booking is enabled, and whether the " +
        "course appears open. Does NOT require Playwright — uses direct HTTP requests.",
    inputSchema: z.object({
        allCookies: z
            .string()
            .optional()
            .default("")
            .describe(
                "Full cookie string from teeon-login result (allCookies field). " +
                    "Optional — pages may still load without auth but with limited info."
            ),
        platforms: z
            .array(z.enum(["teeon", "golfnorth"]))
            .optional()
            .describe(
                'Filter to specific platforms. Omit to scan all. Example: ["teeon"] or ["golfnorth"].'
            )
    }),
    outputSchema: z.object({
        success: z.boolean(),
        totalChecked: z.number(),
        openCount: z.number(),
        webBookingCount: z.number(),
        courses: z.array(courseStatusSchema),
        errors: z.array(
            z.object({
                name: z.string(),
                code: z.string(),
                platform: z.string(),
                error: z.string()
            })
        )
    }),
    execute: async ({ allCookies, platforms }) => {
        const cookies = allCookies ?? "";
        const scanTeeon = !platforms || platforms.includes("teeon");
        const scanGolfNorth = !platforms || platforms.includes("golfnorth");

        const checks: Array<{
            name: string;
            code: string;
            platform: "teeon" | "golfnorth";
            promise: Promise<CourseStatus>;
        }> = [];

        if (scanTeeon) {
            for (const [code, name] of Object.entries(TEEON_COURSES)) {
                const url = `https://www.tee-on.com/PubGolf/servlet/com.teeon.teesheet.servlets.golfersection.ComboLanding?CourseCode=${code}&FromCourseWebsite=true`;
                checks.push({
                    name,
                    code,
                    platform: "teeon",
                    promise: checkCourse(name, code, "teeon", url, cookies)
                });
            }
        }

        if (scanGolfNorth) {
            for (const [slug, name] of Object.entries(GOLFNORTH_COURSES)) {
                const url = `https://admin.teeon.com/portal/golfnorth/teetimes/${slug}`;
                checks.push({
                    name,
                    code: slug,
                    platform: "golfnorth",
                    promise: checkCourse(name, slug, "golfnorth", url, cookies)
                });
            }
        }

        const results = await Promise.allSettled(checks.map((c) => c.promise));

        const courses: CourseStatus[] = [];
        const errors: Array<{ name: string; code: string; platform: string; error: string }> = [];

        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const check = checks[i];
            if (result.status === "fulfilled") {
                courses.push(result.value);
            } else {
                const msg =
                    result.reason instanceof Error ? result.reason.message : String(result.reason);
                const errorMsg =
                    msg.includes("TimeoutError") || msg.includes("aborted")
                        ? "Request timed out after 10 seconds"
                        : msg;
                errors.push({
                    name: check.name,
                    code: check.code,
                    platform: check.platform,
                    error: errorMsg
                });
            }
        }

        return {
            success: true,
            totalChecked: checks.length,
            openCount: courses.filter((c) => c.isOpen).length,
            webBookingCount: courses.filter((c) => c.webBookingEnabled).length,
            courses,
            errors
        };
    }
});
