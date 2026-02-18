import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

/**
 * GET /api/federation/metrics
 *
 * Aggregated metrics for a federation connection.
 *
 * Query params:
 * - connectionId:    Required. The federation agreement ID.
 * - includeMessages: If "true", include last 20 messages.
 */
export async function GET(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const connectionId = searchParams.get("connectionId");
        const includeMessages = searchParams.get("includeMessages") === "true";

        if (!connectionId) {
            return NextResponse.json(
                { success: false, error: "connectionId is required" },
                { status: 400 }
            );
        }

        const agreement = await prisma.federationAgreement.findUnique({
            where: { id: connectionId },
            select: {
                initiatorOrgId: true,
                responderOrgId: true,
                maxRequestsPerHour: true,
                maxRequestsPerDay: true
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

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Determine which direction = "sent from us" vs "received"
        const messages = await prisma.federationMessage.findMany({
            where: {
                agreementId: connectionId,
                createdAt: { gte: thirtyDaysAgo }
            },
            select: {
                id: true,
                direction: true,
                sourceOrgId: true,
                sourceAgentSlug: true,
                targetAgentSlug: true,
                latencyMs: true,
                policyResult: true,
                costUsd: true,
                createdAt: true
            },
            orderBy: { createdAt: "desc" }
        });

        const sent = messages.filter((m) => m.sourceOrgId === authContext.organizationId).length;
        const received = messages.filter(
            (m) => m.sourceOrgId !== authContext.organizationId
        ).length;
        const errors = messages.filter((m) => m.policyResult === "blocked").length;
        const errorRate = messages.length > 0 ? errors / messages.length : 0;

        const latencies = messages.map((m) => m.latencyMs).filter((l): l is number => l != null);
        const avgLatencyMs =
            latencies.length > 0
                ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
                : 0;

        const totalCostUsd = messages.reduce((sum, m) => sum + (m.costUsd ?? 0), 0);

        // Daily volume for last 7 days
        const dailyMap = new Map<string, number>();
        const last7 = messages.filter((m) => m.createdAt >= sevenDaysAgo);
        for (const m of last7) {
            const day = m.createdAt.toISOString().slice(0, 10);
            dailyMap.set(day, (dailyMap.get(day) || 0) + 1);
        }
        const dailyVolume = Array.from(dailyMap.entries())
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // Approximate hourly rate limit utilization
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const lastHourCount = messages.filter((m) => m.createdAt >= oneHourAgo).length;
        const lastDayCount = messages.filter(
            (m) => m.createdAt >= new Date(Date.now() - 24 * 60 * 60 * 1000)
        ).length;

        const result: Record<string, unknown> = {
            messageCount: { sent, received },
            avgLatencyMs,
            errorRate: Math.round(errorRate * 10000) / 10000,
            totalCostUsd: Math.round(totalCostUsd * 100) / 100,
            rateLimitUtilization: {
                hourly:
                    agreement.maxRequestsPerHour > 0
                        ? Math.round((lastHourCount / agreement.maxRequestsPerHour) * 10000) / 10000
                        : 0,
                daily:
                    agreement.maxRequestsPerDay > 0
                        ? Math.round((lastDayCount / agreement.maxRequestsPerDay) * 10000) / 10000
                        : 0
            },
            dailyVolume
        };

        if (includeMessages) {
            result.recentMessages = messages.slice(0, 20).map((m) => ({
                id: m.id,
                direction: m.sourceOrgId === authContext.organizationId ? "outbound" : "inbound",
                sourceAgentSlug: m.sourceAgentSlug,
                targetAgentSlug: m.targetAgentSlug,
                latencyMs: m.latencyMs,
                status: m.policyResult === "blocked" ? "error" : "delivered",
                createdAt: m.createdAt
            }));
        }

        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error("[Federation] Metrics error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch metrics" },
            { status: 500 }
        );
    }
}
