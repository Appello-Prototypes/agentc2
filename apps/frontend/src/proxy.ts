import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";

/**
 * Proxy for Better Auth with Next.js 16
 * Validates sessions and protects authenticated routes
 * Note: Next.js 16 renamed middleware to proxy
 */
async function proxy(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
}

// Export as default proxy for Next.js 16
export default proxy;

/**
 * Route matcher configuration
 * Protects all routes except:
 * - Public root page (/)
 * - Sign up page (/signup)
 * - Auth API endpoints (/api/auth/*)
 * - Static assets (_next/*, favicon.ico, etc.)
 */
export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - / (root/landing page)
         * - /signup (registration page)
         * - /api/auth/* (Better Auth endpoints)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        "/((?!api/auth|_next/static|_next/image|favicon.ico|signup$|^$).*)"
    ]
};
