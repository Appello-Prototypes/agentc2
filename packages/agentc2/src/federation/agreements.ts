/**
 * Federation Agreement lifecycle management.
 *
 * Handles creating, approving, suspending, and revoking connections
 * between organizations.
 */

import { prisma, Prisma } from "@repo/database";
import { generateChannelKey, encryptChannelKey, decryptChannelKey } from "../crypto/encryption";
import { getActiveOrgKeyPair } from "../crypto/keys";
import { writeAuditLog } from "../audit";
import type { EncryptedPayload } from "../crypto/types";
import type { ConnectionRequest, ConnectionApproval } from "./types";

export interface AgreementSummary {
    id: string;
    partnerOrg: { id: string; name: string; slug: string; logoUrl: string | null };
    status: string;
    direction: "initiated" | "received";
    exposedAgentCount: number;
    partnerExposedAgentCount: number;
    createdAt: Date;
    approvedAt: Date | null;
}

/**
 * Request a new federation connection.
 */
export async function requestConnection(
    initiatorOrgId: string,
    requestedByUserId: string,
    request: ConnectionRequest
): Promise<{ id: string; status: string } | { error: string }> {
    // Resolve target org
    let targetOrg;
    if (request.targetOrgSlug) {
        targetOrg = await prisma.organization.findUnique({
            where: { slug: request.targetOrgSlug },
            select: { id: true, name: true, slug: true, status: true }
        });
    }

    if (!targetOrg) {
        return { error: "Organization not found" };
    }

    if (targetOrg.status !== "active") {
        return { error: "Target organization is not active" };
    }

    if (targetOrg.id === initiatorOrgId) {
        return { error: "Cannot federate with your own organization" };
    }

    // Check for existing agreement (in either direction)
    const existing = await prisma.federationAgreement.findFirst({
        where: {
            OR: [
                { initiatorOrgId, responderOrgId: targetOrg.id },
                { initiatorOrgId: targetOrg.id, responderOrgId: initiatorOrgId }
            ],
            status: { in: ["pending", "active"] }
        }
    });

    if (existing) {
        return { error: "A connection already exists or is pending with this organization" };
    }

    // Get initiator's active key version
    const initiatorKey = await getActiveOrgKeyPair(initiatorOrgId);
    if (!initiatorKey) {
        return { error: "Organization security keys not provisioned" };
    }

    // Generate channel key for this agreement
    const channelKey = generateChannelKey();
    const encryptedChannelKey = encryptChannelKey(channelKey);
    if (!encryptedChannelKey) {
        return { error: "Failed to generate secure channel" };
    }

    const agreement = await prisma.federationAgreement.create({
        data: {
            initiatorOrgId,
            responderOrgId: targetOrg.id,
            status: "pending",
            requestedByUserId,
            channelKeyEncrypted: encryptedChannelKey as unknown as object,
            channelKeyVersion: 1,
            initiatorKeyVersion: initiatorKey.keyVersion,
            responderKeyVersion: null
        }
    });

    // Create exposures for agents the initiator wants to share
    if (request.exposedAgentIds?.length) {
        await prisma.federationExposure.createMany({
            data: request.exposedAgentIds.map((agentId) => ({
                agreementId: agreement.id,
                ownerOrgId: initiatorOrgId,
                agentId
            }))
        });
    }

    await writeAuditLog({
        organizationId: initiatorOrgId,
        actorType: "user",
        actorId: requestedByUserId,
        action: "federation.request",
        resource: `federation_agreement:${agreement.id}`,
        outcome: "success",
        metadata: { targetOrgSlug: targetOrg.slug }
    });

    return { id: agreement.id, status: "pending" };
}

/**
 * Approve a pending federation connection.
 */
export async function approveConnection(
    agreementId: string,
    responderOrgId: string,
    approvedByUserId: string,
    approval: ConnectionApproval
): Promise<{ success: boolean; error?: string }> {
    const agreement = await prisma.federationAgreement.findUnique({
        where: { id: agreementId }
    });

    if (!agreement) return { success: false, error: "Agreement not found" };
    if (agreement.responderOrgId !== responderOrgId) {
        return { success: false, error: "Not authorized to approve this connection" };
    }
    if (agreement.status !== "pending") {
        return { success: false, error: `Cannot approve: status is ${agreement.status}` };
    }

    const responderKey = await getActiveOrgKeyPair(responderOrgId);
    if (!responderKey) {
        return { success: false, error: "Organization security keys not provisioned" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$transaction(async (tx: any) => {
        // Update agreement
        await tx.federationAgreement.update({
            where: { id: agreementId },
            data: {
                status: "active",
                approvedAt: new Date(),
                approvedByUserId,
                responderKeyVersion: responderKey.keyVersion,
                maxRequestsPerHour: approval.maxRequestsPerHour ?? 500,
                maxRequestsPerDay: approval.maxRequestsPerDay ?? 5000,
                dataClassification: approval.dataClassification ?? "internal"
            }
        });

        // Create exposures for agents the responder wants to share
        if (approval.exposedAgentIds.length) {
            await tx.federationExposure.createMany({
                data: approval.exposedAgentIds.map((agentId) => ({
                    agreementId,
                    ownerOrgId: responderOrgId,
                    agentId
                }))
            });
        }
    });

    // Audit both sides
    await Promise.all([
        writeAuditLog({
            organizationId: responderOrgId,
            actorType: "user",
            actorId: approvedByUserId,
            action: "federation.approve",
            resource: `federation_agreement:${agreementId}`,
            outcome: "success"
        }),
        writeAuditLog({
            organizationId: agreement.initiatorOrgId,
            actorType: "system",
            actorId: "system",
            action: "federation.approved",
            resource: `federation_agreement:${agreementId}`,
            outcome: "success",
            metadata: { approvedByOrgId: responderOrgId }
        })
    ]);

    return { success: true };
}

/**
 * Suspend a federation connection (reversible).
 */
export async function suspendConnection(
    agreementId: string,
    orgId: string,
    userId: string,
    reason: string
): Promise<{ success: boolean; error?: string }> {
    const agreement = await prisma.federationAgreement.findUnique({
        where: { id: agreementId }
    });

    if (!agreement) return { success: false, error: "Agreement not found" };
    if (agreement.initiatorOrgId !== orgId && agreement.responderOrgId !== orgId) {
        return { success: false, error: "Not authorized" };
    }
    if (agreement.status !== "active") {
        return { success: false, error: `Cannot suspend: status is ${agreement.status}` };
    }

    await prisma.federationAgreement.update({
        where: { id: agreementId },
        data: { status: "suspended", suspendedAt: new Date(), suspendedReason: reason }
    });

    await writeAuditLog({
        organizationId: orgId,
        actorType: "user",
        actorId: userId,
        action: "federation.suspend",
        resource: `federation_agreement:${agreementId}`,
        outcome: "success",
        metadata: { reason }
    });

    return { success: true };
}

/**
 * Revoke a federation connection (permanent).
 */
export async function revokeConnection(
    agreementId: string,
    orgId: string,
    userId: string,
    reason: string
): Promise<{ success: boolean; error?: string }> {
    const agreement = await prisma.federationAgreement.findUnique({
        where: { id: agreementId }
    });

    if (!agreement) return { success: false, error: "Agreement not found" };
    if (agreement.initiatorOrgId !== orgId && agreement.responderOrgId !== orgId) {
        return { success: false, error: "Not authorized" };
    }
    if (agreement.status === "revoked") {
        return { success: false, error: "Already revoked" };
    }

    await prisma.federationAgreement.update({
        where: { id: agreementId },
        data: {
            status: "revoked",
            revokedAt: new Date(),
            revokedByUserId: userId,
            revokedReason: reason
        }
    });

    await writeAuditLog({
        organizationId: orgId,
        actorType: "user",
        actorId: userId,
        action: "federation.revoke",
        resource: `federation_agreement:${agreementId}`,
        outcome: "success",
        metadata: { reason }
    });

    return { success: true };
}

/**
 * List federation connections for an organization.
 */
export async function listConnections(orgId: string): Promise<AgreementSummary[]> {
    const agreements = await prisma.federationAgreement.findMany({
        where: {
            OR: [{ initiatorOrgId: orgId }, { responderOrgId: orgId }],
            status: { in: ["pending", "active", "suspended"] }
        },
        include: {
            initiatorOrg: { select: { id: true, name: true, slug: true, logoUrl: true } },
            responderOrg: { select: { id: true, name: true, slug: true, logoUrl: true } },
            exposures: { select: { ownerOrgId: true } }
        },
        orderBy: { createdAt: "desc" }
    });

    return agreements.map(
        (a: {
            id: string;
            initiatorOrgId: string;
            status: string;
            createdAt: Date;
            approvedAt: Date | null;
            initiatorOrg: { id: string; name: string; slug: string; logoUrl: string | null };
            responderOrg: { id: string; name: string; slug: string; logoUrl: string | null };
            exposures: { ownerOrgId: string }[];
        }) => {
            const isInitiator = a.initiatorOrgId === orgId;
            const partnerOrg = isInitiator ? a.responderOrg : a.initiatorOrg;
            const myExposures = a.exposures.filter(
                (e: { ownerOrgId: string }) => e.ownerOrgId === orgId
            );
            const partnerExposures = a.exposures.filter(
                (e: { ownerOrgId: string }) => e.ownerOrgId !== orgId
            );

            return {
                id: a.id,
                partnerOrg,
                status: a.status,
                direction: isInitiator ? ("initiated" as const) : ("received" as const),
                exposedAgentCount: myExposures.length,
                partnerExposedAgentCount: partnerExposures.length,
                createdAt: a.createdAt,
                approvedAt: a.approvedAt
            };
        }
    );
}

/**
 * Get the decrypted channel key for an agreement.
 */
export async function getChannelKey(agreementId: string): Promise<Buffer | null> {
    const agreement = await prisma.federationAgreement.findUnique({
        where: { id: agreementId },
        select: { channelKeyEncrypted: true, status: true }
    });

    if (!agreement || agreement.status !== "active") return null;

    return decryptChannelKey(agreement.channelKeyEncrypted as unknown as EncryptedPayload);
}
