import { NextRequest, NextResponse } from "next/server";
import {
    verifyOAuthState,
    exchangeAndVerifyGoogleCode,
    adminLoginWithGoogle,
    AdminAuthError,
    ADMIN_COOKIE_NAME,
    checkLoginRateLimit,
    recordFailedLogin,
    clearLoginRateLimit
} from "@repo/admin-auth";

export async function GET(request: NextRequest) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const userAgent = request.headers.get("user-agent") || undefined;

    const rateLimit = checkLoginRateLimit(ip);
    if (!rateLimit.allowed) {
        return redirectWithError(request, "Too many login attempts. Please try again later.");
    }

    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const error = request.nextUrl.searchParams.get("error");

    if (error) {
        return redirectWithError(request, "Google sign-in was cancelled or denied.");
    }

    if (!code || !state) {
        recordFailedLogin(ip);
        return redirectWithError(request, "Invalid OAuth callback parameters.");
    }

    const storedState = request.cookies.get("admin-oauth-state")?.value;
    if (!storedState || storedState !== state || !verifyOAuthState(state)) {
        recordFailedLogin(ip);
        return redirectWithError(request, "Invalid security token. Please try signing in again.");
    }

    try {
        const googleUser = await exchangeAndVerifyGoogleCode(code);

        const { token } = await adminLoginWithGoogle(
            googleUser.email,
            googleUser.googleId,
            ip,
            userAgent
        );

        clearLoginRateLimit(ip, googleUser.email);

        const callbackUrl = request.cookies.get("admin-oauth-callback")?.value || "/";

        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = callbackUrl;
        redirectUrl.search = "";

        const response = NextResponse.redirect(redirectUrl);

        response.cookies.set(ADMIN_COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 12 * 60 * 60 // 12 hours
        });

        response.cookies.delete("admin-oauth-state");
        response.cookies.delete("admin-oauth-callback");

        return response;
    } catch (err) {
        recordFailedLogin(ip);

        if (err instanceof AdminAuthError) {
            return redirectWithError(request, err.message);
        }

        console.error("[Admin Google SSO] Callback error:", err);
        return redirectWithError(request, "Google sign-in failed. Please try again.");
    }
}

function redirectWithError(request: NextRequest, message: string) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("error", message);

    const response = NextResponse.redirect(url);
    response.cookies.delete("admin-oauth-state");
    response.cookies.delete("admin-oauth-callback");
    return response;
}
