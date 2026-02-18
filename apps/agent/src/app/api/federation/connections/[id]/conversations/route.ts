import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
        const offset = parseInt(searchParams.get("offset") || "0", 10);

        const agreement = await prisma.federationAgreement.findUnique({
            where: { id },
            select: {
                id: true,
                initiatorOrgId: true,
                responderOrgId: true,
                status: true
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

        const grouped = await prisma.federationMessage.groupBy({
            by: ["conversationId"],
            where: { agreementId: id },
            _min: { createdAt: true },
            _max: { createdAt: true },
            _count: { id: true },
            _sum: { costUsd: true, latencyMs: true },
            orderBy: { _max: { createdAt: "desc" } },
            take: limit,
            skip: offset
        });

        const totalCount = await prisma.federationMessage.groupBy({
            by: ["conversationId"],
            where: { agreementId: id }
        });

        const conversationIds = grouped.map((g) => g.conversationId);

        const firstMessages =
            conversationIds.length > 0
                ? await prisma.$queryRawUnsafe<
                      { conversationId: string; sourceAgentSlug: string; targetAgentSlug: string }[]
                  >(
                      `SELECT DISTINCT ON ("conversationId") "conversationId", "sourceAgentSlug", "targetAgentSlug"
                       FROM "federation_message"
                       WHERE "agreementId" = $1 AND "conversationId" = ANY($2::text[])
                       ORDER BY "conversationId", "createdAt" ASC`,
                      id,
                      conversationIds
                  )
                : [];

        const metadataMap = new Map(firstMessages.map((m) => [m.conversationId, m]));

        const threads = grouped.map((g) => {
            const meta = metadataMap.get(g.conversationId);
            return {
                conversationId: g.conversationId,
                firstMessageAt: g._min.createdAt,
                lastMessageAt: g._max.createdAt,
                sourceAgentSlug: meta?.sourceAgentSlug ?? null,
                targetAgentSlug: meta?.targetAgentSlug ?? null,
                messageCount: g._count.id,
                totalCostUsd: g._sum.costUsd ?? 0,
                totalLatencyMs: g._sum.latencyMs ?? 0
            };
        });

        return NextResponse.json({
            success: true,
            threads,
            total: totalCount.length,
            limit,
            offset
        });
    } catch (error) {
        console.error("[Federation] List conversations error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to list conversations" },
            { status: 500 }
        );
    }
}
