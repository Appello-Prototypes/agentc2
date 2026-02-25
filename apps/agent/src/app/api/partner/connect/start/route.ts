import { OAuth2Client } from "google-auth-library";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyEmbedIdentity } from "@/lib/embed-identity";
import { generateOAuthState } from "@/lib/oauth-security";
import { getMicrosoftClientCredentials, buildAuthorizationUrl } from "@/lib/microsoft-oauth";

const SUPPORTED_PROVIDERS = new Set(["gmail", "microsoft"]);

function getPartnerCallbackUrl(request: NextRequest): string {
    const url = new URL("/api/partner/connect/callback", request.url);
    return url.toString();
}

/**
 * GET /api/partner/connect/start?provider=gmail&identity=signedToken&orgId=...
 *
 * Initiates an OAuth flow for a partner-embedded user.
 * Validates the identity token, then redirects to the provider's consent screen.
 * The callback redirects to /api/partner/connect/callback (not the standard routes).
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");
    const identityToken = searchParams.get("identity");
    const orgId = searchParams.get("orgId");

    if (!provider || !SUPPORTED_PROVIDERS.has(provider)) {
        return NextResponse.json(
            { error: `Unsupported provider. Use: ${[...SUPPORTED_PROVIDERS].join(", ")}` },
            { status: 400 }
        );
    }

    if (!identityToken || !orgId) {
        return NextResponse.json({ error: "Missing identity or orgId parameter" }, { status: 400 });
    }

    const identity = await verifyEmbedIdentity(identityToken, orgId);
    if (!identity) {
        return NextResponse.json({ error: "Invalid or expired identity token" }, { status: 403 });
    }

    if (!identity.mappedUserId) {
        return NextResponse.json(
            { error: "User account not provisioned. Chat first to auto-create your account." },
            { status: 400 }
        );
    }

    const { state, codeChallenge, cookieValue, cookieName } = generateOAuthState({
        organizationId: identity.organizationId,
        userId: identity.mappedUserId,
        providerKey: provider
    });

    const cookieStore = await cookies();
    cookieStore.set(cookieName, cookieValue, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 600,
        path: "/"
    });

    const partnerCallbackUrl = getPartnerCallbackUrl(request);

    if (provider === "gmail") {
        const clientId = process.env.GOOGLE_CLIENT_ID || process.env.GMAIL_OAUTH_CLIENT_ID;
        const clientSecret =
            process.env.GOOGLE_CLIENT_SECRET || process.env.GMAIL_OAUTH_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
            return NextResponse.json({ error: "Google OAuth not configured" }, { status: 500 });
        }

        const client = new OAuth2Client(clientId, clientSecret, partnerCallbackUrl);
        const { GOOGLE_REQUIRED_SCOPES } = await import("@repo/auth/google-scopes");
        const authUrl = client.generateAuthUrl({
            access_type: "offline",
            prompt: "consent",
            scope: [...GOOGLE_REQUIRED_SCOPES],
            state
        });
        return NextResponse.redirect(authUrl);
    }

    if (provider === "microsoft") {
        const credentials = getMicrosoftClientCredentials();
        const authUrl = buildAuthorizationUrl({
            clientId: credentials.clientId,
            tenantId: credentials.tenantId,
            redirectUri: partnerCallbackUrl,
            state,
            codeChallenge
        });
        return NextResponse.redirect(authUrl);
    }

    return NextResponse.json({ error: "Provider not implemented" }, { status: 501 });
}
