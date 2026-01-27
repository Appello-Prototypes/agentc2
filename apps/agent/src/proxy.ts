import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";

/**
 * Proxy for Better Auth with Next.js 16 (Agent App)
 * Validates sessions and protects all agent routes
 * Note: Next.js 16 renamed middleware to proxy
 *
 * Important: With basePath="/agent", this proxy runs AFTER the basePath is stripped.
 * So requests to /agent/something appear as /something to this proxy.
 */
async function proxy(_request: NextRequest) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        // Redirect to frontend root (no /agent prefix needed - full URL)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catalyst.localhost";
        return NextResponse.redirect(new URL("/", baseUrl));
    }

    return NextResponse.next();
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
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        "/((?!_next/static|_next/image|favicon.ico).*)"
    ]
};
