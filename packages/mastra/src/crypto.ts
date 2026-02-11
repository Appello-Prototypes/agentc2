/**
 * Credential Encryption / Decryption
 *
 * Shared AES-256-GCM utility for encrypting and decrypting
 * integration credentials stored in the database.
 */

import { createDecipheriv } from "crypto";

type EncryptedPayload = {
    __enc: "v1";
    iv: string;
    tag: string;
    data: string;
};

const getEncryptionKey = () => {
    const key = process.env.CREDENTIAL_ENCRYPTION_KEY;
    if (!key) return null;
    const buffer = Buffer.from(key, "hex");
    if (buffer.length !== 32) {
        console.warn("[Crypto] Invalid CREDENTIAL_ENCRYPTION_KEY length");
        return null;
    }
    return buffer;
};

const isEncryptedPayload = (value: unknown): value is EncryptedPayload => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const payload = value as Record<string, unknown>;
    return (
        payload.__enc === "v1" &&
        typeof payload.iv === "string" &&
        typeof payload.tag === "string" &&
        typeof payload.data === "string"
    );
};

export const decryptCredentials = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    if (!isEncryptedPayload(value)) {
        return value as Record<string, unknown>;
    }

    const key = getEncryptionKey();
    if (!key) return {};

    try {
        const iv = Buffer.from(value.iv, "base64");
        const tag = Buffer.from(value.tag, "base64");
        const encrypted = Buffer.from(value.data, "base64");
        const decipher = createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
            "utf8"
        );
        return JSON.parse(decrypted) as Record<string, unknown>;
    } catch (error) {
        console.error("[Crypto] Failed to decrypt credentials:", error);
        return {};
    }
};
