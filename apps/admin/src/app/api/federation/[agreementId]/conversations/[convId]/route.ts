import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";
import { getChannelKey } from "@repo/mastra/federation";
import { decryptWithKey } from "@repo/mastra/crypto";
import type { EncryptedPayload } from "@repo/mastra/crypto";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ agreementId: string; convId: string }> }
) {
    try {
        await requireAdminAction(request, "federation:read");
        const { agreementId, convId } = await params;

        const agreement = await prisma.federationAgreement.findUnique({
            where: { id: agreementId },
            include: {
                initiatorOrg: { select: { id: true, name: true, slug: true } },
                responderOrg: { select: { id: true, name: true, slug: true } }
            }
        });
        if (!agreement) {
            return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
        }

        const messages = await prisma.federationMessage.findMany({
            where: { agreementId, conversationId: convId },
            orderBy: { createdAt: "asc" }
        });

        if (messages.length === 0) {
            return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
        }

        const channelKey = await getChannelKey(agreementId);

        const decryptedMessages = messages.map((msg) => {
            let content: string | null = null;
            if (channelKey) {
                try {
                    const encrypted: EncryptedPayload = JSON.parse(msg.encryptedContent);
                    content = decryptWithKey(encrypted, channelKey);
                } catch {
                    content = null;
                }
            }

            return {
                id: msg.id,
                conversationId: msg.conversationId,
                direction: msg.direction,
                sourceOrgId: msg.sourceOrgId,
                sourceAgentSlug: msg.sourceAgentSlug,
                targetOrgId: msg.targetOrgId,
                targetAgentSlug: msg.targetAgentSlug,
                contentType: msg.contentType,
                content,
                decrypted: content !== null,
                latencyMs: msg.latencyMs,
                inputTokens: msg.inputTokens,
                outputTokens: msg.outputTokens,
                costUsd: msg.costUsd,
                policyResult: msg.policyResult,
                runId: msg.runId,
                createdAt: msg.createdAt
            };
        });

        return NextResponse.json({
            agreementId,
            conversationId: convId,
            initiatorOrg: agreement.initiatorOrg,
            responderOrg: agreement.responderOrg,
            messages: decryptedMessages
        });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[Admin Federation Conversation Detail] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
