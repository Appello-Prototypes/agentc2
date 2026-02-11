import { NextResponse } from "next/server";
import { headers, cookies } from "next/headers";
import { auth } from "@repo/auth";
import { getUserOrganizationId } from "@/lib/organization";
import { generateOAuthState } from "@/lib/oauth-security";
import {
    getMicrosoftClientCredentials,
    buildAuthorizationUrl,
    getMicrosoftRedirectUri
} from "@/lib/microsoft-oauth";

/**
 * GET /api/integrations/microsoft/start
 *
 * Initiates Microsoft OAuth flow with PKCE + signed state.
 * Redirects the user to the Microsoft consent screen.
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

        const credentials = getMicrosoftClientCredentials();
        const redirectUri = getMicrosoftRedirectUri();

        const { state, codeChallenge, cookieValue, cookieName } = generateOAuthState({
            organizationId,
            userId: session.user.id,
            providerKey: "microsoft"
        });

        const authUrl = buildAuthorizationUrl({
            clientId: credentials.clientId,
            tenantId: credentials.tenantId,
            redirectUri,
            state,
            codeChallenge
        });

        const cookieStore = await cookies();
        cookieStore.set(cookieName, cookieValue, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 600, // 10 minutes
            path: "/"
        });

        return NextResponse.redirect(authUrl);
    } catch (error) {
        console.error("[Microsoft OAuth Start] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to start Microsoft OAuth"
            },
            { status: 500 }
        );
    }
}
