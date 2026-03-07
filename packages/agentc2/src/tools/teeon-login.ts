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
        try {
            // Step 1: GET the login page to obtain session cookie and hidden fields
            const pageUrl = `${LOGIN_URL}?FromTeeOn=true&GrabFocus=true&LoginType=${loginType}`;
            const pageResponse = await fetch(pageUrl, {
                method: "GET",
                redirect: "follow",
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
                }
            });

            if (!pageResponse.ok) {
                return {
                    success: false,
                    error: `Failed to load login page: HTTP ${pageResponse.status}`
                };
            }

            // Collect cookies from the GET response
            const getCookies = pageResponse.headers.getSetCookie?.() || [];
            const cookieJar: string[] = [];
            for (const c of getCookies) {
                const nameValue = c.split(";")[0];
                if (nameValue) cookieJar.push(nameValue);
            }

            const pageHtml = await pageResponse.text();
            const hiddenFields = parseHiddenFields(pageHtml);

            // Step 2: POST the login form
            const formData = new URLSearchParams();
            formData.append("Username", username);
            formData.append("Password", password);
            for (const [key, value] of Object.entries(hiddenFields)) {
                formData.append(key, value);
            }

            const loginResponse = await fetch(LOGIN_URL, {
                method: "POST",
                redirect: "follow",
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent":
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    Referer: pageUrl,
                    Cookie: cookieJar.join("; ")
                }
            });

            // Collect cookies from the POST response
            const postCookies = loginResponse.headers.getSetCookie?.() || [];
            for (const c of postCookies) {
                const nameValue = c.split(";")[0];
                if (nameValue) {
                    const existingIdx = cookieJar.findIndex(
                        (existing) => existing.split("=")[0] === nameValue.split("=")[0]
                    );
                    if (existingIdx >= 0) {
                        cookieJar[existingIdx] = nameValue;
                    } else {
                        cookieJar.push(nameValue);
                    }
                }
            }

            const responseHtml = await loginResponse.text();
            const finalUrl = loginResponse.url;

            // Step 3: Check for login success
            const isOnGolferSection =
                finalUrl.includes("GolferSection") && !finalUrl.includes("SignIn");
            const hasWelcome = /Welcome\s+\w+/i.test(responseHtml);
            const hasSignInFailed = /Sign In Failed|Invalid username or password/i.test(
                responseHtml
            );

            if (hasSignInFailed) {
                return {
                    success: false,
                    error: "Invalid username or password. Please verify your TeeOn credentials."
                };
            }

            // Extract JSESSIONID
            const jsessionId = cookieJar
                .find((c) => c.startsWith("JSESSIONID="))
                ?.split("=")
                .slice(1)
                .join("=");

            if (isOnGolferSection || hasWelcome) {
                const welcomeMatch = responseHtml.match(/Welcome\s+(\w+)/i);
                return {
                    success: true,
                    sessionCookie: jsessionId || "",
                    allCookies: cookieJar.join("; "),
                    welcomeMessage: welcomeMatch ? welcomeMatch[0] : "Login successful",
                    loginUrl: finalUrl
                };
            }

            // Ambiguous result: no clear success or failure indicator
            if (jsessionId) {
                return {
                    success: true,
                    sessionCookie: jsessionId,
                    allCookies: cookieJar.join("; "),
                    welcomeMessage: "Session obtained (verify by navigating to a protected page)",
                    loginUrl: finalUrl
                };
            }

            return {
                success: false,
                error: "Login response did not indicate success. The page may have changed or credentials may be incorrect."
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            if (msg.includes("TimeoutError") || msg.includes("aborted")) {
                return {
                    success: false,
                    error: "TeeOn server did not respond within 15 seconds. Please try again later."
                };
            }
            return { success: false, error: `Login failed: ${msg}` };
        }
    }
});
