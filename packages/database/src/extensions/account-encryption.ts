import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { Prisma } from "@prisma/client";

const TOKEN_FIELDS = ["accessToken", "refreshToken", "idToken"] as const;
const ENC_PREFIX = "enc:v1:";

function getEncryptionKey(): Buffer | null {
    const key = process.env.CREDENTIAL_ENCRYPTION_KEY;
    if (!key) return null;
    const buffer = Buffer.from(key, "hex");
    if (buffer.length !== 32) return null;
    return buffer;
}

function encryptString(value: string): string {
    const key = getEncryptionKey();
    if (!key) return value;

    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    const combined = Buffer.concat([iv, tag, encrypted]);
    return ENC_PREFIX + combined.toString("base64");
}

function decryptString(value: string): string {
    if (!value.startsWith(ENC_PREFIX)) return value;

    const key = getEncryptionKey();
    if (!key) return value;

    const combined = Buffer.from(value.slice(ENC_PREFIX.length), "base64");
    const iv = combined.subarray(0, 12);
    const tag = combined.subarray(12, 28);
    const encrypted = combined.subarray(28);

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function encryptTokenFields(
    data: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
    if (!data) return data;
    const result = { ...data };
    for (const field of TOKEN_FIELDS) {
        const val = result[field];
        if (typeof val === "string" && val.length > 0 && !val.startsWith(ENC_PREFIX)) {
            result[field] = encryptString(val);
        }
    }
    return result;
}

function decryptTokenFieldsOnRecord(record: Record<string, unknown> | null): void {
    if (!record) return;
    for (const field of TOKEN_FIELDS) {
        const val = record[field];
        if (typeof val === "string" && val.startsWith(ENC_PREFIX)) {
            record[field] = decryptString(val);
        }
    }
}

export function accountEncryptionExtension() {
    return Prisma.defineExtension({
        name: "account-token-encryption",
        query: {
            account: {
                async create({ args, query }) {
                    args.data = encryptTokenFields(
                        args.data as Record<string, unknown>
                    ) as typeof args.data;
                    const result = await query(args);
                    decryptTokenFieldsOnRecord(result as unknown as Record<string, unknown>);
                    return result;
                },
                async update({ args, query }) {
                    if (args.data) {
                        args.data = encryptTokenFields(
                            args.data as Record<string, unknown>
                        ) as typeof args.data;
                    }
                    const result = await query(args);
                    decryptTokenFieldsOnRecord(result as unknown as Record<string, unknown>);
                    return result;
                },
                async upsert({ args, query }) {
                    args.create = encryptTokenFields(
                        args.create as Record<string, unknown>
                    ) as typeof args.create;
                    if (args.update) {
                        args.update = encryptTokenFields(
                            args.update as Record<string, unknown>
                        ) as typeof args.update;
                    }
                    const result = await query(args);
                    decryptTokenFieldsOnRecord(result as unknown as Record<string, unknown>);
                    return result;
                },
                async findUnique({ args, query }) {
                    const result = await query(args);
                    decryptTokenFieldsOnRecord(result as unknown as Record<string, unknown>);
                    return result;
                },
                async findFirst({ args, query }) {
                    const result = await query(args);
                    decryptTokenFieldsOnRecord(result as unknown as Record<string, unknown>);
                    return result;
                },
                async findMany({ args, query }) {
                    const results = await query(args);
                    for (const r of results) {
                        decryptTokenFieldsOnRecord(r as unknown as Record<string, unknown>);
                    }
                    return results;
                }
            }
        }
    });
}
