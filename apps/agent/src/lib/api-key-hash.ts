import { createHash, timingSafeEqual } from "crypto";

export interface HashedKeyPayload {
    apiKeyHash: string;
    apiKeyPrefix: string;
    createdAt: string;
    expiresAt?: string;
}

interface LegacyKeyPayload {
    apiKey: string;
}

type KeyPayload = HashedKeyPayload | LegacyKeyPayload;

const DEFAULT_EXPIRY_DAYS = 90;

export function hashApiKey(key: string): string {
    return createHash("sha256").update(key).digest("hex");
}

export function verifyApiKey(candidateKey: string, storedHash: string): boolean {
    const candidateHash = hashApiKey(candidateKey);
    const a = Buffer.from(candidateHash, "hex");
    const b = Buffer.from(storedHash, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
}

function isHashedPayload(payload: unknown): payload is HashedKeyPayload {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
    return "apiKeyHash" in (payload as Record<string, unknown>);
}

function isLegacyPayload(payload: unknown): payload is LegacyKeyPayload {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
    const p = payload as Record<string, unknown>;
    return typeof p.apiKey === "string" && !("apiKeyHash" in p);
}

/**
 * Validate an API key against a stored credential payload.
 * Supports both hashed (new) and plaintext (legacy) formats.
 * Returns false for expired keys.
 */
export function validateStoredApiKey(
    candidateKey: string,
    credentialPayload: unknown,
    isActive: boolean
): boolean {
    if (!isActive || !credentialPayload) return false;

    if (isHashedPayload(credentialPayload)) {
        if (credentialPayload.expiresAt) {
            const expiry = new Date(credentialPayload.expiresAt);
            if (expiry < new Date()) return false;
        }
        return verifyApiKey(candidateKey, credentialPayload.apiKeyHash);
    }

    if (isLegacyPayload(credentialPayload)) {
        return credentialPayload.apiKey === candidateKey;
    }

    return false;
}

export function buildHashedCredential(plainKey: string): HashedKeyPayload {
    const now = new Date();
    const expiry = new Date(now);
    expiry.setDate(expiry.getDate() + DEFAULT_EXPIRY_DAYS);

    return {
        apiKeyHash: hashApiKey(plainKey),
        apiKeyPrefix: plainKey.slice(0, 8),
        createdAt: now.toISOString(),
        expiresAt: expiry.toISOString()
    };
}

export function getKeyPrefix(credentialPayload: unknown): string | null {
    if (isHashedPayload(credentialPayload)) {
        return credentialPayload.apiKeyPrefix;
    }
    if (isLegacyPayload(credentialPayload)) {
        return credentialPayload.apiKey.slice(0, 8);
    }
    return null;
}
