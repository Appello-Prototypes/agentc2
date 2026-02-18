/**
 * Organization key pair lifecycle management.
 *
 * Handles provisioning, rotation, and revocation of Ed25519 key pairs.
 * Key pairs are stored in the database with private keys encrypted at rest.
 */

import { prisma } from "@repo/database";
import { generateEncryptedKeyPair } from "./signing";
import type { EncryptedPayload } from "./types";

export interface OrgKeyPair {
    id: string;
    organizationId: string;
    publicKey: string;
    encryptedPrivateKey: EncryptedPayload;
    keyVersion: number;
    status: string;
}

/**
 * Provision a new key pair for an organization.
 * Called automatically during org creation.
 */
export async function provisionOrgKeyPair(organizationId: string): Promise<OrgKeyPair | null> {
    const keyPair = generateEncryptedKeyPair();
    if (!keyPair) {
        console.error(
            "[Crypto] Cannot provision key pair: CREDENTIAL_ENCRYPTION_KEY not configured"
        );
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

    return {
        id: record.id,
        organizationId: record.organizationId,
        publicKey: record.publicKey,
        encryptedPrivateKey: record.encryptedPrivateKey as unknown as EncryptedPayload,
        keyVersion: record.keyVersion,
        status: record.status
    };
}

/**
 * Get the active key pair for an organization.
 */
export async function getActiveOrgKeyPair(organizationId: string): Promise<OrgKeyPair | null> {
    const record = await prisma.organizationKeyPair.findFirst({
        where: { organizationId, status: "active" },
        orderBy: { keyVersion: "desc" }
    });

    if (!record) return null;

    return {
        id: record.id,
        organizationId: record.organizationId,
        publicKey: record.publicKey,
        encryptedPrivateKey: record.encryptedPrivateKey as unknown as EncryptedPayload,
        keyVersion: record.keyVersion,
        status: record.status
    };
}

/**
 * Get a specific key version for signature verification of historical messages.
 */
export async function getOrgKeyPairByVersion(
    organizationId: string,
    keyVersion: number
): Promise<OrgKeyPair | null> {
    const record = await prisma.organizationKeyPair.findUnique({
        where: {
            organizationId_keyVersion: { organizationId, keyVersion }
        }
    });

    if (!record) return null;

    return {
        id: record.id,
        organizationId: record.organizationId,
        publicKey: record.publicKey,
        encryptedPrivateKey: record.encryptedPrivateKey as unknown as EncryptedPayload,
        keyVersion: record.keyVersion,
        status: record.status
    };
}

/**
 * Rotate an organization's key pair.
 * The old key is kept in "rotated" status for historical signature verification.
 */
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

    return {
        id: created.id,
        organizationId: created.organizationId,
        publicKey: created.publicKey,
        encryptedPrivateKey: created.encryptedPrivateKey as unknown as EncryptedPayload,
        keyVersion: created.keyVersion,
        status: created.status
    };
}

/**
 * Revoke all key pairs for an organization (emergency use).
 */
export async function revokeOrgKeyPairs(organizationId: string): Promise<number> {
    const result = await prisma.organizationKeyPair.updateMany({
        where: { organizationId, status: { in: ["active", "rotated"] } },
        data: { status: "revoked", revokedAt: new Date() }
    });
    return result.count;
}

/**
 * Get the public key for an organization (for external verification).
 */
export async function getOrgPublicKey(organizationId: string): Promise<string | null> {
    const keyPair = await getActiveOrgKeyPair(organizationId);
    return keyPair?.publicKey ?? null;
}
