import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";

export async function GET(request: NextRequest) {
    try {
        await requireAdminAction(request, "metrics:read");

        const url = new URL(request.url);
        const days = parseInt(url.searchParams.get("days") || "7");
        const since = new Date();
        since.setDate(since.getDate() - days);

        const [tenantCounts, dailyStats, dailyCosts] = await Promise.all([
            prisma.organization.groupBy({
                by: ["status"],
                _count: { id: true }
            }),
            prisma.agentStatsDaily.groupBy({
                by: ["date"],
                _sum: { totalRuns: true, totalCostUsd: true },
                _avg: { successRate: true },
                where: { date: { gte: since } },
                orderBy: { date: "desc" }
            }),
            prisma.agentCostDaily.groupBy({
                by: ["date"],
                _sum: { totalCostUsd: true },
                where: { date: { gte: since } },
                orderBy: { date: "desc" }
            })
        ]);

        return NextResponse.json({
            tenantCounts,
            dailyStats,
            dailyCosts
        });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
