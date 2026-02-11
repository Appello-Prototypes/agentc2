/**
 * OAuth Security Module
 *
 * Provides CSRF protection via HMAC-signed state parameters
 * and PKCE (Proof Key for Code Exchange) for all standalone
 * OAuth flows (Microsoft, Dropbox, etc.).
 *
 * State is stored in an HTTP-only cookie so the callback
 * route can validate the round-trip without server-side storage.
 */

import { createHmac, randomBytes, createHash } from "crypto";

// ── Constants ──────────────────────────────────────────────────────

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const COOKIE_NAME = "__oauth_state";
const HMAC_ALGORITHM = "sha256";

// ── Types ──────────────────────────────────────────────────────────

export type OAuthStatePayload = {
    organizationId: string;
    userId: string;
    providerKey: string;
    nonce: string;
    expiresAt: number;
    codeVerifier: string;
};

export type GenerateOAuthStateResult = {
    /** URL-safe state query parameter value */
    state: string;
    /** PKCE code_verifier (stored in cookie, sent during token exchange) */
    codeVerifier: string;
    /** PKCE code_challenge (sent in authorization URL) */
    codeChallenge: string;
    /** Serialized cookie value to set as HTTP-only cookie */
    cookieValue: string;
    /** Cookie name constant */
    cookieName: string;
};

export type ValidatedOAuthState = {
    organizationId: string;
    userId: string;
    providerKey: string;
    codeVerifier: string;
};

// ── Helpers ────────────────────────────────────────────────────────

function getSigningKey(): string {
    const key = process.env.BETTER_AUTH_SECRET;
    if (!key) {
        throw new Error("[OAuth Security] BETTER_AUTH_SECRET is required for OAuth state signing");
    }
    return key;
}

function hmacSign(data: string): string {
    return createHmac(HMAC_ALGORITHM, getSigningKey()).update(data).digest("base64url");
}

function hmacVerify(data: string, signature: string): boolean {
    const expected = hmacSign(data);
    // Constant-time comparison
    if (expected.length !== signature.length) return false;
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

/**
 * Generate a PKCE code_verifier (43-128 URL-safe characters).
 */
function generateCodeVerifier(): string {
    // 32 random bytes -> 43 base64url chars
    return randomBytes(32).toString("base64url");
}

/**
 * Derive PKCE code_challenge from code_verifier via SHA-256.
 */
function generateCodeChallenge(verifier: string): string {
    return createHash("sha256").update(verifier).digest("base64url");
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Generate a signed OAuth state parameter and PKCE pair.
 *
 * Usage in /start route:
 * ```ts
 * const { state, codeChallenge, cookieValue, cookieName } = generateOAuthState({
 *     organizationId, userId, providerKey: "microsoft"
 * })
 * // Set cookie
 * response.cookies.set(cookieName, cookieValue, { ... })
 * // Redirect to provider with state + code_challenge
 * ```
 */
export function generateOAuthState(params: {
    organizationId: string;
    userId: string;
    providerKey: string;
}): GenerateOAuthStateResult {
    const nonce = randomBytes(16).toString("hex");
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    const payload: OAuthStatePayload = {
        organizationId: params.organizationId,
        userId: params.userId,
        providerKey: params.providerKey,
        nonce,
        expiresAt: Date.now() + STATE_TTL_MS,
        codeVerifier
    };

    const payloadJson = JSON.stringify(payload);
    const signature = hmacSign(payloadJson);

    // State query param = base64url(payload JSON)
    const stateParam = Buffer.from(payloadJson).toString("base64url");

    // Cookie = base64url(payload JSON) + "." + HMAC signature
    // The cookie contains the full payload + signature for validation
    const cookieValue = `${stateParam}.${signature}`;

    return {
        state: stateParam,
        codeVerifier,
        codeChallenge,
        cookieValue,
        cookieName: COOKIE_NAME
    };
}

/**
 * Validate the OAuth state returned in the callback.
 *
 * Checks:
 * 1. Cookie exists and has correct format
 * 2. State query param matches the payload in the cookie
 * 3. HMAC signature is valid (proves we created it)
 * 4. Payload has not expired
 *
 * Usage in /callback route:
 * ```ts
 * const cookieValue = request.cookies.get("__oauth_state")?.value
 * const queryState = searchParams.get("state")
 * const { organizationId, userId, providerKey, codeVerifier } =
 *     validateOAuthState(cookieValue, queryState)
 * ```
 */
export function validateOAuthState(
    cookieValue: string | undefined | null,
    queryState: string | undefined | null
): ValidatedOAuthState {
    if (!cookieValue) {
        throw new Error("OAuth state cookie not found. Please try connecting again.");
    }
    if (!queryState) {
        throw new Error("OAuth state parameter missing from callback URL.");
    }

    // Parse cookie: base64url(payload).signature
    const dotIndex = cookieValue.lastIndexOf(".");
    if (dotIndex < 0) {
        throw new Error("Invalid OAuth state cookie format.");
    }

    const cookiePayloadB64 = cookieValue.slice(0, dotIndex);
    const signature = cookieValue.slice(dotIndex + 1);

    // Verify the state param matches what we stored in the cookie
    if (cookiePayloadB64 !== queryState) {
        throw new Error("OAuth state mismatch. This may indicate a CSRF attack. Please try again.");
    }

    // Decode the payload
    const payloadJson = Buffer.from(cookiePayloadB64, "base64url").toString("utf8");

    // Verify HMAC signature
    if (!hmacVerify(payloadJson, signature)) {
        throw new Error("OAuth state signature invalid. The state may have been tampered with.");
    }

    // Parse and validate payload
    let payload: OAuthStatePayload;
    try {
        payload = JSON.parse(payloadJson) as OAuthStatePayload;
    } catch {
        throw new Error("Failed to parse OAuth state payload.");
    }

    // Check expiry
    if (Date.now() > payload.expiresAt) {
        throw new Error("OAuth state expired. Please try connecting again.");
    }

    // Validate required fields
    if (
        !payload.organizationId ||
        !payload.userId ||
        !payload.providerKey ||
        !payload.codeVerifier
    ) {
        throw new Error("Incomplete OAuth state payload.");
    }

    return {
        organizationId: payload.organizationId,
        userId: payload.userId,
        providerKey: payload.providerKey,
        codeVerifier: payload.codeVerifier
    };
}

/**
 * Get the cookie name constant for clearing in callback routes.
 */
export function getOAuthStateCookieName(): string {
    return COOKIE_NAME;
}
