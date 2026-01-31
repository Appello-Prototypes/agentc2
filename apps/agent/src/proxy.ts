import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth, getAppUrl } from "@repo/auth";

/**
 * Check if running in standalone mode (not behind Caddy proxy)
 * When standalone, we skip auth for demo pages
 */
const isStandalone = !process.env.NEXT_PUBLIC_APP_URL?.includes("catalyst.localhost");

/**
 * Proxy for Better Auth with Next.js 16 (Agent App)
 * Validates sessions and protects all agent routes
 * Note: Next.js 16 renamed middleware to proxy
 *
 * Important: With basePath="/agent", this proxy runs AFTER the basePath is stripped.
 * So requests to /agent/something appear as /something to this proxy.
 */
async function proxy(request: NextRequest) {
    // In standalone mode (Vercel deployment), allow public access to demos
    if (isStandalone) {
        return NextResponse.next();
    }

    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session) {
            // Redirect to frontend root (no /agent prefix needed - full URL)
            const baseUrl = getAppUrl("https://catalyst.localhost");
            return NextResponse.redirect(new URL("/", baseUrl));
        }

        return NextResponse.next();
    } catch (error) {
        // Log error and redirect to frontend root on auth failure
        console.error("Authentication error in agent proxy:", error);
        const baseUrl = getAppUrl("https://catalyst.localhost");
        return NextResponse.redirect(new URL("/", baseUrl));
    }
}

// Export as default proxy for Next.js 16
export default proxy;

/**
 * Route matcher configuration
 * Protects all agent routes except static assets
 * Note: All routes here are relative to /agent (basePath is already stripped)
 */
export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - api (API routes handle their own authentication for fine-grained control)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - .*\.* (any file with an extension like .txt, .xml, .json, .png, etc.)
         *
         * Note: API routes are excluded because they implement their own auth checks.
         * This allows each API endpoint to decide its own auth requirements
         * (e.g., some may be public, others require auth, some need specific roles).
         * See api/chat/route.ts for an example of route-level authentication.
         */
        "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"
    ]
};
