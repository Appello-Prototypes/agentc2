import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/integrations/gmail/start
 *
 * Redirects to Gmail OAuth consent screen.
 */
export async function GET(request: NextRequest) {
    const redirectUrl = new URL("/mcp/gmail", request.url);
    redirectUrl.searchParams.set(
        "gmailError",
        "Gmail now uses Google sign-in. Please reconnect from Integrations."
    );
    return NextResponse.redirect(redirectUrl);
}
