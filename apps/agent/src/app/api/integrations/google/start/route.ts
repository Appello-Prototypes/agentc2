import { NextRequest, NextResponse } from "next/server";
import { headers, cookies } from "next/headers";
import { auth } from "@repo/auth";
import { getUserOrganizationId } from "@/lib/organization";
import { generateOAuthState, setReturnUrlCookie } from "@/lib/oauth-security";
import {
    getGoogleClientCredentials,
    buildGoogleAuthorizationUrl,
    getGoogleRedirectUri
} from "@/lib/google-oauth";

/**
 * GET /api/integrations/google/start
 *
 * Initiates standalone Google OAuth flow with PKCE + signed state.
 * Bypasses Better Auth's Account table — tokens are stored directly
 * in IntegrationConnection (org-scoped) via the callback route.
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const organizationId = await getUserOrganizationId(session.user.id);
        if (!organizationId) {
            return NextResponse.json(
                { success: false, error: "Organization membership required" },
                { status: 403 }
            );
        }

        const credentials = getGoogleClientCredentials();
        const redirectUri = getGoogleRedirectUri();

        const { state, codeChallenge, cookieValue, cookieName } = generateOAuthState({
            organizationId,
            userId: session.user.id,
            providerKey: "google"
        });

        const authUrl = buildGoogleAuthorizationUrl({
            clientId: credentials.clientId,
            redirectUri,
            state,
            codeChallenge
        });

        const cookieStore = await cookies();
        cookieStore.set(cookieName, cookieValue, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 600,
            path: "/"
        });

        const { searchParams } = new URL(request.url);
        const returnUrl = searchParams.get("returnUrl");
        if (returnUrl) {
            setReturnUrlCookie(cookieStore, returnUrl);
        }

        return NextResponse.redirect(authUrl);
    } catch (error) {
        console.error("[Google OAuth Start] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to start Google OAuth"
            },
            { status: 500 }
        );
    }
}
