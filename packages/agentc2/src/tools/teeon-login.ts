import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const LOGIN_URL =
    "https://www.tee-on.com/PubGolf/servlet/com.teeon.teesheet.servlets.golfersection.SignInGolferSection";

const FETCH_TIMEOUT_MS = 15_000;

/**
 * Extract hidden form fields from TeeOn login page HTML.
 * Parses <input type="hidden" name="..." value="..." /> tags.
 */
function parseHiddenFields(html: string): Record<string, string> {
    const fields: Record<string, string> = {};
    const regex = /<input[^>]*type\s*=\s*["']hidden["'][^>]*>/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(html)) !== null) {
        const tag = match[0];
        const nameMatch = tag.match(/name\s*=\s*["']([^"']+)["']/i);
        const valueMatch = tag.match(/value\s*=\s*["']([^"']*?)["']/i);
        if (nameMatch) {
            fields[nameMatch[1]] = valueMatch ? valueMatch[1] : "";
        }
    }
    return fields;
}

export const teeonLoginTool = createTool({
    id: "teeon-login",
    description:
        "Log in to TeeOn (tee-on.com) using HTTP POST. Returns the session cookie (JSESSIONID) " +
        "on success. Use this BEFORE any Playwright browser navigation to TeeOn. " +
        "After getting the session cookie, set it in the browser using playwright_browser_evaluate: " +
        "() => { document.cookie = 'JSESSIONID=<value>; path=/PubGolf'; return 'cookie set'; } " +
        "Then navigate to the desired TeeOn page (e.g., BookATeeTimeGolferSection).",
    inputSchema: z.object({
        username: z.string().describe("TeeOn username"),
        password: z.string().describe("TeeOn password"),
        loginType: z
            .number()
            .optional()
            .default(5)
            .describe("TeeOn LoginType parameter (default: 5 = Public)")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        sessionCookie: z.string().optional().describe("JSESSIONID value on success"),
        allCookies: z.string().optional().describe("Full cookie string for the browser"),
        welcomeMessage: z.string().optional().describe("Welcome message from TeeOn on success"),
        error: z.string().optional().describe("Error message on failure"),
        loginUrl: z.string().optional().describe("URL after login (for Playwright navigation)")
    }),
    execute: async ({ username, password, loginType = 5 }) => {
        const collectCookies = (
            response: Response,
            jar: string[]
        ): void => {
            const setCookies = response.headers.getSetCookie?.() || []
            for (const c of setCookies) {
                const nameValue = c.split(";")[0]
                if (!nameValue) continue
                const cookieName = nameValue.split("=")[0]
                const idx = jar.findIndex((e) => e.split("=")[0] === cookieName)
                if (idx >= 0) jar[idx] = nameValue
                else jar.push(nameValue)
            }
        }

        const followRedirects = async (
            response: Response,
            jar: string[],
            maxHops = 5
        ): Promise<{ finalResponse: Response; finalUrl: string }> => {
            let current = response
            let currentUrl = response.url
            for (let i = 0; i < maxHops; i++) {
                if (![301, 302, 303, 307, 308].includes(current.status)) break
                collectCookies(current, jar)
                const location = current.headers.get("Location")
                if (!location) break
                const nextUrl = new URL(location, currentUrl).toString()
                current = await fetch(nextUrl, {
                    method: "GET",
                    redirect: "manual",
                    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                        Cookie: jar.join("; ")
                    }
                })
                currentUrl = nextUrl
            }
            collectCookies(current, jar)
            return { finalResponse: current, finalUrl: currentUrl }
        }

        try {
            const cookieJar: string[] = []

            // Step 1: GET the login page to obtain session cookie and hidden fields
            const pageUrl = `${LOGIN_URL}?FromTeeOn=true&GrabFocus=true&LoginType=${loginType}`
            const pageResponse = await fetch(pageUrl, {
                method: "GET",
                redirect: "manual",
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
                }
            })

            const { finalResponse: getResult } = await followRedirects(pageResponse, cookieJar)

            if (!getResult.ok && getResult.status !== 200) {
                return {
                    success: false,
                    error: `Failed to load login page: HTTP ${getResult.status}`
                }
            }

            const pageHtml = await getResult.text()
            const hiddenFields = parseHiddenFields(pageHtml)

            // Step 2: POST the login form (include query params in both URL and form body)
            const postUrl = `${LOGIN_URL}?FromTeeOn=true&GrabFocus=true&LoginType=${loginType}`
            const formData = new URLSearchParams()
            formData.append("Username", username)
            formData.append("Password", password)
            formData.append("FromTeeOn", "true")
            formData.append("LoginType", String(loginType))
            for (const [key, value] of Object.entries(hiddenFields)) {
                formData.append(key, value)
            }

            const loginResponse = await fetch(postUrl, {
                method: "POST",
                redirect: "manual",
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent":
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    Referer: pageUrl,
                    Cookie: cookieJar.join("; ")
                }
            })

            // Follow redirects manually to preserve cookies at each hop
            const { finalResponse, finalUrl } = await followRedirects(loginResponse, cookieJar)

            const responseHtml = await finalResponse.text()

            // Step 3: Check for login success
            const isOnGolferSection =
                finalUrl.includes("GolferSection") && !finalUrl.includes("SignIn")
            const hasWelcome = /Welcome\s+\w+/i.test(responseHtml)
            const hasSignInFailed = /Sign In Failed|Invalid username or password/i.test(
                responseHtml
            )

            // Extract JSESSIONID
            const jsessionId = cookieJar
                .find((c) => c.startsWith("JSESSIONID="))
                ?.split("=")
                .slice(1)
                .join("=")

            if (hasSignInFailed && !hasWelcome) {
                return {
                    success: false,
                    error: `Invalid username or password. Please verify your TeeOn credentials. (finalUrl: ${finalUrl}, hiddenFields: ${Object.keys(hiddenFields).join(",")}, cookies: ${cookieJar.length})`
                }
            }

            if (isOnGolferSection || hasWelcome) {
                const welcomeMatch = responseHtml.match(/Welcome\s+(\w+)/i)
                return {
                    success: true,
                    sessionCookie: jsessionId || "",
                    allCookies: cookieJar.join("; "),
                    welcomeMessage: welcomeMatch ? welcomeMatch[0] : "Login successful",
                    loginUrl: finalUrl
                }
            }

            // Ambiguous result: no clear success or failure indicator
            if (jsessionId) {
                return {
                    success: true,
                    sessionCookie: jsessionId,
                    allCookies: cookieJar.join("; "),
                    welcomeMessage:
                        "Session obtained (verify by navigating to a protected page)",
                    loginUrl: finalUrl
                }
            }

            return {
                success: false,
                error: `Login response did not indicate success. finalUrl: ${finalUrl}, status: ${finalResponse.status}, hiddenFields: ${Object.keys(hiddenFields).join(",")}, cookies: ${cookieJar.length}`
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            if (msg.includes("TimeoutError") || msg.includes("aborted")) {
                return {
                    success: false,
                    error: "TeeOn server did not respond within 15 seconds. Please try again later."
                }
            }
            return { success: false, error: `Login failed: ${msg}` }
        }
    }
});
