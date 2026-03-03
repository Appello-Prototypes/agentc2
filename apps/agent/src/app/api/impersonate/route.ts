import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

/**
 * GET /api/impersonate?token=<session_token>
 *
 * Sets the Better Auth session cookie for an admin-created impersonation
 * session, then redirects to the workspace. The session token must already
 * exist in the Session table (created by the admin impersonate API).
 */
export async function GET(request: NextRequest) {
    const token = request.nextUrl.searchParams.get("token");
    if (!token) {
        return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const session = await prisma.session.findFirst({
        where: {
            token,
            expiresAt: { gt: new Date() }
        }
    });

    if (!session) {
        return NextResponse.json(
            { error: "Invalid or expired impersonation token" },
            { status: 403 }
        );
    }

    const isProduction = process.env.NODE_ENV === "production";
    const sessionCookieName = isProduction
        ? "__Secure-better-auth.session_token"
        : "better-auth.session_token";

    const redirectUrl = new URL("/workspace", APP_URL);
    const response = NextResponse.redirect(redirectUrl);

    response.cookies.set(sessionCookieName, token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/",
        maxAge: Math.floor((session.expiresAt.getTime() - Date.now()) / 1000)
    });

    return response;
}
