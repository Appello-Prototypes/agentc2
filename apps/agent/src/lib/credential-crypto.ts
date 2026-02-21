import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

type EncryptedPayload = {
    __enc: "v1";
    iv: string;
    tag: string;
    data: string;
};

const getEncryptionKey = () => {
    const key = process.env.CREDENTIAL_ENCRYPTION_KEY;
    if (!key) {
        if (process.env.NODE_ENV === "production") {
            throw new Error(
                "[CredentialCrypto] CREDENTIAL_ENCRYPTION_KEY is required in production"
            );
        }
        return null;
    }
    const buffer = Buffer.from(key, "hex");
    if (buffer.length !== 32) {
        if (process.env.NODE_ENV === "production") {
            throw new Error(
                "[CredentialCrypto] CREDENTIAL_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)"
            );
        }
        console.warn("[CredentialCrypto] Invalid CREDENTIAL_ENCRYPTION_KEY length");
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

export const encryptCredentials = (value: Record<string, unknown> | null) => {
    if (!value || isEncryptedPayload(value)) return value;
    const key = getEncryptionKey();
    if (!key) return value;

    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const plaintext = JSON.stringify(value);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
        __enc: "v1",
        iv: iv.toString("base64"),
        tag: tag.toString("base64"),
        data: encrypted.toString("base64")
    };
};

const ENC_STRING_PREFIX = "enc:v1:";

export const encryptString = (value: string): string => {
    if (value.startsWith(ENC_STRING_PREFIX)) return value;
    const key = getEncryptionKey();
    if (!key) return value;

    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    const combined = Buffer.concat([iv, tag, encrypted]);
    return ENC_STRING_PREFIX + combined.toString("base64");
};

export const decryptString = (value: string): string => {
    if (!value.startsWith(ENC_STRING_PREFIX)) return value;
    const key = getEncryptionKey();
    if (!key) return value;

    const combined = Buffer.from(value.slice(ENC_STRING_PREFIX.length), "base64");
    const iv = combined.subarray(0, 12);
    const tag = combined.subarray(12, 28);
    const encrypted = combined.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
};

export const decryptCredentials = (value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    if (!isEncryptedPayload(value)) return value;

    const key = getEncryptionKey();
    if (!key) return {};

    const iv = Buffer.from(value.iv, "base64");
    const tag = Buffer.from(value.tag, "base64");
    const encrypted = Buffer.from(value.data, "base64");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
        "utf8"
    );

    try {
        return JSON.parse(decrypted) as Record<string, unknown>;
    } catch {
        return {};
    }
};
