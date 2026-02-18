import { OAuth2Client } from "google-auth-library";
import crypto from "crypto";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

interface GoogleOAuthConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}

function getConfig(): GoogleOAuthConfig {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const adminUrl = process.env.ADMIN_URL || "https://agentc2.ai/admin";

    if (!clientId || !clientSecret) {
        throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required for Google SSO");
    }

    return {
        clientId,
        clientSecret,
        redirectUri: `${adminUrl}/api/auth/google/callback`
    };
}

/**
 * Generate a CSRF state token for the OAuth flow.
 * Returns both the token and an HMAC signature for verification.
 */
export function generateOAuthState(): { state: string; signature: string } {
    const state = crypto.randomBytes(32).toString("hex");
    const secret = process.env.BETTER_AUTH_SECRET || process.env.GOOGLE_CLIENT_SECRET || "";
    const signature = crypto.createHmac("sha256", secret).update(state).digest("hex");
    return { state, signature: `${state}.${signature}` };
}

/**
 * Verify a CSRF state token from the OAuth callback.
 */
export function verifyOAuthState(signedState: string): boolean {
    const parts = signedState.split(".");
    if (parts.length !== 2) return false;
    const [state, signature] = parts;
    const secret = process.env.BETTER_AUTH_SECRET || process.env.GOOGLE_CLIENT_SECRET || "";
    const expectedSignature = crypto.createHmac("sha256", secret).update(state!).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(signature!), Buffer.from(expectedSignature));
}

/**
 * Generate Google OAuth authorization URL for admin login.
 * Uses minimal scopes — only email and profile (no Drive/Calendar/Gmail).
 */
export function getGoogleAuthUrl(signedState: string): string {
    const config = getConfig();

    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: "code",
        scope: "openid email profile",
        state: signedState,
        access_type: "online",
        prompt: "select_account"
    });

    return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

export interface GoogleUserInfo {
    email: string;
    name: string;
    picture: string | null;
    googleId: string;
}

/**
 * Exchange authorization code for tokens and verify the ID token.
 * Returns verified user info from Google.
 */
export async function exchangeAndVerifyGoogleCode(code: string): Promise<GoogleUserInfo> {
    const config = getConfig();

    const client = new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri);

    const { tokens } = await client.getToken(code);

    if (!tokens.id_token) {
        throw new Error("No ID token received from Google");
    }

    const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: config.clientId
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
        throw new Error("Invalid ID token: missing email claim");
    }

    if (!payload.email_verified) {
        throw new Error("Google email is not verified");
    }

    return {
        email: payload.email.toLowerCase(),
        name: payload.name || payload.email,
        picture: payload.picture || null,
        googleId: payload.sub!
    };
}

/**
 * Check if Google SSO is configured (both client ID and secret are present).
 */
export function isGoogleSsoEnabled(): boolean {
    return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
