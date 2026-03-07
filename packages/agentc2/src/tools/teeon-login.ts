import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const BASE_URL = "https://www.tee-on.com/PubGolf/servlet/";
const LOGIN_PAGE = "com.teeon.teesheet.servlets.golfersection.SignInGolferSection";
const CHECK_SIGNIN_AJAX = "com.teeon.teesheet.servlets.ajax.CheckSignInCloudAjax";
const GOLFER_HOME = "com.teeon.teesheet.servlets.golfersection.GolferSectionHome";

const FETCH_TIMEOUT_MS = 15_000;
const UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function parseInputFields(html: string): Record<string, string> {
    const fields: Record<string, string> = {};
    const regex = /<input[^>]*>/gi;
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

function collectCookies(response: Response, jar: string[]): void {
    const setCookies = response.headers.getSetCookie?.() || [];
    for (const c of setCookies) {
        const nameValue = c.split(";")[0];
        if (!nameValue) continue;
        const cookieName = nameValue.split("=")[0];
        const idx = jar.findIndex((e) => e.split("=")[0] === cookieName);
        if (idx >= 0) jar[idx] = nameValue;
        else jar.push(nameValue);
    }
}

async function followRedirects(
    response: Response,
    jar: string[],
    maxHops = 5
): Promise<{ finalResponse: Response; finalUrl: string }> {
    let current = response;
    let currentUrl = response.url;
    for (let i = 0; i < maxHops; i++) {
        if (![301, 302, 303, 307, 308].includes(current.status)) break;
        collectCookies(current, jar);
        const location = current.headers.get("Location");
        if (!location) break;
        const nextUrl = new URL(location, currentUrl).toString();
        current = await fetch(nextUrl, {
            method: "GET",
            redirect: "manual",
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            headers: {
                "User-Agent": UA,
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                Cookie: jar.join("; ")
            }
        });
        currentUrl = nextUrl;
    }
    collectCookies(current, jar);
    return { finalResponse: current, finalUrl: currentUrl };
}

export const teeonLoginTool = createTool({
    id: "teeon-login",
    description:
        "Log in to TeeOn (tee-on.com) using HTTP requests. Returns the session cookie (JSESSIONID) " +
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
            const cookieJar: string[] = [];

            // Step 1: GET the login page to obtain session cookie and hidden fields
            const pageUrl = `${BASE_URL}${LOGIN_PAGE}?FromTeeOn=true&GrabFocus=true&LoginType=${loginType}`;
            const pageResponse = await fetch(pageUrl, {
                method: "GET",
                redirect: "manual",
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
                headers: { "User-Agent": UA, Accept: "text/html" }
            });

            const { finalResponse: getResult } = await followRedirects(pageResponse, cookieJar);

            if (getResult.status >= 400) {
                return {
                    success: false,
                    error: `Failed to load login page: HTTP ${getResult.status}`
                };
            }

            const pageHtml = await getResult.text();
            const formFields = parseInputFields(pageHtml);

            // Step 2: AJAX credential check (mirrors doLogin() JavaScript)
            // TeeOn's doLogin() does: encodeURIComponent(value) into a hidden input,
            // then jQuery .serialize() encodes again. We replicate this double-encoding
            // by manually building the body string.
            const ajaxUrl = `${BASE_URL}${CHECK_SIGNIN_AJAX}`;

            // Try two encoding strategies: TeeOn's double-encode first, then single-encode fallback
            const encodingStrategies = [
                {
                    name: "double-encode",
                    body: `Username=${encodeURIComponent(encodeURIComponent(username))}&Password=${encodeURIComponent(encodeURIComponent(password))}&SaveSignIn=false&CourseCode=`
                },
                {
                    name: "single-encode",
                    body: `Username=${encodeURIComponent(username)}&Password=${encodeURIComponent(password)}&SaveSignIn=false&CourseCode=`
                }
            ];

            let ajaxResult: { success?: number; message?: string } = {};
            let lastError = "";

            for (const strategy of encodingStrategies) {
                const ajaxResponse = await fetch(ajaxUrl, {
                    method: "POST",
                    redirect: "manual",
                    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
                    headers: {
                        "Content-Type":
                            "application/x-www-form-urlencoded; charset=UTF-8",
                        "User-Agent": UA,
                        Accept: "application/json, text/javascript, */*; q=0.01",
                        "X-Requested-With": "XMLHttpRequest",
                        Referer: pageUrl,
                        Origin: "https://www.tee-on.com",
                        Cookie: cookieJar.join("; ")
                    },
                    body: strategy.body
                });

                collectCookies(ajaxResponse, cookieJar);

                const ajaxText = await ajaxResponse.text();
                try {
                    ajaxResult = JSON.parse(ajaxText);
                } catch {
                    lastError = `Unexpected AJAX response (not JSON, strategy=${strategy.name}): ${ajaxText.substring(0, 300)}`;
                    continue;
                }

                if (ajaxResult.success === 1 || ajaxResult.success === 2) {
                    break;
                }

                lastError = `strategy=${strategy.name}: ${JSON.stringify(ajaxResult)}`;
            }

            if (ajaxResult.success === 2) {
                return {
                    success: false,
                    error: "TeeOn requires multi-factor authentication (MFA). Please log in manually at tee-on.com first."
                };
            }

            if (ajaxResult.success !== 1) {
                return {
                    success: false,
                    error: `Login failed. Tried both encoding strategies. Last: ${lastError}. Cookies: ${cookieJar.length}`
                };
            }

            // Step 3: AJAX succeeded (success=1) — submit form to GolferSectionHome
            const formUrl = `${BASE_URL}${GOLFER_HOME}`;
            const formData = new URLSearchParams();
            formData.append("Username", username);
            formData.append("Password", password);
            for (const [key, value] of Object.entries(formFields)) {
                if (key !== "Username" && key !== "Password") {
                    formData.append(key, value);
                }
            }

            const formResponse = await fetch(formUrl, {
                method: "POST",
                redirect: "manual",
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": UA,
                    Accept: "text/html",
                    Referer: pageUrl,
                    Cookie: cookieJar.join("; ")
                },
                body: formData.toString()
            });

            const { finalResponse, finalUrl } = await followRedirects(formResponse, cookieJar);

            const responseHtml = await finalResponse.text();
            const jsessionId = cookieJar
                .find((c) => c.startsWith("JSESSIONID="))
                ?.split("=")
                .slice(1)
                .join("=");

            const hasWelcome = /Welcome\s+\w+/i.test(responseHtml);
            const welcomeMatch = responseHtml.match(/Welcome\s+(\w+)/i);

            return {
                success: true,
                sessionCookie: jsessionId || "",
                allCookies: cookieJar.join("; "),
                welcomeMessage: hasWelcome
                    ? welcomeMatch![0]
                    : "Login successful (credential check passed)",
                loginUrl: finalUrl
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
