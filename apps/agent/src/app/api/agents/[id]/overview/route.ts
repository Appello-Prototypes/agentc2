import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /api/agents/[id]/overview
 *
 * Get overview stats for an agent
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);

        const from = searchParams.get("from");
        const to = searchParams.get("to");

        // Default to last 7 days if no date range provided
        const startDate = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const endDate = to ? new Date(to) : new Date();

        // Find agent by slug or id
        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id: id }]
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        // Get run statistics
        const runs = await prisma.agentRun.findMany({
            where: {
                agentId: agent.id,
                startedAt: {
                    gte: startDate,
                    lte: endDate
                }
            },
            select: {
                status: true,
                durationMs: true,
                totalTokens: true,
                costUsd: true
            }
        });

        const totalRuns = runs.length;
        const completedRuns = runs.filter((r) => r.status === "COMPLETED").length;
        const failedRuns = runs.filter((r) => r.status === "FAILED").length;
        const successRate = totalRuns > 0 ? (completedRuns / totalRuns) * 100 : 0;

        const durations = runs.filter((r) => r.durationMs).map((r) => r.durationMs!);
        const avgDurationMs =
            durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

        const totalTokens = runs.reduce((sum, r) => sum + (r.totalTokens || 0), 0);
        const totalCostUsd = runs.reduce((sum, r) => sum + (r.costUsd || 0), 0);

        // Get recent runs
        const recentRuns = await prisma.agentRun.findMany({
            where: { agentId: agent.id },
            orderBy: { startedAt: "desc" },
            take: 5,
            select: {
                id: true,
                runType: true,
                status: true,
                inputText: true,
                durationMs: true,
                startedAt: true,
                totalTokens: true,
                costUsd: true
            }
        });

        // Get active alerts
        const alerts = await prisma.agentAlert.findMany({
            where: {
                agentId: agent.id,
                resolvedAt: null
            },
            orderBy: { createdAt: "desc" },
            take: 5
        });

        // Calculate health status
        let health: "healthy" | "warning" | "critical" = "healthy";
        if (failedRuns > 0 && failedRuns / totalRuns > 0.2) {
            health = "critical";
        } else if (alerts.some((a) => a.severity === "CRITICAL")) {
            health = "critical";
        } else if (alerts.some((a) => a.severity === "WARNING") || failedRuns > 0) {
            health = "warning";
        }

        // Get evaluations summary
        const evaluations = await prisma.agentEvaluation.findMany({
            where: {
                agentId: agent.id,
                createdAt: {
                    gte: startDate,
                    lte: endDate
                }
            },
            select: { scoresJson: true }
        });

        // Calculate average quality score from evaluations
        let avgQualityScore = 0;
        if (evaluations.length > 0) {
            const scores = evaluations
                .filter((e) => e.scoresJson)
                .map((e) => {
                    const json = e.scoresJson as Record<string, number>;
                    const values = Object.values(json).filter((v) => typeof v === "number");
                    return values.length > 0
                        ? values.reduce((a, b) => a + b, 0) / values.length
                        : 0;
                });
            avgQualityScore =
                scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        }

        // ============================================
        // Continuous Learning Metrics
        // ============================================

        // Get learning policy status
        const learningPolicy = await prisma.learningPolicy.findUnique({
            where: { agentId: agent.id }
        });

        // Get active experiments count
        const activeExperiments = await prisma.learningExperiment.count({
            where: {
                session: { agentId: agent.id },
                status: { in: ["PENDING", "RUNNING"] }
            }
        });

        // Get latest learning session
        const latestSession = await prisma.learningSession.findFirst({
            where: { agentId: agent.id },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                status: true,
                createdAt: true,
                metadata: true
            }
        });

        // Get learning metrics from the past 7 days
        const learningMetrics = await prisma.learningMetricDaily.findMany({
            where: {
                agentId: agent.id,
                date: {
                    gte: startDate,
                    lte: endDate
                }
            },
            select: {
                autoPromotions: true,
                manualPromotions: true,
                shadowRunCount: true,
                baselineRunCount: true,
                candidateRunCount: true,
                scheduledTriggers: true,
                thresholdTriggers: true
            }
        });

        // Aggregate learning metrics
        const learningStats = {
            autoPromotions: learningMetrics.reduce((sum, m) => sum + (m.autoPromotions || 0), 0),
            manualPromotions: learningMetrics.reduce(
                (sum, m) => sum + (m.manualPromotions || 0),
                0
            ),
            shadowRunCount: learningMetrics.reduce((sum, m) => sum + (m.shadowRunCount || 0), 0),
            scheduledTriggers: learningMetrics.reduce(
                (sum, m) => sum + (m.scheduledTriggers || 0),
                0
            ),
            thresholdTriggers: learningMetrics.reduce(
                (sum, m) => sum + (m.thresholdTriggers || 0),
                0
            )
        };

        // Determine continuous learning health
        let learningHealth: "active" | "paused" | "inactive" = "inactive";
        if (learningPolicy) {
            if (learningPolicy.paused) {
                learningHealth = "paused";
            } else if (learningPolicy.enabled) {
                learningHealth = "active";
            }
        }

        // ============================================
        // Adversarial Hardened Badge
        // ============================================
        const latestRedTeamSession = await prisma.simulationSession.findFirst({
            where: {
                agentId: agent.id,
                theme: { startsWith: "redteam" },
                status: "COMPLETED",
                safetyScore: { not: null }
            },
            orderBy: { completedAt: "desc" },
            select: {
                id: true,
                theme: true,
                safetyScore: true,
                safetyPassCount: true,
                safetyFailCount: true,
                completedAt: true
            }
        });

        const isAdversarialHardened =
            latestRedTeamSession !== null &&
            latestRedTeamSession.safetyScore !== null &&
            latestRedTeamSession.safetyScore >= 0.85 &&
            latestRedTeamSession.safetyPassCount /
                Math.max(
                    1,
                    latestRedTeamSession.safetyPassCount + latestRedTeamSession.safetyFailCount
                ) >=
                0.9;

        return NextResponse.json({
            success: true,
            stats: {
                totalRuns,
                completedRuns,
                failedRuns,
                successRate: Math.round(successRate * 100) / 100,
                avgDurationMs: Math.round(avgDurationMs),
                totalTokens,
                totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
                avgQualityScore: Math.round(avgQualityScore * 100) / 100
            },
            recentRuns: recentRuns.map((run) => ({
                id: run.id,
                runType: run.runType,
                status: run.status,
                inputPreview:
                    run.inputText.slice(0, 100) + (run.inputText.length > 100 ? "..." : ""),
                durationMs: run.durationMs,
                startedAt: run.startedAt,
                tokens: run.totalTokens,
                cost: run.costUsd
            })),
            alerts: alerts.map((alert) => ({
                id: alert.id,
                severity: alert.severity,
                message: alert.message,
                source: alert.source,
                createdAt: alert.createdAt
            })),
            health,
            agent: {
                id: agent.id,
                slug: agent.slug,
                name: agent.name,
                isActive: agent.isActive,
                version: agent.version
            },
            dateRange: {
                from: startDate.toISOString(),
                to: endDate.toISOString()
            },
            // Adversarial Hardened
            isAdversarialHardened,
            latestRedTeamSession: latestRedTeamSession
                ? {
                      id: latestRedTeamSession.id,
                      theme: latestRedTeamSession.theme,
                      safetyScore: latestRedTeamSession.safetyScore,
                      completedAt: latestRedTeamSession.completedAt
                  }
                : null,
            // Continuous Learning section
            learning: {
                status: learningHealth,
                policy: learningPolicy
                    ? {
                          enabled: learningPolicy.enabled,
                          autoPromotionEnabled: learningPolicy.autoPromotionEnabled,
                          scheduledEnabled: learningPolicy.scheduledEnabled,
                          thresholdEnabled: learningPolicy.thresholdEnabled,
                          paused: learningPolicy.paused,
                          pausedUntil: learningPolicy.pausedUntil
                      }
                    : null,
                activeExperiments,
                latestSession: latestSession
                    ? {
                          id: latestSession.id,
                          status: latestSession.status,
                          createdAt: latestSession.createdAt,
                          triggerType: (latestSession.metadata as Record<string, unknown>)
                              ?.triggerType
                      }
                    : null,
                stats: learningStats
            }
        });
    } catch (error) {
        console.error("[Agent Overview] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get overview"
            },
            { status: 500 }
        );
    }
}
