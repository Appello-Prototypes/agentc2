import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@repo/admin-auth";
import { ADMIN_SETTING_KEYS, upsertAdminSetting } from "@/lib/admin-settings";
import { encryptCredentials } from "@/lib/credential-crypto";
import { exchangeGitHubCode, fetchGitHubUser } from "@/lib/github-oauth";

const ADMIN_URL = process.env.ADMIN_URL || "https://agentc2.ai/admin";

function resolveRedirectTarget(request: NextRequest) {
    const callbackPath = request.cookies.get("admin-github-oauth-callback")?.value || "/settings";
    const safePath = callbackPath.startsWith("/") ? callbackPath : "/settings";
    return new URL(`${ADMIN_URL}${safePath}`);
}

function cleanupOAuthCookies(response: NextResponse) {
    response.cookies.delete("admin-github-oauth-state");
    response.cookies.delete("admin-github-oauth-callback");
}

export async function GET(request: NextRequest) {
    const redirectTarget = resolveRedirectTarget(request);
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const error = request.nextUrl.searchParams.get("error");
    const storedState = request.cookies.get("admin-github-oauth-state")?.value;

    if (error) {
        redirectTarget.searchParams.set("error", "GitHub authorization was cancelled or denied.");
        const response = NextResponse.redirect(redirectTarget);
        cleanupOAuthCookies(response);
        return response;
    }

    if (!code || !state || !storedState || state !== storedState) {
        redirectTarget.searchParams.set("error", "Invalid GitHub OAuth callback parameters.");
        const response = NextResponse.redirect(redirectTarget);
        cleanupOAuthCookies(response);
        return response;
    }

    try {
        const admin = await requireAdmin(request, "platform_admin");
        const accessToken = await exchangeGitHubCode(code);
        const user = await fetchGitHubUser(accessToken);

        await upsertAdminSetting(
            ADMIN_SETTING_KEYS.githubConnection,
            {
                username: user.login,
                avatarUrl: user.avatar_url,
                connectedAt: new Date().toISOString(),
                accessToken: encryptCredentials({ token: accessToken })
            },
            admin.adminUserId
        );

        redirectTarget.searchParams.set("github", "connected");
        const response = NextResponse.redirect(redirectTarget);
        cleanupOAuthCookies(response);
        return response;
    } catch (err) {
        const message =
            err instanceof AdminAuthError
                ? err.message
                : err instanceof Error
                  ? err.message
                  : "GitHub connection failed";
        redirectTarget.searchParams.set("error", message);
        const response = NextResponse.redirect(redirectTarget);
        cleanupOAuthCookies(response);
        return response;
    }
}
