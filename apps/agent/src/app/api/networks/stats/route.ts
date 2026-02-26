import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
    const authContext = await authenticateRequest(request);
    if (!authContext) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);

        const from = searchParams.get("from");
        const to = searchParams.get("to");

        const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = to ? new Date(to) : new Date();

        const networks = await prisma.network.findMany({
            where: { workspace: { organizationId: authContext.organizationId } },
            orderBy: { createdAt: "desc" },
            include: {
                _count: { select: { primitives: true } }
            }
        });

        const runs = await prisma.networkRun.findMany({
            where: {
                network: { workspace: { organizationId: authContext.organizationId } },
                startedAt: {
                    gte: startDate,
                    lte: endDate
                }
            },
            select: {
                networkId: true,
                status: true,
                startedAt: true,
                durationMs: true,
                totalTokens: true,
                totalCostUsd: true
            }
        });

        const statsByNetwork = new Map<
            string,
            {
                totalRuns: number;
                completedRuns: number;
                failedRuns: number;
                queuedRuns: number;
                runningRuns: number;
                cancelledRuns: number;
                totalDurationMs: number;
                totalTokens: number;
                totalCostUsd: number;
                lastRunAt: Date | null;
                lastFailedAt: Date | null;
            }
        >();

        let totalRuns = 0;
        let completedRuns = 0;
        let failedRuns = 0;
        let queuedRuns = 0;
        let runningRuns = 0;
        let cancelledRuns = 0;
        let totalDurationMs = 0;
        let totalTokens = 0;
        let totalCostUsd = 0;

        for (const run of runs) {
            const existing = statsByNetwork.get(run.networkId) || {
                totalRuns: 0,
                completedRuns: 0,
                failedRuns: 0,
                queuedRuns: 0,
                runningRuns: 0,
                cancelledRuns: 0,
                totalDurationMs: 0,
                totalTokens: 0,
                totalCostUsd: 0,
                lastRunAt: null,
                lastFailedAt: null
            };

            const status = run.status?.toUpperCase();
            const startedAt = run.startedAt;

            existing.totalRuns += 1;
            totalRuns += 1;

            if (status === "COMPLETED") {
                existing.completedRuns += 1;
                completedRuns += 1;
                existing.totalDurationMs += run.durationMs || 0;
                totalDurationMs += run.durationMs || 0;
            } else if (status === "FAILED") {
                existing.failedRuns += 1;
                failedRuns += 1;
            } else if (status === "QUEUED") {
                existing.queuedRuns += 1;
                queuedRuns += 1;
            } else if (status === "RUNNING") {
                existing.runningRuns += 1;
                runningRuns += 1;
            } else if (status === "CANCELLED") {
                existing.cancelledRuns += 1;
                cancelledRuns += 1;
            }

            existing.totalTokens += run.totalTokens || 0;
            existing.totalCostUsd += run.totalCostUsd || 0;
            totalTokens += run.totalTokens || 0;
            totalCostUsd += run.totalCostUsd || 0;

            existing.lastRunAt =
                !existing.lastRunAt || startedAt > existing.lastRunAt
                    ? startedAt
                    : existing.lastRunAt;

            if (status === "FAILED") {
                existing.lastFailedAt =
                    !existing.lastFailedAt || startedAt > existing.lastFailedAt
                        ? startedAt
                        : existing.lastFailedAt;
            }

            statsByNetwork.set(run.networkId, existing);
        }

        const summary = {
            totalNetworks: networks.length,
            activeNetworks: networks.filter((network) => network.isActive).length,
            publishedNetworks: networks.filter((network) => network.isPublished).length,
            totalRuns,
            completedRuns,
            failedRuns,
            queuedRuns,
            runningRuns,
            cancelledRuns,
            successRate: totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0,
            avgLatencyMs: completedRuns > 0 ? Math.round(totalDurationMs / completedRuns) : 0,
            totalTokens,
            totalCostUsd
        };

        const networksWithStats = networks.map((network) => {
            const stats = statsByNetwork.get(network.id) || {
                totalRuns: 0,
                completedRuns: 0,
                failedRuns: 0,
                queuedRuns: 0,
                runningRuns: 0,
                cancelledRuns: 0,
                totalDurationMs: 0,
                totalTokens: 0,
                totalCostUsd: 0,
                lastRunAt: null,
                lastFailedAt: null
            };

            return {
                id: network.id,
                slug: network.slug,
                name: network.name,
                description: network.description,
                version: network.version,
                modelProvider: network.modelProvider,
                modelName: network.modelName,
                isPublished: network.isPublished,
                isActive: network.isActive,
                createdAt: network.createdAt,
                updatedAt: network.updatedAt,
                primitiveCount:
                    (network as unknown as { _count?: { primitives: number } })._count
                        ?.primitives ?? 0,
                stats: {
                    totalRuns: stats.totalRuns,
                    completedRuns: stats.completedRuns,
                    failedRuns: stats.failedRuns,
                    queuedRuns: stats.queuedRuns,
                    runningRuns: stats.runningRuns,
                    cancelledRuns: stats.cancelledRuns,
                    avgLatencyMs:
                        stats.completedRuns > 0
                            ? Math.round(stats.totalDurationMs / stats.completedRuns)
                            : 0,
                    totalTokens: stats.totalTokens,
                    totalCostUsd: stats.totalCostUsd,
                    lastRunAt: stats.lastRunAt?.toISOString() || null,
                    lastFailedAt: stats.lastFailedAt?.toISOString() || null
                }
            };
        });

        return NextResponse.json({
            success: true,
            summary,
            networks: networksWithStats,
            dateRange: {
                from: startDate.toISOString(),
                to: endDate.toISOString()
            }
        });
    } catch (error) {
        console.error("[Networks Stats] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to load network stats" },
            { status: 500 }
        );
    }
}
