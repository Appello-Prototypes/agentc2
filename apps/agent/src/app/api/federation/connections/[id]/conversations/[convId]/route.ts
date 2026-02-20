import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";
import { getChannelKey } from "@repo/agentc2/federation";
import { decryptWithKey, verifySignature, getOrgKeyPairByVersion } from "@repo/agentc2/crypto";
import type { EncryptedPayload } from "@repo/agentc2/crypto";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; convId: string }> }
) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { id: agreementId, convId: conversationId } = await params;

        const agreement = await prisma.federationAgreement.findUnique({
            where: { id: agreementId },
            include: {
                initiatorOrg: { select: { id: true, name: true, slug: true } },
                responderOrg: { select: { id: true, name: true, slug: true } }
            }
        });

        if (!agreement) {
            return NextResponse.json(
                { success: false, error: "Connection not found" },
                { status: 404 }
            );
        }

        if (
            agreement.initiatorOrgId !== authContext.organizationId &&
            agreement.responderOrgId !== authContext.organizationId
        ) {
            return NextResponse.json({ success: false, error: "Not authorized" }, { status: 403 });
        }

        const messages = await prisma.federationMessage.findMany({
            where: { agreementId, conversationId },
            orderBy: { createdAt: "asc" }
        });

        if (messages.length === 0) {
            return NextResponse.json(
                { success: false, error: "Conversation not found" },
                { status: 404 }
            );
        }

        const channelKey = await getChannelKey(agreementId);
        if (!channelKey) {
            return NextResponse.json(
                { success: false, error: "Unable to retrieve channel key" },
                { status: 500 }
            );
        }

        const keyCache = new Map<string, string | null>();

        const decryptedMessages = await Promise.all(
            messages.map(async (msg) => {
                let content: string | null = null;
                try {
                    const encrypted: EncryptedPayload = JSON.parse(msg.encryptedContent);
                    content = decryptWithKey(encrypted, channelKey);
                } catch {
                    content = null;
                }

                let signatureVerified = false;
                if (content && msg.senderSignature) {
                    const cacheKey = `${msg.sourceOrgId}:${msg.senderKeyVersion}`;
                    let publicKey = keyCache.get(cacheKey);
                    if (publicKey === undefined) {
                        const keyPair = await getOrgKeyPairByVersion(
                            msg.sourceOrgId,
                            msg.senderKeyVersion
                        );
                        publicKey = keyPair?.publicKey ?? null;
                        keyCache.set(cacheKey, publicKey);
                    }
                    if (publicKey) {
                        try {
                            signatureVerified = verifySignature(
                                content,
                                msg.senderSignature,
                                publicKey
                            );
                        } catch {
                            signatureVerified = false;
                        }
                    }
                }

                return {
                    id: msg.id,
                    direction: msg.direction,
                    sourceOrgId: msg.sourceOrgId,
                    sourceAgentSlug: msg.sourceAgentSlug,
                    targetOrgId: msg.targetOrgId,
                    targetAgentSlug: msg.targetAgentSlug,
                    content,
                    contentType: msg.contentType,
                    signatureVerified,
                    policyResult: msg.policyResult,
                    policyDetails: msg.policyDetails,
                    latencyMs: msg.latencyMs,
                    inputTokens: msg.inputTokens,
                    outputTokens: msg.outputTokens,
                    costUsd: msg.costUsd,
                    runId: msg.runId,
                    createdAt: msg.createdAt
                };
            })
        );

        const totalCostUsd = messages.reduce((sum, m) => sum + (m.costUsd ?? 0), 0);
        const firstAt = messages[0]!.createdAt.getTime();
        const lastAt = messages[messages.length - 1]!.createdAt.getTime();

        const policyBreakdown = { approved: 0, filtered: 0, blocked: 0 };
        for (const msg of messages) {
            const result = msg.policyResult as keyof typeof policyBreakdown;
            if (result in policyBreakdown) {
                policyBreakdown[result]++;
            }
        }

        return NextResponse.json({
            success: true,
            conversationId,
            agreement: {
                id: agreement.id,
                initiatorOrg: agreement.initiatorOrg,
                responderOrg: agreement.responderOrg
            },
            messages: decryptedMessages,
            summary: {
                messageCount: messages.length,
                totalCostUsd,
                durationMs: lastAt - firstAt,
                policyBreakdown,
                allSignaturesVerified: decryptedMessages.every((m) => m.signatureVerified)
            }
        });
    } catch (error) {
        console.error("[Federation] Get conversation error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to get conversation" },
            { status: 500 }
        );
    }
}
