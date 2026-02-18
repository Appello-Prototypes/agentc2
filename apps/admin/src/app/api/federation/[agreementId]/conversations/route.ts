import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ agreementId: string }> }
) {
    try {
        await requireAdminAction(request, "federation:read");
        const { agreementId } = await params;

        const url = new URL(request.url);
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "25"), 100);
        const offset = parseInt(url.searchParams.get("offset") || "0");

        const agreement = await prisma.federationAgreement.findUnique({
            where: { id: agreementId },
            select: { id: true }
        });
        if (!agreement) {
            return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
        }

        const messages = await prisma.federationMessage.findMany({
            where: { agreementId },
            orderBy: { createdAt: "desc" },
            select: {
                conversationId: true,
                direction: true,
                sourceOrgId: true,
                sourceAgentSlug: true,
                targetOrgId: true,
                targetAgentSlug: true,
                costUsd: true,
                createdAt: true
            }
        });

        const threadMap = new Map<
            string,
            {
                conversationId: string;
                messageCount: number;
                firstMessageAt: Date;
                lastMessageAt: Date;
                totalCostUsd: number;
                participants: Set<string>;
            }
        >();

        for (const msg of messages) {
            const existing = threadMap.get(msg.conversationId);
            const participant = `${msg.sourceOrgId}:${msg.sourceAgentSlug}`;
            if (existing) {
                existing.messageCount++;
                if (msg.createdAt < existing.firstMessageAt)
                    existing.firstMessageAt = msg.createdAt;
                if (msg.createdAt > existing.lastMessageAt) existing.lastMessageAt = msg.createdAt;
                existing.totalCostUsd += msg.costUsd ?? 0;
                existing.participants.add(participant);
            } else {
                threadMap.set(msg.conversationId, {
                    conversationId: msg.conversationId,
                    messageCount: 1,
                    firstMessageAt: msg.createdAt,
                    lastMessageAt: msg.createdAt,
                    totalCostUsd: msg.costUsd ?? 0,
                    participants: new Set([participant])
                });
            }
        }

        const allThreads = Array.from(threadMap.values()).sort(
            (a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime()
        );

        const total = allThreads.length;
        const threads = allThreads.slice(offset, offset + limit).map((t) => ({
            conversationId: t.conversationId,
            messageCount: t.messageCount,
            firstMessageAt: t.firstMessageAt,
            lastMessageAt: t.lastMessageAt,
            totalCostUsd: t.totalCostUsd,
            participants: Array.from(t.participants)
        }));

        return NextResponse.json({ threads, total, limit, offset });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[Admin Federation Conversations] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
