export type { EncryptedPayload, Ed25519KeyPair, EncryptedKeyPair, SignedPayload } from "./types";

export {
    encrypt,
    decrypt,
    reEncrypt,
    encryptJson,
    decryptJson,
    encryptWithKey,
    decryptWithKey,
    deriveKey,
    generateChannelKey,
    encryptChannelKey,
    decryptChannelKey,
    isEncryptedPayload,
    hmacSha256,
    resetKekCache
} from "./encryption";

// Backward-compatible wrapper matching the old crypto.ts `decryptCredentials` signature.
// The old version returned {} on failure; `decryptJson` returns null.
import { decryptJson as _decryptJson } from "./encryption";
export const decryptCredentials = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return _decryptJson(value) ?? {};
};

export {
    generateEd25519KeyPair,
    generateEncryptedKeyPair,
    signPayload,
    verifySignature
} from "./signing";

export {
    provisionOrgKeyPair,
    getActiveOrgKeyPair,
    getOrgKeyPairByVersion,
    rotateOrgKeyPair,
    revokeOrgKeyPairs,
    getOrgPublicKey
} from "./keys";
export type { OrgKeyPair } from "./keys";
