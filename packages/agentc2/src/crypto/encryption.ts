/**
 * AES-256-GCM envelope encryption.
 *
 * Consolidates the encryption/decryption pattern previously duplicated
 * across crypto.ts, mcp/client.ts, and tools/gmail/shared.ts.
 *
 * Key hierarchy:
 *   Platform KEK (CREDENTIAL_ENCRYPTION_KEY, 32-byte hex)
 *     -> used directly for credential encryption (backward compatible)
 *     -> used via HKDF to derive per-purpose keys (federation channel keys, etc.)
 */

import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "crypto";
import type { EncryptedPayload } from "./types";

let cachedKek: Buffer | null | undefined;

function getPlatformKek(): Buffer | null {
    if (cachedKek !== undefined) return cachedKek;
    const key = process.env.CREDENTIAL_ENCRYPTION_KEY;
    if (!key) {
        cachedKek = null;
        return null;
    }
    const buffer = Buffer.from(key, "hex");
    if (buffer.length !== 32) {
        console.warn("[Crypto] Invalid CREDENTIAL_ENCRYPTION_KEY length (expected 32 bytes)");
        cachedKek = null;
        return null;
    }
    cachedKek = buffer;
    return cachedKek;
}

/** Reset cached KEK (for testing). */
export function resetKekCache(): void {
    cachedKek = undefined;
}

export function isEncryptedPayload(value: unknown): value is EncryptedPayload {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const p = value as Record<string, unknown>;
    return (
        p.__enc === "v1" &&
        typeof p.iv === "string" &&
        typeof p.tag === "string" &&
        typeof p.data === "string"
    );
}

/**
 * Encrypt arbitrary data with the platform KEK (AES-256-GCM).
 * Returns null if no KEK is configured.
 */
export function encrypt(plaintext: string): EncryptedPayload | null {
    const key = getPlatformKek();
    if (!key) return null;

    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
        __enc: "v1",
        iv: iv.toString("base64"),
        tag: tag.toString("base64"),
        data: encrypted.toString("base64")
    };
}

/**
 * Decrypt an AES-256-GCM encrypted payload with the platform KEK.
 * Returns null on failure.
 */
export function decrypt(payload: EncryptedPayload): string | null {
    const key = getPlatformKek();
    if (!key) return null;

    try {
        const iv = Buffer.from(payload.iv, "base64");
        const tag = Buffer.from(payload.tag, "base64");
        const encrypted = Buffer.from(payload.data, "base64");
        const decipher = createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    } catch (error) {
        console.error("[Crypto] Decryption failed:", error);
        return null;
    }
}

/**
 * Encrypt a JSON-serializable object. Backward-compatible with existing credential format.
 */
export function encryptJson(value: Record<string, unknown> | null): EncryptedPayload | null {
    if (!value || isEncryptedPayload(value)) return value as EncryptedPayload | null;
    return encrypt(JSON.stringify(value));
}

/**
 * Decrypt an encrypted payload to a JSON object. Backward-compatible with existing credential format.
 * Returns the value as-is if not encrypted (graceful passthrough for unencrypted data).
 */
export function decryptJson(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    if (!isEncryptedPayload(value)) return value as Record<string, unknown>;

    const plaintext = decrypt(value);
    if (!plaintext) return null;

    try {
        return JSON.parse(plaintext) as Record<string, unknown>;
    } catch {
        return null;
    }
}

/**
 * Encrypt with a specific key (for per-agreement channel keys).
 */
export function encryptWithKey(plaintext: string, key: Buffer): EncryptedPayload {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
        __enc: "v1",
        iv: iv.toString("base64"),
        tag: tag.toString("base64"),
        data: encrypted.toString("base64")
    };
}

/**
 * Decrypt with a specific key (for per-agreement channel keys).
 */
export function decryptWithKey(payload: EncryptedPayload, key: Buffer): string | null {
    try {
        const iv = Buffer.from(payload.iv, "base64");
        const tag = Buffer.from(payload.tag, "base64");
        const encrypted = Buffer.from(payload.data, "base64");
        const decipher = createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    } catch (error) {
        console.error("[Crypto] Decryption with key failed:", error);
        return null;
    }
}

/**
 * Derive a purpose-specific key from the platform KEK using HKDF.
 * Used for federation channel keys, per-org DEKs, etc.
 */
export function deriveKey(purpose: string, context: string): Buffer | null {
    const kek = getPlatformKek();
    if (!kek) return null;

    return Buffer.from(hkdfSync("sha256", kek, context, purpose, 32));
}

/**
 * Generate a random 256-bit symmetric key for channel encryption.
 */
export function generateChannelKey(): Buffer {
    return randomBytes(32);
}

/**
 * Encrypt a channel key with the platform KEK for storage.
 */
export function encryptChannelKey(channelKey: Buffer): EncryptedPayload | null {
    return encrypt(channelKey.toString("base64"));
}

/**
 * Decrypt a stored channel key.
 */
export function decryptChannelKey(encrypted: EncryptedPayload): Buffer | null {
    const b64 = decrypt(encrypted);
    if (!b64) return null;
    return Buffer.from(b64, "base64");
}

/**
 * HMAC-SHA256 for backward compatibility with webhook verification patterns.
 */
export function hmacSha256(data: string, secret: string): string {
    return createHmac("sha256", secret).update(data).digest("hex");
}
