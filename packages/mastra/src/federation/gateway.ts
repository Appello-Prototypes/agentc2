/**
 * Federation Gateway.
 *
 * Routes cross-org agent invocations through the security pipeline:
 * authenticate -> authorize -> policy check -> sign -> encrypt -> invoke -> decrypt -> verify -> respond
 */

import { prisma } from "@repo/database";
import { randomUUID } from "crypto";
import { encryptWithKey, decryptWithKey, isEncryptedPayload } from "../crypto/encryption";
import { signPayload, verifySignature } from "../crypto/signing";
import { getActiveOrgKeyPair, getOrgKeyPairByVersion } from "../crypto/keys";
import { writeFederationAuditPair } from "../audit";
import { evaluatePolicy } from "./policy";
import { getChannelKey } from "./agreements";
import type { EncryptedPayload } from "../crypto/types";
import type { FederationInvokeRequest, FederationInvokeResponse } from "./types";

/**
 * Process a federation invocation request through the full security pipeline.
 *
 * This is the single entry point for all cross-org agent communication.
 * The calling code (API route) is responsible for authenticating the
 * requesting user/agent's org identity before calling this.
 */
export async function processInvocation(
    sourceOrgId: string,
    request: FederationInvokeRequest,
    invokeAgent: (
        agentSlug: string,
        message: string,
        organizationId: string,
        conversationId: string
    ) => Promise<{
        response: string;
        runId?: string;
        inputTokens?: number;
        outputTokens?: number;
        costUsd?: number;
    }>
): Promise<FederationInvokeResponse> {
    const startTime = Date.now();
    const conversationId = request.conversationId || randomUUID();

    // 1. Resolve agreement and verify parties
    const agreement = await prisma.federationAgreement.findUnique({
        where: { id: request.agreementId },
        select: {
            id: true,
            status: true,
            initiatorOrgId: true,
            responderOrgId: true,
            channelKeyEncrypted: true
        }
    });

    if (!agreement) {
        return errorResponse(conversationId, "Agreement not found", startTime);
    }

    // Determine target org
    const targetOrgId =
        agreement.initiatorOrgId === sourceOrgId
            ? agreement.responderOrgId
            : agreement.initiatorOrgId;

    // 2. Policy evaluation (rate limits, authorization, data classification)
    const policy = await evaluatePolicy(request.agreementId, sourceOrgId, request.targetAgentSlug);

    if (!policy.allowed) {
        writeFederationAuditPair(
            sourceOrgId,
            targetOrgId,
            "federation.invoke",
            `agent:${request.targetAgentSlug}`,
            "denied",
            { reason: policy.reason, policyResult: policy.result }
        );
        return errorResponse(conversationId, policy.reason ?? "Policy denied", startTime);
    }

    // 3. Get crypto materials
    const [sourceKeyPair, channelKey] = await Promise.all([
        getActiveOrgKeyPair(sourceOrgId),
        getChannelKey(request.agreementId)
    ]);

    if (!sourceKeyPair || !channelKey) {
        return errorResponse(conversationId, "Security context unavailable", startTime);
    }

    // 4. Sign the outbound message
    const signature = signPayload(request.message, sourceKeyPair.encryptedPrivateKey);
    if (!signature) {
        return errorResponse(conversationId, "Message signing failed", startTime);
    }

    // 5. Encrypt the message with the channel key
    const encrypted = encryptWithKey(request.message, channelKey);

    // 6. Store the encrypted outbound message
    const direction =
        agreement.initiatorOrgId === sourceOrgId
            ? "initiator_to_responder"
            : "responder_to_initiator";

    await prisma.federationMessage.create({
        data: {
            agreementId: request.agreementId,
            conversationId,
            direction,
            sourceOrgId,
            sourceAgentSlug: "caller",
            targetOrgId,
            targetAgentSlug: request.targetAgentSlug,
            encryptedContent: JSON.stringify(encrypted),
            contentType: request.contentType ?? "text",
            iv: encrypted.iv,
            senderSignature: signature,
            senderKeyVersion: sourceKeyPair.keyVersion,
            policyResult: policy.result
        }
    });

    // 7. Invoke the target agent
    let agentResponse: {
        response: string;
        runId?: string;
        inputTokens?: number;
        outputTokens?: number;
        costUsd?: number;
    };
    try {
        // Resolve which workspace the target agent belongs to
        const targetWorkspace = await prisma.workspace.findFirst({
            where: { organizationId: targetOrgId, isDefault: true },
            select: { id: true }
        });

        agentResponse = await invokeAgent(
            request.targetAgentSlug,
            request.message,
            targetOrgId,
            conversationId
        );
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Agent invocation failed";
        writeFederationAuditPair(
            sourceOrgId,
            targetOrgId,
            "federation.invoke",
            `agent:${request.targetAgentSlug}`,
            "error",
            { error: errMsg }
        );
        return errorResponse(conversationId, errMsg, startTime);
    }

    // 8. Sign and encrypt the response
    const targetKeyPair = await getActiveOrgKeyPair(targetOrgId);
    const responseSignature = targetKeyPair
        ? signPayload(agentResponse.response, targetKeyPair.encryptedPrivateKey)
        : null;
    const encryptedResponse = encryptWithKey(agentResponse.response, channelKey);
    const latencyMs = Date.now() - startTime;

    // 9. Store the encrypted response
    const responseMessage = await prisma.federationMessage.create({
        data: {
            agreementId: request.agreementId,
            conversationId,
            direction:
                direction === "initiator_to_responder"
                    ? "responder_to_initiator"
                    : "initiator_to_responder",
            sourceOrgId: targetOrgId,
            sourceAgentSlug: request.targetAgentSlug,
            targetOrgId: sourceOrgId,
            targetAgentSlug: "caller",
            encryptedContent: JSON.stringify(encryptedResponse),
            contentType: "text",
            iv: encryptedResponse.iv,
            senderSignature: responseSignature ?? "",
            senderKeyVersion: targetKeyPair?.keyVersion ?? 0,
            latencyMs,
            inputTokens: agentResponse.inputTokens,
            outputTokens: agentResponse.outputTokens,
            costUsd: agentResponse.costUsd,
            runId: agentResponse.runId,
            policyResult: "approved"
        }
    });

    // 10. Audit
    writeFederationAuditPair(
        sourceOrgId,
        targetOrgId,
        "federation.invoke",
        `agent:${request.targetAgentSlug}`,
        "success",
        { conversationId, latencyMs, costUsd: agentResponse.costUsd }
    );

    return {
        success: true,
        conversationId,
        response: agentResponse.response,
        contentType: "text",
        latencyMs,
        messageId: responseMessage.id,
        policyResult: "approved"
    };
}

function errorResponse(
    conversationId: string,
    error: string,
    startTime: number
): FederationInvokeResponse {
    return {
        success: false,
        conversationId,
        response: "",
        contentType: "text",
        latencyMs: Date.now() - startTime,
        messageId: "",
        policyResult: "blocked",
        error
    };
}

/**
 * Verify a stored message's signature (for audit/forensics).
 */
export async function verifyStoredMessage(messageId: string): Promise<{
    verified: boolean;
    error?: string;
}> {
    const message = await prisma.federationMessage.findUnique({
        where: { id: messageId }
    });

    if (!message) return { verified: false, error: "Message not found" };

    // Decrypt the content
    const agreement = await prisma.federationAgreement.findUnique({
        where: { id: message.agreementId },
        select: { channelKeyEncrypted: true }
    });

    if (!agreement) return { verified: false, error: "Agreement not found" };

    const channelKey = await getChannelKey(message.agreementId);
    if (!channelKey) return { verified: false, error: "Channel key unavailable" };

    const encryptedContent = JSON.parse(message.encryptedContent);
    if (!isEncryptedPayload(encryptedContent)) {
        return { verified: false, error: "Invalid encrypted content format" };
    }

    const plaintext = decryptWithKey(encryptedContent, channelKey);
    if (!plaintext) return { verified: false, error: "Decryption failed" };

    // Get the signer's public key at the version used to sign
    const signerKey = await getOrgKeyPairByVersion(message.sourceOrgId, message.senderKeyVersion);
    if (!signerKey) return { verified: false, error: "Signer key not found" };

    const verified = verifySignature(plaintext, message.senderSignature, signerKey.publicKey);
    return { verified };
}
