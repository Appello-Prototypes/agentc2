import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@repo/admin-auth";
import { generateGitHubState, getGitHubAuthUrl, isGitHubOAuthConfigured } from "@/lib/github-oauth";

export async function GET(request: NextRequest) {
    try {
        await requireAdmin(request, "platform_admin");

        if (!isGitHubOAuthConfigured()) {
            return NextResponse.json({ error: "GitHub OAuth is not configured" }, { status: 501 });
        }

        const state = generateGitHubState();
        const authUrl = getGitHubAuthUrl(state);
        const callbackUrl = request.nextUrl.searchParams.get("callbackUrl") || "/settings";
        const response = NextResponse.redirect(authUrl);

        response.cookies.set("admin-github-oauth-state", state, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 600
        });
        response.cookies.set("admin-github-oauth-callback", callbackUrl, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 600
        });

        return response;
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
