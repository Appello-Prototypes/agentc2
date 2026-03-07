import { createTool } from "@mastra/core/tools"
import { z } from "zod"

const BASE_URL = "https://www.tee-on.com/PubGolf/servlet/"
const COMBO_LANDING =
    "com.teeon.teesheet.servlets.golfersection.ComboLanding"

const FETCH_TIMEOUT_MS = 15_000
const UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

const KNOWN_COURSES: Record<string, string> = {
    BYQT: "Bay of Quinte Golf Club",
    PKGC: "Pine Knot Golf Club",
    TRNT: "Trenton Golf Club",
    BRGH: "Brockville Highland Golf Club",
    GRCR: "Garrison Creek Golf Club",
}

interface NavLink {
    label: string
    url: string
    servlet: string
}

function extractNavLinks(html: string): NavLink[] {
    const links: NavLink[] = []
    const regex = /<a[^>]*href="([^"]*servlet[^"]*)"[^>]*>([^<]+)<\/a>/gi
    let match: RegExpExecArray | null
    while ((match = regex.exec(html)) !== null) {
        const url = match[1].trim()
        const label = match[2].trim()
        const servletMatch = url.match(
            /servlets\.[a-z]+\.(\w+)/i
        )
        if (servletMatch) {
            links.push({
                label,
                url,
                servlet: servletMatch[1],
            })
        }
    }
    return links
}

function extractLockerString(html: string): string {
    const match = html.match(/LockerString=([^&"]+)/)
    return match ? decodeURIComponent(match[1]) : ""
}

function extractMemberId(html: string): string {
    const match = html.match(/MemberID=([^&"]+)/)
    return match ? match[1] : ""
}

const teeTimeSlotSchema = z.object({
    time: z.string(),
    available: z.boolean(),
    price: z.string().optional(),
    holes: z.string().optional(),
    players: z.string().optional(),
    notes: z.string().optional(),
})

export const teeonSearchTool = createTool({
    id: "teeon-search",
    description:
        "Look up a TeeOn golf course and get navigation instructions for booking. " +
        "Call this AFTER teeon-login to get the correct URLs for Playwright navigation. " +
        "Returns the course navigation menu with the 'View Tee Sheet' URL that you should " +
        "navigate to in Playwright to see available tee times. " +
        "WORKFLOW: teeon-login -> teeon-search -> set cookie in browser -> " +
        "playwright_browser_navigate to the viewTeeSheetUrl -> playwright_browser_snapshot to read times.",
    inputSchema: z.object({
        allCookies: z
            .string()
            .describe(
                "Full cookie string from teeon-login result (allCookies field)"
            ),
        courseCode: z
            .string()
            .describe(
                "TeeOn course code (e.g., BYQT, PKGC, TRNT, BRGH, GRCR)"
            ),
    }),
    outputSchema: z.object({
        success: z.boolean(),
        courseName: z
            .string()
            .optional()
            .describe("Name of the golf course"),
        courseCode: z.string().optional(),
        memberId: z.string().optional().describe("Logged-in member ID"),
        viewTeeSheetUrl: z
            .string()
            .optional()
            .describe(
                "Full URL for Playwright to navigate to for viewing the tee sheet"
            ),
        bookTeeTimeUrl: z
            .string()
            .optional()
            .describe(
                "Full URL for the booking search form (fallback)"
            ),
        comboLandingUrl: z
            .string()
            .optional()
            .describe("URL of the ComboLanding page (entry point)"),
        navLinks: z
            .array(
                z.object({
                    label: z.string(),
                    url: z.string(),
                    servlet: z.string(),
                })
            )
            .optional()
            .describe("All navigation links available for this course"),
        playwrightInstructions: z
            .string()
            .optional()
            .describe(
                "Step-by-step Playwright instructions for viewing tee times"
            ),
        error: z
            .string()
            .optional()
            .describe("Error message on failure"),
    }),
    execute: async ({ allCookies, courseCode }) => {
        const code = courseCode.toUpperCase()
        try {
            const comboUrl = `${BASE_URL}${COMBO_LANDING}?CourseCode=${code}&FromCourseWebsite=true`

            const response = await fetch(comboUrl, {
                method: "GET",
                redirect: "follow",
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
                headers: {
                    "User-Agent": UA,
                    Accept: "text/html",
                    Cookie: allCookies,
                },
            })

            if (response.status >= 400) {
                return {
                    success: false,
                    error: `Failed to load course page: HTTP ${response.status}. Course code '${code}' may be invalid.`,
                }
            }

            const html = await response.text()

            if (html.length < 5000) {
                return {
                    success: false,
                    error: `Course page returned minimal content. You may need to re-login with teeon-login first.`,
                }
            }

            const navLinks = extractNavLinks(html)
            const lockerString = extractLockerString(html)
            const memberId = extractMemberId(html)
            const courseName =
                KNOWN_COURSES[code] || `TeeOn Course (${code})`

            const viewTeeSheetLink = navLinks.find(
                (l) => l.servlet === "MemberTeeSheetGolferSection"
            )
            const bookTeeTimeLink = navLinks.find(
                (l) => l.servlet === "WebBookingSearchSteps"
            )

            const viewTeeSheetUrl = viewTeeSheetLink
                ? `${BASE_URL}${viewTeeSheetLink.url}`
                : undefined
            const bookTeeTimeUrl = bookTeeTimeLink
                ? `${BASE_URL}${bookTeeTimeLink.url}`
                : undefined

            const steps = [
                `1. Set cookies in browser: playwright_browser_evaluate -> document.cookie = 'JSESSIONID=<value>; path=/PubGolf'; (use the session cookie from teeon-login)`,
                `2. Navigate to: ${viewTeeSheetUrl || comboUrl}`,
                `3. Take a snapshot: playwright_browser_snapshot`,
                `4. If you see a date dropdown, select the desired date`,
                `5. Take another snapshot to read the tee times with prices`,
                `6. Present the available times to the user`,
            ]

            return {
                success: true,
                courseName,
                courseCode: code,
                memberId,
                viewTeeSheetUrl,
                bookTeeTimeUrl,
                comboLandingUrl: comboUrl,
                navLinks: navLinks.map((l) => ({
                    label: l.label,
                    url: `${BASE_URL}${l.url}`,
                    servlet: l.servlet,
                })),
                playwrightInstructions: steps.join("\n"),
            }
        } catch (error) {
            const msg =
                error instanceof Error ? error.message : String(error)
            if (
                msg.includes("TimeoutError") ||
                msg.includes("aborted")
            ) {
                return {
                    success: false,
                    error: "TeeOn server did not respond within 15 seconds.",
                }
            }
            return {
                success: false,
                error: `Course lookup failed: ${msg}`,
            }
        }
    },
})
