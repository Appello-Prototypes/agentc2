import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

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
        console.warn("[AdminCredentialCrypto] Invalid CREDENTIAL_ENCRYPTION_KEY length");
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
