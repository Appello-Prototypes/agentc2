import { prisma } from "@repo/database";
import { generateEncryptedKeyPair, signPayload, verifySignature } from "../crypto/signing";
import { randomUUID } from "crypto";
import type { EncryptedPayload } from "../crypto/types";

/**
 * Provision a cryptographic identity for an agent.
 * Reuses the Ed25519 key generation from crypto/signing.ts.
 */
export async function provisionAgentIdentity(agentId: string) {
    const existing = await prisma.agentIdentity.findUnique({ where: { agentId } });
    if (existing) return existing;

    const keyPair = generateEncryptedKeyPair();
    if (!keyPair) {
        throw new Error(
            "Failed to generate agent identity key pair — check CREDENTIAL_ENCRYPTION_KEY"
        );
    }

    return prisma.agentIdentity.create({
        data: {
            agentId,
            publicKey: keyPair.publicKey,
            encryptedPrivateKey: keyPair.encryptedPrivateKey as object,
            keyId: `agent-${agentId}-${randomUUID().slice(0, 8)}`
        }
    });
}

/**
 * Sign a payload on behalf of an agent using their identity key pair.
 */
export async function signAgentAction(agentId: string, payload: string): Promise<string | null> {
    const identity = await prisma.agentIdentity.findUnique({ where: { agentId } });
    if (!identity) return null;

    return signPayload(payload, identity.encryptedPrivateKey as EncryptedPayload);
}

/**
 * Verify a signature against an agent's public key.
 */
export async function verifyAgentSignature(
    agentId: string,
    payload: string,
    signature: string
): Promise<boolean> {
    const identity = await prisma.agentIdentity.findUnique({ where: { agentId } });
    if (!identity) return false;

    return verifySignature(payload, signature, identity.publicKey);
}

/**
 * Get agent's public identity info for sharing with other agents.
 */
export async function getAgentPublicIdentity(agentId: string) {
    const identity = await prisma.agentIdentity.findUnique({
        where: { agentId },
        select: { keyId: true, publicKey: true, keyVersion: true, createdAt: true }
    });
    return identity;
}
