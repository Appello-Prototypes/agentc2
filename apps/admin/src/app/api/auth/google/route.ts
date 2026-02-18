import { NextRequest, NextResponse } from "next/server";
import {
    generateOAuthState,
    getGoogleAuthUrl,
    isGoogleSsoEnabled,
    checkLoginRateLimit,
    recordFailedLogin
} from "@repo/admin-auth";

export async function GET(request: NextRequest) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    const rateLimit = checkLoginRateLimit(ip);
    if (!rateLimit.allowed) {
        const retryAfterSec = Math.ceil((rateLimit.retryAfterMs || 0) / 1000);
        recordFailedLogin(ip);
        return NextResponse.json(
            { error: rateLimit.reason || "Too many requests" },
            {
                status: 429,
                headers: { "Retry-After": String(retryAfterSec) }
            }
        );
    }

    if (!isGoogleSsoEnabled()) {
        return NextResponse.json({ error: "Google SSO is not configured" }, { status: 501 });
    }

    const { signature } = generateOAuthState();
    const authUrl = getGoogleAuthUrl(signature);

    const callbackUrl = request.nextUrl.searchParams.get("callbackUrl") || "/";

    const response = NextResponse.redirect(authUrl);

    response.cookies.set("admin-oauth-state", signature, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 600 // 10 minutes
    });

    response.cookies.set("admin-oauth-callback", callbackUrl, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 600
    });

    return response;
}
