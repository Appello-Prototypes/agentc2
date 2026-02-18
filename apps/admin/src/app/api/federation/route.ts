import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";

export async function GET(request: NextRequest) {
    try {
        await requireAdminAction(request, "federation:list");

        const url = new URL(request.url);
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "25"), 100);
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const status = url.searchParams.get("status") || undefined;

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const where = status ? { status } : {};

        const [agreements, total] = await Promise.all([
            prisma.federationAgreement.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: offset,
                take: limit,
                include: {
                    initiatorOrg: { select: { id: true, name: true, slug: true } },
                    responderOrg: { select: { id: true, name: true, slug: true } },
                    _count: { select: { messages: true } },
                    messages: {
                        where: { createdAt: { gte: thirtyDaysAgo } },
                        select: {
                            costUsd: true,
                            createdAt: true
                        },
                        orderBy: { createdAt: "desc" }
                    }
                }
            }),
            prisma.federationAgreement.count({ where })
        ]);

        const data = agreements.map((a) => ({
            id: a.id,
            status: a.status,
            initiatorOrg: a.initiatorOrg,
            responderOrg: a.responderOrg,
            messageCount: a._count.messages,
            lastActivity: a.messages[0]?.createdAt ?? null,
            totalCostUsd: a.messages.reduce((sum, m) => sum + (m.costUsd ?? 0), 0),
            createdAt: a.createdAt
        }));

        return NextResponse.json({ agreements: data, total, limit, offset });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[Admin Federation] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
