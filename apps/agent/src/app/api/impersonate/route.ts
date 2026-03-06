import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

const impersonationCodes = new Map<string, { sessionToken: string; expiresAt: number }>();

/**
 * POST /api/impersonate
 *
 * Admin creates a short-lived one-time code for impersonation.
 * The code is used via GET to exchange for a session cookie.
 */
export async function POST(request: NextRequest) {
    const authContext = await authenticateRequest(request);
    if (!authContext) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const membership = await prisma.membership.findFirst({
        where: { userId: authContext.userId, organizationId: authContext.organizationId },
        select: { role: true }
    });
    if (!membership || !["owner", "admin"].includes(membership.role)) {
        return NextResponse.json(
            { success: false, error: "Insufficient permissions: admin or owner role required" },
            { status: 403 }
        );
    }

    const body = await request.json();
    const sessionToken = body.token;
    if (!sessionToken) {
        return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const code = randomBytes(32).toString("hex");
    impersonationCodes.set(code, {
        sessionToken,
        expiresAt: Date.now() + 60_000
    });

    // Evict expired codes
    for (const [k, v] of impersonationCodes) {
        if (v.expiresAt < Date.now()) impersonationCodes.delete(k);
    }

    const impersonateUrl = new URL(`/api/impersonate?code=${code}`, APP_URL).toString();
    return NextResponse.json({ success: true, url: impersonateUrl });
}

/**
 * GET /api/impersonate?code=<one-time-code>
 *
 * Exchanges a one-time code for a session cookie. The code expires in 60s
 * and can only be used once, preventing token exposure in URLs/logs.
 */
export async function GET(request: NextRequest) {
    const code = request.nextUrl.searchParams.get("code");
    if (!code) {
        return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }

    const entry = impersonationCodes.get(code);
    impersonationCodes.delete(code);

    if (!entry || entry.expiresAt < Date.now()) {
        return NextResponse.json(
            { error: "Invalid or expired impersonation code" },
            { status: 403 }
        );
    }

    const token = entry.sessionToken;

    const session = await prisma.session.findFirst({
        where: {
            token,
            expiresAt: { gt: new Date() }
        },
        include: { user: { select: { name: true, email: true } } }
    });

    if (!session) {
        return NextResponse.json(
            { error: "Invalid or expired impersonation session" },
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
