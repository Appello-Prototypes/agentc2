import { NextRequest, NextResponse } from "next/server";
import { validateAdminSession, getAdminTokenFromRequest } from "@repo/admin-auth";

/**
 * Admin portal proxy (middleware).
 * Validates admin sessions and protects all routes except login/api.
 */
async function proxy(request: NextRequest) {
    try {
        const token = getAdminTokenFromRequest(request);
        if (!token) {
            return redirectToLogin(request);
        }

        const session = await validateAdminSession(token);
        if (!session) {
            return redirectToLogin(request);
        }

        return NextResponse.next();
    } catch (error) {
        console.error("[Admin Proxy] Authentication error:", error);
        return redirectToLogin(request);
    }
}

function redirectToLogin(request: NextRequest) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(url);
}

export default proxy;

export const config = {
    matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico|.*\\..*).*)"]
};
