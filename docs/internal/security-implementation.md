# Security Implementation

> **Internal Documentation** — This document covers credential encryption implementation for the AgentC2 engineering team. Not published to the public documentation site.

---

## Overview

AgentC2 uses AES-256-GCM envelope encryption for all sensitive data at rest, Ed25519 digital signatures for organization identity, and HKDF-based key derivation for per-purpose keys. All encryption is implemented in the `packages/agentc2/src/crypto/` module.

### Key Files

| File                                       | Purpose                                                     |
| ------------------------------------------ | ----------------------------------------------------------- |
| `packages/agentc2/src/crypto/encryption.ts` | AES-256-GCM encrypt/decrypt, HKDF key derivation            |
| `packages/agentc2/src/crypto/signing.ts`    | Ed25519 key generation, signing, verification               |
| `packages/agentc2/src/crypto/keys.ts`       | Organization key pair lifecycle (provision, rotate, revoke) |
| `packages/agentc2/src/crypto/types.ts`      | Type definitions for encrypted payloads and key pairs       |
| `packages/agentc2/src/crypto/index.ts`      | Package exports                                             |

---

## AES-256-GCM Encryption

### Platform Key Encryption Key (KEK)

All encryption uses a single platform-level KEK stored in the `CREDENTIAL_ENCRYPTION_KEY` environment variable. This is a 32-byte (256-bit) hex-encoded key.

**Generate a new key:**

```bash
openssl rand -hex 32
```

### Key Loading

```typescript
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "crypto";

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
```

The KEK is cached after first load to avoid repeated environment variable reads.

### Encrypted Payload Format

All encrypted data uses the `EncryptedPayload` format:

```typescript
export type EncryptedPayload = {
    __enc: "v1"; // Version marker for forward compatibility
    iv: string; // Base64-encoded 12-byte initialization vector
    tag: string; // Base64-encoded 16-byte GCM authentication tag
    data: string; // Base64-encoded ciphertext
};
```

The `__enc: "v1"` field acts as a discriminator — any JSON object with this field is treated as encrypted.

### Encrypt / Decrypt Functions

```typescript
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
```

### JSON Encryption Helpers

For encrypting/decrypting JSON objects (used for OAuth credentials stored in the database):

```typescript
export function encryptJson(value: Record<string, unknown> | null): EncryptedPayload | null {
    if (!value || isEncryptedPayload(value)) return value as EncryptedPayload | null;
    return encrypt(JSON.stringify(value));
}

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
```

> **Graceful passthrough:** `decryptJson` returns unencrypted data as-is. This ensures backward compatibility during migration from plaintext to encrypted storage.

### Per-Key Encryption

For encrypting data with a specific key (used for federation channel keys):

```typescript
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
```

### Encrypted Payload Detection

```typescript
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
```

---

## Token Lifecycle with Prisma

### OAuth Credential Storage

OAuth tokens (access tokens, refresh tokens) are stored in the `IntegrationConnection` model's `credentials` JSON field. The credentials are encrypted before storage and decrypted on read.

**Encryption on write (MCP client):**

```typescript
const encryptCredentials = (value: Record<string, unknown> | null) => {
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
```

**Decryption on read:**

```typescript
const decryptCredentials = (value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    if (!isEncryptedPayload(value)) return value;

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
        console.error("[MCP] Failed to decrypt credentials:", error);
        return {};
    }
};
```

### Backward-Compatible Wrapper

The `index.ts` exports a backward-compatible `decryptCredentials` function that returns `{}` on failure (matching the old API) instead of `null`:

```typescript
import { decryptJson as _decryptJson } from "./encryption";
export const decryptCredentials = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return _decryptJson(value) ?? {};
};
```

---

## HKDF Key Derivation

For deriving purpose-specific keys from the platform KEK:

```typescript
export function deriveKey(purpose: string, context: string): Buffer | null {
    const kek = getPlatformKek();
    if (!kek) return null;

    return Buffer.from(hkdfSync("sha256", kek, context, purpose, 32));
}
```

**Use cases:**

- Federation channel keys (per-agreement encryption)
- Per-organization data encryption keys (DEKs)

### Channel Key Management

```typescript
export function generateChannelKey(): Buffer {
    return randomBytes(32);
}

export function encryptChannelKey(channelKey: Buffer): EncryptedPayload | null {
    return encrypt(channelKey.toString("base64"));
}

export function decryptChannelKey(encrypted: EncryptedPayload): Buffer | null {
    const b64 = decrypt(encrypted);
    if (!b64) return null;
    return Buffer.from(b64, "base64");
}
```

---

## Ed25519 Digital Signatures

Every organization gets an Ed25519 key pair. The private key is encrypted at rest with the platform KEK. Signing proves organization identity without shared secrets.

### Type Definitions

```typescript
export type Ed25519KeyPair = {
    publicKey: string; // base64-encoded DER (SPKI)
    privateKey: string; // base64-encoded DER (PKCS8, plaintext before encryption)
};

export type EncryptedKeyPair = {
    publicKey: string; // base64-encoded DER (SPKI)
    encryptedPrivateKey: EncryptedPayload;
};

export type SignedPayload = {
    payload: string; // the original content
    signature: string; // base64-encoded Ed25519 signature
    signerPublicKey: string; // base64-encoded public key of signer
    keyVersion: number;
};
```

### Key Generation

```typescript
import { generateKeyPairSync, sign, verify, createPublicKey, createPrivateKey } from "crypto";

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

export function generateEncryptedKeyPair(): EncryptedKeyPair | null {
    const keyPair = generateEd25519KeyPair();
    const encryptedPrivateKey = encrypt(keyPair.privateKey);
    if (!encryptedPrivateKey) return null;

    return {
        publicKey: keyPair.publicKey,
        encryptedPrivateKey
    };
}
```

### Signing and Verification

```typescript
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
```

---

## Key Rotation Procedures

### Organization Key Pair Rotation

Keys are managed in `packages/agentc2/src/crypto/keys.ts` using the Prisma `OrganizationKeyPair` model.

#### Provisioning

Called automatically during organization creation:

```typescript
export async function provisionOrgKeyPair(organizationId: string): Promise<OrgKeyPair | null> {
    const keyPair = generateEncryptedKeyPair();
    if (!keyPair) {
        console.error("[Crypto] Cannot provision key pair: CREDENTIAL_ENCRYPTION_KEY not configured");
        return null;
    }

    const existing = await prisma.organizationKeyPair.findFirst({
        where: { organizationId, status: "active" },
        orderBy: { keyVersion: "desc" }
    });

    const nextVersion = existing ? existing.keyVersion + 1 : 1;

    const record = await prisma.organizationKeyPair.create({
        data: {
            organizationId,
            publicKey: keyPair.publicKey,
            encryptedPrivateKey: keyPair.encryptedPrivateKey as unknown as string,
            keyVersion: nextVersion,
            algorithm: "Ed25519",
            status: "active"
        }
    });

    return { id: record.id, organizationId, publicKey: record.publicKey, ... };
}
```

#### Rotation

The old key is kept in "rotated" status for historical signature verification:

```typescript
export async function rotateOrgKeyPair(organizationId: string): Promise<OrgKeyPair | null> {
    const current = await getActiveOrgKeyPair(organizationId);
    if (!current) {
        return provisionOrgKeyPair(organizationId);
    }

    const newKeyPair = generateEncryptedKeyPair();
    if (!newKeyPair) return null;

    const nextVersion = current.keyVersion + 1;

    const [, created] = await prisma.$transaction([
        prisma.organizationKeyPair.update({
            where: { id: current.id },
            data: { status: "rotated", rotatedAt: new Date() }
        }),
        prisma.organizationKeyPair.create({
            data: {
                organizationId,
                publicKey: newKeyPair.publicKey,
                encryptedPrivateKey: newKeyPair.encryptedPrivateKey as unknown as string,
                keyVersion: nextVersion,
                algorithm: "Ed25519",
                status: "active"
            }
        })
    ]);

    return { ... };
}
```

#### Revocation (Emergency)

Revokes ALL key pairs for an organization:

```typescript
export async function revokeOrgKeyPairs(organizationId: string): Promise<number> {
    const result = await prisma.organizationKeyPair.updateMany({
        where: { organizationId, status: { in: ["active", "rotated"] } },
        data: { status: "revoked", revokedAt: new Date() }
    });
    return result.count;
}
```

#### Key Status Lifecycle

| Status    | Description                                         |
| --------- | --------------------------------------------------- |
| `active`  | Current key pair, used for signing                  |
| `rotated` | Previous key pair, kept for historical verification |
| `revoked` | Emergency revocation, no longer valid               |

### Platform KEK Rotation

> **Warning:** Rotating the platform KEK (`CREDENTIAL_ENCRYPTION_KEY`) requires re-encrypting ALL stored credentials across the database. This is a major operation.

**Procedure:**

1. Generate a new 32-byte hex key: `openssl rand -hex 32`
2. Write a migration script that:
    - Reads all `IntegrationConnection.credentials` with the old key
    - Decrypts with old key, re-encrypts with new key
    - Updates all `OrganizationKeyPair.encryptedPrivateKey` values
3. Update the `CREDENTIAL_ENCRYPTION_KEY` environment variable on all servers
4. Run the migration script
5. Restart all PM2 processes to clear the cached KEK

---

## OAuth Token Refresh

OAuth integrations (Google, Microsoft, Dropbox) store tokens encrypted in `IntegrationConnection.credentials`. The token refresh flow:

1. **On use:** Decrypt credentials, check if access token is expired
2. **If expired:** Use refresh token to obtain a new access token from the provider
3. **Re-encrypt:** Encrypt the updated credentials and save to database
4. **If refresh fails:** Mark the connection as needing re-authentication

---

## Security Headers via Caddy

The production Caddyfile configures security headers for all responses:

```caddyfile
header {
    # HSTS - Force HTTPS for 1 year
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    # Prevent MIME type sniffing
    X-Content-Type-Options "nosniff"
    # XSS protection
    X-XSS-Protection "1; mode=block"
    # Prevent clickjacking
    X-Frame-Options "SAMEORIGIN"
    # Referrer policy
    Referrer-Policy "strict-origin-when-cross-origin"
    # Remove server header
    -Server
}
```

| Header                      | Value                                          | Purpose                      |
| --------------------------- | ---------------------------------------------- | ---------------------------- |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Force HTTPS for 1 year       |
| `X-Content-Type-Options`    | `nosniff`                                      | Prevent MIME type sniffing   |
| `X-XSS-Protection`          | `1; mode=block`                                | XSS protection               |
| `X-Frame-Options`           | `SAMEORIGIN`                                   | Prevent clickjacking         |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`              | Control referrer information |
| `-Server`                   | (removed)                                      | Hide server identity         |

### CSP Configuration for Embeds

Embed routes relax the `X-Frame-Options` header to allow external iframing:

```caddyfile
@embed_routes {
    path /embed/* /embed-v2/*
}

handle @embed_routes {
    header X-Frame-Options ""
    header Content-Security-Policy "frame-ancestors *"
    reverse_proxy localhost:3001 { ... }
}
```

---

## HMAC-SHA256 for Webhooks

Webhook verification uses HMAC-SHA256:

```typescript
export function hmacSha256(data: string, secret: string): string {
    return createHmac("sha256", secret).update(data).digest("hex");
}
```

Used to verify webhook payloads from ElevenLabs, Slack, and other providers by comparing the computed HMAC against the signature in the request headers.

---

## Audit Logging

Security-relevant events are logged to the `AuditLog` model in the database. Events include:

- User sign-in / sign-out
- Organization membership changes
- Key pair provisioning and rotation
- Integration connection creation/deletion
- Admin actions (tenant suspension, deletion)

---

## Exports

The `packages/agentc2/src/crypto/index.ts` exports:

```typescript
// Types
export type { EncryptedPayload, Ed25519KeyPair, EncryptedKeyPair, SignedPayload } from "./types";

// Encryption
export {
    encrypt, decrypt,
    encryptJson, decryptJson,
    encryptWithKey, decryptWithKey,
    deriveKey,
    generateChannelKey, encryptChannelKey, decryptChannelKey,
    isEncryptedPayload,
    hmacSha256,
    resetKekCache
} from "./encryption";

// Backward-compatible wrapper
export const decryptCredentials = (value: unknown): Record<string, unknown> => { ... };

// Signing
export {
    generateEd25519KeyPair,
    generateEncryptedKeyPair,
    signPayload,
    verifySignature
} from "./signing";

// Key lifecycle
export {
    provisionOrgKeyPair,
    getActiveOrgKeyPair,
    getOrgKeyPairByVersion,
    rotateOrgKeyPair,
    revokeOrgKeyPairs,
    getOrgPublicKey
} from "./keys";
export type { OrgKeyPair } from "./keys";
```
