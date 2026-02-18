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

        const agreement = await prisma.federationAgreement.findUnique({
            where: { id: agreementId },
            include: {
                initiatorOrg: { select: { id: true, name: true, slug: true } },
                responderOrg: { select: { id: true, name: true, slug: true } },
                exposures: {
                    include: {
                        ownerOrg: { select: { id: true, name: true, slug: true } },
                        agent: { select: { id: true, slug: true, name: true } }
                    }
                },
                _count: { select: { messages: true } }
            }
        });

        if (!agreement) {
            return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
        }

        const messageStats = await prisma.federationMessage.aggregate({
            where: { agreementId },
            _sum: { costUsd: true, inputTokens: true, outputTokens: true },
            _avg: { latencyMs: true },
            _count: true
        });

        const lastMessage = await prisma.federationMessage.findFirst({
            where: { agreementId },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true }
        });

        return NextResponse.json({
            agreement: {
                ...agreement,
                channelKeyEncrypted: undefined,
                stats: {
                    totalMessages: messageStats._count,
                    totalCostUsd: messageStats._sum.costUsd ?? 0,
                    totalInputTokens: messageStats._sum.inputTokens ?? 0,
                    totalOutputTokens: messageStats._sum.outputTokens ?? 0,
                    avgLatencyMs: messageStats._avg.latencyMs
                        ? Math.round(messageStats._avg.latencyMs)
                        : null,
                    lastActivity: lastMessage?.createdAt ?? null
                }
            }
        });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[Admin Federation Detail] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
