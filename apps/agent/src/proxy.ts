import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { getUserMembership } from "@/lib/organization";

/**
 * Check if running in standalone mode (not behind reverse proxy)
 * When standalone, we skip auth for demo pages
 *
 * Standalone mode is determined by:
 * 1. STANDALONE_DEMO=true (explicit override)
 */
function isStandaloneDeployment(): boolean {
    return process.env.STANDALONE_DEMO === "true" && process.env.NODE_ENV !== "production";
}

/**
 * Proxy for Better Auth with Next.js 16
 * Validates sessions and protects routes
 * Note: Next.js 16 renamed middleware to proxy
 */
async function proxy(request: NextRequest) {
    // Root page: redirect authenticated users to /workspace, otherwise show public landing
    if (request.nextUrl.pathname === "/") {
        try {
            const session = await auth.api.getSession({
                headers: await headers()
            });
            if (session) {
                const url = request.nextUrl.clone();
                url.pathname = "/workspace";
                return NextResponse.redirect(url);
            }
        } catch {
            // Auth check failed — fall through to public landing
        }
        return NextResponse.next();
    }

    // In standalone mode, allow public access only to demo and auth pages.
    if (isStandaloneDeployment()) {
        const publicStandalonePrefixes = ["/demos", "/embed", "/embed-v2", "/login", "/signup"];
        const isPublicStandalone = publicStandalonePrefixes.some((prefix) =>
            request.nextUrl.pathname.startsWith(prefix)
        );
        if (isPublicStandalone) {
            return NextResponse.next();
        }
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

        const membership = await getUserMembership(session.user.id);
        const onboardingComplete = Boolean(membership?.onboardingCompletedAt);
        const pathname = request.nextUrl.pathname;

        if (!onboardingComplete && !pathname.startsWith("/onboarding")) {
            const url = request.nextUrl.clone();
            url.pathname = "/onboarding";
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
         * - terms (public Terms of Service)
         * - privacy (public Privacy Policy)
         * - security (public Security Policy)
         * - authorize (OAuth authorization endpoint for MCP server)
         * - token (OAuth token endpoint for MCP server)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - .*\.* (any file with an extension like .txt, .xml, .json, .png, etc.)
         *
         * Note: API routes are excluded because they implement their own auth checks.
         * This allows each API endpoint to decide its own auth requirements
         * (e.g., some may be public, others require auth, some need specific roles).
         */
        "/((?!api|embed|embed-v2|login|signup|waitlist|terms$|privacy$|security$|authorize|token|_next/static|_next/image|favicon.ico|.*\\..*).*)"
    ]
};
