/**
 * Ed25519 digital signatures for organization identity.
 *
 * Every organization gets a key pair. The private key is encrypted at rest
 * with the platform KEK. Signing proves org identity; verification confirms
 * message authenticity without needing shared secrets.
 */

import { generateKeyPairSync, sign, verify, createPublicKey, createPrivateKey } from "crypto";
import { encrypt, decrypt } from "./encryption";
import type { Ed25519KeyPair, EncryptedKeyPair, EncryptedPayload } from "./types";

/**
 * Generate a new Ed25519 key pair.
 * Returns raw base64-encoded keys (private key NOT yet encrypted).
 */
export function generateEd25519KeyPair(): Ed25519KeyPair {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
        publicKeyEncoding: { type: "spki", format: "der" },
        privateKeyEncoding: { type: "pkcs8", format: "der" }
    });

    return {
        publicKey: publicKey.toString("base64"),
        privateKey: privateKey.toString("base64")
    };
}

/**
 * Generate a key pair with the private key encrypted for storage.
 */
export function generateEncryptedKeyPair(): EncryptedKeyPair | null {
    const keyPair = generateEd25519KeyPair();
    const encryptedPrivateKey = encrypt(keyPair.privateKey);
    if (!encryptedPrivateKey) return null;

    return {
        publicKey: keyPair.publicKey,
        encryptedPrivateKey
    };
}

/**
 * Sign a payload with an encrypted private key.
 * Decrypts the private key in memory, signs, then discards.
 */
export function signPayload(payload: string, encryptedPrivateKey: EncryptedPayload): string | null {
    const privateKeyB64 = decrypt(encryptedPrivateKey);
    if (!privateKeyB64) return null;

    try {
        const privateKeyDer = Buffer.from(privateKeyB64, "base64");
        const privateKeyObj = createPrivateKey({
            key: privateKeyDer,
            format: "der",
            type: "pkcs8"
        });

        const signature = sign(null, Buffer.from(payload, "utf8"), privateKeyObj);
        return signature.toString("base64");
    } catch (error) {
        console.error("[Crypto] Signing failed:", error);
        return null;
    }
}

/**
 * Verify a signature against a public key.
 */
export function verifySignature(payload: string, signature: string, publicKeyB64: string): boolean {
    try {
        const publicKeyDer = Buffer.from(publicKeyB64, "base64");
        const publicKeyObj = createPublicKey({
            key: publicKeyDer,
            format: "der",
            type: "spki"
        });

        return verify(
            null,
            Buffer.from(payload, "utf8"),
            publicKeyObj,
            Buffer.from(signature, "base64")
        );
    } catch (error) {
        console.error("[Crypto] Signature verification failed:", error);
        return false;
    }
}
