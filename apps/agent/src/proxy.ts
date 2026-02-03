import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";

/**
 * Check if running in standalone mode (not behind reverse proxy)
 * When standalone, we skip auth for demo pages
 *
 * Standalone mode is determined by:
 * 1. STANDALONE_DEMO=true (explicit override)
 * 2. Not running on catalyst.localhost (dev)
 */
function isStandaloneDeployment(request: NextRequest): boolean {
    // Explicit standalone mode
    if (process.env.STANDALONE_DEMO === "true") {
        return true;
    }

    // Fallback: check hostname for local dev (catalyst.localhost = behind Caddy)
    const host = request.headers.get("host") || "";
    return !host.includes("catalyst.localhost");
}

/**
 * Proxy for Better Auth with Next.js 16
 * Validates sessions and protects routes
 * Note: Next.js 16 renamed middleware to proxy
 */
async function proxy(request: NextRequest) {
    // In standalone mode, allow public access to demos
    if (isStandaloneDeployment(request)) {
        return NextResponse.next();
    }

    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session) {
            // Redirect to login page
            const url = request.nextUrl.clone();
            url.pathname = "/login";
            // Preserve the original URL as callback
            url.searchParams.set("callbackUrl", request.nextUrl.pathname);
            return NextResponse.redirect(url);
        }

        return NextResponse.next();
    } catch (error) {
        // Log error and redirect to login on auth failure
        console.error("Authentication error in proxy:", error);
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
    }
}

// Export as default proxy for Next.js 16
export default proxy;

/**
 * Route matcher configuration
 * Protects all routes except public paths
 */
export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - api (API routes handle their own authentication for fine-grained control)
         * - login (public login page)
         * - signup (public signup page)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - .*\.* (any file with an extension like .txt, .xml, .json, .png, etc.)
         *
         * Note: API routes are excluded because they implement their own auth checks.
         * This allows each API endpoint to decide its own auth requirements
         * (e.g., some may be public, others require auth, some need specific roles).
         */
        "/((?!api|login|signup|_next/static|_next/image|favicon.ico|.*\\..*).*)"
    ]
};
