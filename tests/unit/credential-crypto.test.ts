import { describe, expect, it, beforeEach } from "vitest";
import { decryptCredentials, encryptCredentials } from "../../apps/agent/src/lib/credential-crypto";

const key = "a".repeat(64);

describe("credential-crypto", () => {
    beforeEach(() => {
        process.env.CREDENTIAL_ENCRYPTION_KEY = key;
    });

    it("round-trips encrypted credentials", () => {
        const input = { token: "abc", nested: { a: 1 } };
        const encrypted = encryptCredentials(input);
        const decrypted = decryptCredentials(encrypted);
        expect(decrypted).toEqual(input);
    });

    it("produces different ciphertext for the same input", () => {
        const input = { token: "abc" };
        const first = encryptCredentials(input);
        const second = encryptCredentials(input);
        expect(first).not.toEqual(second);
    });

    it("passes through when encryption key is missing", () => {
        delete process.env.CREDENTIAL_ENCRYPTION_KEY;
        const input = { token: "abc" };
        const encrypted = encryptCredentials(input);
        expect(encrypted).toEqual(input);
    });

    it("handles empty objects and null values", () => {
        const encryptedEmpty = encryptCredentials({});
        const decryptedEmpty = decryptCredentials(encryptedEmpty);
        expect(decryptedEmpty).toEqual({});

        const encryptedNull = encryptCredentials(null);
        const decryptedNull = decryptCredentials(encryptedNull);
        expect(decryptedNull).toBeNull();
    });
});
