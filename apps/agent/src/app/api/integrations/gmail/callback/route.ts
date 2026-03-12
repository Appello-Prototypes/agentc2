import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/integrations/gmail/callback
 *
 * OAuth callback for Gmail integration.
 */
export async function GET(_request: NextRequest) {
    const appBase = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    const redirectUrl = new URL("/mcp/gmail", appBase);
    redirectUrl.searchParams.set(
        "gmailError",
        "Gmail now uses Google sign-in. Please reconnect from Integrations."
    );
    return NextResponse.redirect(redirectUrl);
}
