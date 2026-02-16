import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateOAuthState } from "@/lib/oauth-security";

/**
 * GET /api/slack/install
 *
 * Initiates the Slack OAuth V2 flow.
 * Requires organizationId and userId as query params (from the platform UI).
 * Redirects the user to Slack's authorization page.
 *
 * Optional: mode=popup — stores popup mode in state so the callback can
 * render a postMessage page instead of a full redirect.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const userId = searchParams.get("userId");
    const mode = searchParams.get("mode"); // "popup" for inline OAuth

    if (!organizationId || !userId) {
        return NextResponse.json(
            { error: "organizationId and userId are required" },
            { status: 400 }
        );
    }

    const clientId = process.env.SLACK_CLIENT_ID;
    if (!clientId) {
        return NextResponse.json({ error: "SLACK_CLIENT_ID not configured" }, { status: 500 });
    }

    // Generate CSRF-protected state with PKCE
    const { state, cookieValue, cookieName } = generateOAuthState({
        organizationId,
        userId,
        providerKey: "slack"
    });

    // Build Slack OAuth V2 authorization URL
    const scopes = [
        "app_mentions:read",
        "chat:write",
        "chat:write.customize",
        "im:history",
        "im:read",
        "im:write",
        "channels:history",
        "channels:read",
        "users:read"
    ].join(",");

    // Determine the redirect URI
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    const redirectUri = `${appUrl}/api/slack/callback`;

    const authorizeUrl = new URL("https://slack.com/oauth/v2/authorize");
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("scope", scopes);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("state", state);

    // Set the state cookie
    const cookieStore = await cookies();
    cookieStore.set(cookieName, cookieValue, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 600, // 10 minutes
        path: "/"
    });

    // Set popup mode flag so the callback knows to render postMessage instead of redirect
    if (mode === "popup") {
        cookieStore.set("__oauth_popup_mode", "true", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 600,
            path: "/"
        });
    }

    return NextResponse.redirect(authorizeUrl.toString());
}
