import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

/**
 * GET /api/impersonate?token=<session_token>
 *
 * Sets the Better Auth session cookie for an admin-created impersonation
 * session, then navigates to the workspace. Returns an HTML page (not a
 * redirect) so the browser fully processes Set-Cookie headers before
 * navigating — avoids edge cases where redirect + Set-Cookie race.
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
        },
        include: { user: { select: { name: true, email: true } } }
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
    const cacheCookieName = isProduction
        ? "__Secure-better-auth.session_data"
        : "better-auth.session_data";

    const workspaceUrl = new URL("/workspace", APP_URL).toString();
    const displayName = session.user.name || session.user.email;

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Signing in…</title></head>
<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0a0a0a;color:#fafafa">
<p>Signing in as <strong>${displayName}</strong>…</p>
<script>window.location.replace(${JSON.stringify(workspaceUrl)})</script>
</body></html>`;

    const maxAge = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);

    const response = new NextResponse(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" }
    });

    response.cookies.set(sessionCookieName, token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/",
        maxAge
    });

    // Clear any stale session cache so Better Auth does a fresh DB lookup
    response.cookies.delete(cacheCookieName);

    return response;
}
