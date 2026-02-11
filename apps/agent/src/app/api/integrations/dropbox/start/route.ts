import { NextResponse } from "next/server";
import { headers, cookies } from "next/headers";
import { auth } from "@repo/auth";
import { getUserOrganizationId } from "@/lib/organization";
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

        const credentials = getDropboxClientCredentials();
        const redirectUri = getDropboxRedirectUri();

        const { state, codeChallenge, cookieValue, cookieName } = generateOAuthState({
            organizationId,
            userId: session.user.id,
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
