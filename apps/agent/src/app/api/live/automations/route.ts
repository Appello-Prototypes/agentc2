import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";
import { requireMonitoringWorkspace } from "@/lib/monitoring-auth";

/**
 * GET /api/live/automations
 *
 * Returns a cross-agent list of all configured automations (schedules, triggers,
 * and implicit Slack listeners) with aggregated health metrics.
 *
 * Query Parameters:
 *   - includeArchived: "true" to include archived automations (hidden by default)
 *   - workspaceId: workspace filter
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const requestedWorkspaceId = searchParams.get("workspaceId");
        const includeArchived = searchParams.get("includeArchived") === "true";

        const workspaceContext = await requireMonitoringWorkspace(requestedWorkspaceId, request);
        if (!workspaceContext.ok) {
            return NextResponse.json(
                { success: false, error: workspaceContext.error },
                { status: workspaceContext.status }
            );
        }

        const wsFilter = {
            OR: [{ workspaceId: workspaceContext.workspaceId }, { workspaceId: null }]
        } satisfies Prisma.AgentScheduleWhereInput;

        const archiveFilter = includeArchived ? {} : { isArchived: false };

        // Fetch all schedules and triggers across all agents
        const [schedules, triggers] = await Promise.all([
            prisma.agentSchedule.findMany({
                where: { ...wsFilter, ...archiveFilter },
                include: {
                    agent: { select: { id: true, slug: true, name: true } }
                },
                orderBy: { createdAt: "desc" }
            }),
            prisma.agentTrigger.findMany({
                where: {
                    ...(wsFilter as Prisma.AgentTriggerWhereInput),
                    ...archiveFilter
                },
                include: {
                    agent: { select: { id: true, slug: true, name: true } }
                },
                orderBy: { createdAt: "desc" }
            })
        ]);

        // Collect all source IDs to fetch aggregated run stats
        const allSourceIds = [...schedules.map((s) => s.id), ...triggers.map((t) => t.id)];

        // Fetch aggregated run stats per triggerId
        const runStats =
            allSourceIds.length > 0
                ? await prisma.agentRun.groupBy({
                      by: ["triggerId"],
                      where: {
                          triggerId: { in: allSourceIds }
                      },
                      _count: { _all: true },
                      _avg: { durationMs: true }
                  })
                : [];

        // Fetch success/failure counts separately
        const successCounts =
            allSourceIds.length > 0
                ? await prisma.agentRun.groupBy({
                      by: ["triggerId"],
                      where: {
                          triggerId: { in: allSourceIds },
                          status: "COMPLETED"
                      },
                      _count: { _all: true }
                  })
                : [];

        const failedCounts =
            allSourceIds.length > 0
                ? await prisma.agentRun.groupBy({
                      by: ["triggerId"],
                      where: {
                          triggerId: { in: allSourceIds },
                          status: "FAILED"
                      },
                      _count: { _all: true }
                  })
                : [];

        // Fetch last run per triggerId
        const lastRuns =
            allSourceIds.length > 0
                ? await prisma.agentRun.findMany({
                      where: {
                          triggerId: { in: allSourceIds }
                      },
                      orderBy: { startedAt: "desc" },
                      distinct: ["triggerId"],
                      select: {
                          id: true,
                          triggerId: true,
                          status: true,
                          startedAt: true,
                          completedAt: true,
                          durationMs: true
                      }
                  })
                : [];

        // Build lookup maps
        const statsMap = new Map(
            runStats.map((r) => [r.triggerId, { total: r._count._all, avgMs: r._avg.durationMs }])
        );
        const successMap = new Map(successCounts.map((r) => [r.triggerId, r._count._all]));
        const failedMap = new Map(failedCounts.map((r) => [r.triggerId, r._count._all]));
        const lastRunMap = new Map(lastRuns.map((r) => [r.triggerId, r]));

        // Build automation entries from schedules
        const scheduleAutomations = schedules.map((s) => {
            const total = statsMap.get(s.id)?.total ?? s.runCount ?? 0;
            const success = successMap.get(s.id) ?? 0;
            const failed = failedMap.get(s.id) ?? 0;
            const avgMs = statsMap.get(s.id)?.avgMs ?? null;
            const lr = lastRunMap.get(s.id) ?? null;

            return {
                id: `schedule:${s.id}`,
                sourceType: "schedule" as const,
                type: "scheduled" as const,
                name: s.name,
                description: s.description,
                isActive: s.isActive,
                isArchived: s.isArchived,
                archivedAt: s.archivedAt,
                agent: s.agent,
                config: {
                    cronExpr: s.cronExpr,
                    timezone: s.timezone,
                    color: s.color,
                    task: s.task
                },
                stats: {
                    totalRuns: total,
                    successRuns: success,
                    failedRuns: failed,
                    successRate: total > 0 ? Math.round((success / total) * 100) : 0,
                    avgDurationMs: avgMs ? Math.round(avgMs) : null,
                    lastRunAt: s.lastRunAt,
                    nextRunAt: s.nextRunAt
                },
                lastRun: lr
                    ? {
                          id: lr.id,
                          status: lr.status,
                          startedAt: lr.startedAt,
                          completedAt: lr.completedAt,
                          durationMs: lr.durationMs
                      }
                    : null,
                createdAt: s.createdAt
            };
        });

        // Build automation entries from triggers
        const triggerAutomations = triggers.map((t) => {
            const total = statsMap.get(t.id)?.total ?? t.triggerCount ?? 0;
            const success = successMap.get(t.id) ?? 0;
            const failed = failedMap.get(t.id) ?? 0;
            const avgMs = statsMap.get(t.id)?.avgMs ?? null;
            const lr = lastRunMap.get(t.id) ?? null;

            return {
                id: `trigger:${t.id}`,
                sourceType: "trigger" as const,
                type: t.triggerType as string,
                name: t.name,
                description: t.description,
                isActive: t.isActive,
                isArchived: t.isArchived,
                archivedAt: t.archivedAt,
                agent: t.agent,
                config: {
                    eventName: t.eventName,
                    webhookPath: t.webhookPath,
                    color: t.color
                },
                stats: {
                    totalRuns: total,
                    successRuns: success,
                    failedRuns: failed,
                    successRate: total > 0 ? Math.round((success / total) * 100) : 0,
                    avgDurationMs: avgMs ? Math.round(avgMs) : null,
                    lastRunAt: t.lastTriggeredAt,
                    nextRunAt: null
                },
                lastRun: lr
                    ? {
                          id: lr.id,
                          status: lr.status,
                          startedAt: lr.startedAt,
                          completedAt: lr.completedAt,
                          durationMs: lr.durationMs
                      }
                    : null,
                createdAt: t.createdAt
            };
        });

        // Combine all automations (Slack listeners are now real AgentTrigger records
        // with triggerType "slack_listener", so they appear in triggerAutomations)
        const automations = [...scheduleAutomations, ...triggerAutomations];

        // Summary metrics
        const summary = {
            total: automations.length,
            active: automations.filter((a) => a.isActive).length,
            archived: automations.filter((a) => a.isArchived).length,
            schedules: scheduleAutomations.length,
            triggers: triggerAutomations.length,
            implicit: 0,
            overallSuccessRate: (() => {
                const totalRuns = automations.reduce((acc, a) => acc + (a.stats.totalRuns || 0), 0);
                const successRuns = automations.reduce(
                    (acc, a) => acc + (a.stats.successRuns || 0),
                    0
                );
                return totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0;
            })()
        };

        return NextResponse.json({
            success: true,
            automations,
            summary
        });
    } catch (error) {
        console.error("[Automations Registry] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch automations" },
            { status: 500 }
        );
    }
}
