import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUserWithOrg } from "@/lib/authz/require-auth";
import { generateOAuthState } from "@/lib/oauth-security";
import {
    getDropboxClientCredentials,
    buildDropboxAuthorizationUrl,
    getDropboxRedirectUri
} from "@/lib/dropbox";

/**
 * GET /api/integrations/dropbox/start
 *
 * Initiates Dropbox OAuth flow with PKCE + signed state.
 */
export async function GET() {
    try {
        const authResult = await requireUserWithOrg();
        if (authResult.response) return authResult.response;

        const { userId, organizationId } = authResult.context;

        const credentials = getDropboxClientCredentials();
        const redirectUri = getDropboxRedirectUri();

        const { state, codeChallenge, cookieValue, cookieName } = generateOAuthState({
            organizationId,
            userId,
            providerKey: "dropbox"
        });

        const authUrl = buildDropboxAuthorizationUrl({
            appKey: credentials.appKey,
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

        return NextResponse.redirect(authUrl);
    } catch (error) {
        console.error("[Dropbox OAuth Start] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to start Dropbox OAuth"
            },
            { status: 500 }
        );
    }
}
