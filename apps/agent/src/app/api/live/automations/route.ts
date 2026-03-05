import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";
import { requireMonitoringWorkspace } from "@/lib/monitoring-auth";

/**
 * GET /api/live/automations
 *
 * Returns a cross-primitive list of all configured automations (schedules, triggers,
 * campaign schedules, campaign triggers, and pulse eval cycles) with aggregated
 * health metrics, cost data, and per-primitive-type breakdown.
 *
 * Query Parameters:
 *   - includeArchived: "true" to include archived automations
 *   - workspaceId: workspace filter
 *   - primitiveType: "agent" | "workflow" | "network" | "campaign" | "pulse" to filter
 *   - entityId: filter to a specific entity
 *   - entitySlug: filter to a specific entity by slug
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const requestedWorkspaceId = searchParams.get("workspaceId");
        const includeArchived = searchParams.get("includeArchived") === "true";
        const primitiveType = searchParams.get("primitiveType");
        const entityId = searchParams.get("entityId");
        const entitySlug = searchParams.get("entitySlug");

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

        const shouldInclude = (type: string) => !primitiveType || primitiveType === type;

        const orgWorkspaceIds = (
            await prisma.workspace.findMany({
                where: { organizationId: workspaceContext.organizationId },
                select: { id: true }
            })
        ).map((w) => w.id);

        const orgMemberIds = (
            await prisma.membership.findMany({
                where: { organizationId: workspaceContext.organizationId },
                select: { userId: true }
            })
        ).map((m) => m.userId);

        // ── Agent Schedules ──
        const schedules = shouldInclude("agent")
            ? await prisma.agentSchedule.findMany({
                  where: {
                      ...wsFilter,
                      ...archiveFilter,
                      ...(entityId ? { agentId: entityId } : {}),
                      ...(entitySlug ? { agent: { slug: entitySlug } } : {})
                  },
                  include: {
                      agent: { select: { id: true, slug: true, name: true } }
                  },
                  orderBy: { createdAt: "desc" }
              })
            : [];

        // ── Agent/Workflow/Network Triggers ──
        const triggerEntityFilter: Prisma.AgentTriggerWhereInput = {};
        if (primitiveType === "agent") triggerEntityFilter.entityType = "agent";
        else if (primitiveType === "workflow") triggerEntityFilter.entityType = "workflow";
        else if (primitiveType === "network") triggerEntityFilter.entityType = "network";
        if (entityId) {
            triggerEntityFilter.OR = [
                { agentId: entityId },
                { workflowId: entityId },
                { networkId: entityId }
            ];
        }
        if (entitySlug) {
            triggerEntityFilter.OR = [
                { agent: { slug: entitySlug } },
                { workflow: { slug: entitySlug } },
                { network: { slug: entitySlug } }
            ];
        }

        const triggers =
            shouldInclude("agent") || shouldInclude("workflow") || shouldInclude("network")
                ? await prisma.agentTrigger.findMany({
                      where: {
                          ...(wsFilter as Prisma.AgentTriggerWhereInput),
                          ...archiveFilter,
                          ...triggerEntityFilter
                      },
                      include: {
                          agent: { select: { id: true, slug: true, name: true } },
                          workflow: { select: { id: true, slug: true, name: true } },
                          network: { select: { id: true, slug: true, name: true } }
                      },
                      orderBy: { createdAt: "desc" }
                  })
                : [];

        // ── Campaign Schedules ──
        const campaignSchedules = shouldInclude("campaign")
            ? await prisma.campaignSchedule.findMany({
                  where: {
                      isActive: true,
                      ...(entityId ? { templateId: entityId } : {}),
                      template: {
                          OR: [{ createdBy: { in: orgMemberIds } }, { isSystem: true }]
                      }
                  },
                  include: {
                      template: { select: { id: true, slug: true, name: true } }
                  },
                  orderBy: { createdAt: "desc" }
              })
            : [];

        // ── Campaign Triggers ──
        const campaignTriggers = shouldInclude("campaign")
            ? await prisma.campaignTrigger.findMany({
                  where: {
                      isActive: true,
                      ...(entityId ? { templateId: entityId } : {}),
                      template: {
                          OR: [{ createdBy: { in: orgMemberIds } }, { isSystem: true }]
                      }
                  },
                  include: {
                      template: { select: { id: true, slug: true, name: true } }
                  },
                  orderBy: { createdAt: "desc" }
              })
            : [];

        // ── Pulse Eval Cycles ──
        const pulses = shouldInclude("pulse")
            ? await prisma.pulse.findMany({
                  where: {
                      status: "ACTIVE",
                      evalCronExpr: { not: "" },
                      ...(entityId ? { id: entityId } : {}),
                      ...(entitySlug ? { slug: entitySlug } : {}),
                      OR: [
                          { workspaceId: { in: orgWorkspaceIds } },
                          { tenantId: workspaceContext.organizationId }
                      ]
                  },
                  select: {
                      id: true,
                      slug: true,
                      name: true,
                      evalCronExpr: true,
                      status: true,
                      createdAt: true
                  },
                  orderBy: { createdAt: "desc" }
              })
            : [];

        // ── Stats: Agent runs by triggerId ──
        const agentTriggerIds = [
            ...schedules.map((s) => s.id),
            ...triggers.filter((t) => (t.entityType ?? "agent") === "agent").map((t) => t.id)
        ];
        const agentRunStats =
            agentTriggerIds.length > 0
                ? await prisma.agentRun.groupBy({
                      by: ["triggerId"],
                      where: { triggerId: { in: agentTriggerIds } },
                      _count: { _all: true },
                      _avg: { durationMs: true },
                      _sum: { costUsd: true }
                  })
                : [];

        const agentSuccessCounts =
            agentTriggerIds.length > 0
                ? await prisma.agentRun.groupBy({
                      by: ["triggerId"],
                      where: { triggerId: { in: agentTriggerIds }, status: "COMPLETED" },
                      _count: { _all: true }
                  })
                : [];

        const agentFailedCounts =
            agentTriggerIds.length > 0
                ? await prisma.agentRun.groupBy({
                      by: ["triggerId"],
                      where: { triggerId: { in: agentTriggerIds }, status: "FAILED" },
                      _count: { _all: true }
                  })
                : [];

        // ── Stats: Workflow runs by triggerId ──
        const workflowTriggerIds = triggers
            .filter((t) => t.entityType === "workflow")
            .map((t) => t.id);
        const workflowRunStats =
            workflowTriggerIds.length > 0
                ? await prisma.workflowRun.groupBy({
                      by: ["triggerId"],
                      where: { triggerId: { in: workflowTriggerIds } },
                      _count: { _all: true },
                      _avg: { durationMs: true },
                      _sum: { totalCostUsd: true }
                  })
                : [];

        const workflowSuccessCounts =
            workflowTriggerIds.length > 0
                ? await prisma.workflowRun.groupBy({
                      by: ["triggerId"],
                      where: { triggerId: { in: workflowTriggerIds }, status: "COMPLETED" },
                      _count: { _all: true }
                  })
                : [];

        const workflowFailedCounts =
            workflowTriggerIds.length > 0
                ? await prisma.workflowRun.groupBy({
                      by: ["triggerId"],
                      where: { triggerId: { in: workflowTriggerIds }, status: "FAILED" },
                      _count: { _all: true }
                  })
                : [];

        // ── Stats: Network runs by triggerId ──
        const networkTriggerIds = triggers
            .filter((t) => t.entityType === "network")
            .map((t) => t.id);
        const networkRunStats =
            networkTriggerIds.length > 0
                ? await prisma.networkRun.groupBy({
                      by: ["triggerId"],
                      where: { triggerId: { in: networkTriggerIds } },
                      _count: { _all: true },
                      _avg: { durationMs: true },
                      _sum: { totalCostUsd: true }
                  })
                : [];

        const networkSuccessCounts =
            networkTriggerIds.length > 0
                ? await prisma.networkRun.groupBy({
                      by: ["triggerId"],
                      where: { triggerId: { in: networkTriggerIds }, status: "COMPLETED" },
                      _count: { _all: true }
                  })
                : [];

        const networkFailedCounts =
            networkTriggerIds.length > 0
                ? await prisma.networkRun.groupBy({
                      by: ["triggerId"],
                      where: { triggerId: { in: networkTriggerIds }, status: "FAILED" },
                      _count: { _all: true }
                  })
                : [];

        // Build combined lookup maps
        type StatsEntry = {
            total: number;
            avgMs: number | null;
            totalCost: number | null;
            success: number;
            failed: number;
        };
        const statsMap = new Map<string, StatsEntry>();

        for (const r of agentRunStats) {
            statsMap.set(r.triggerId!, {
                total: r._count._all,
                avgMs: r._avg.durationMs,
                totalCost: r._sum.costUsd,
                success: 0,
                failed: 0
            });
        }
        for (const r of agentSuccessCounts) {
            const e = statsMap.get(r.triggerId!);
            if (e) e.success = r._count._all;
        }
        for (const r of agentFailedCounts) {
            const e = statsMap.get(r.triggerId!);
            if (e) e.failed = r._count._all;
        }

        for (const r of workflowRunStats) {
            if (!r.triggerId) continue;
            statsMap.set(r.triggerId, {
                total: r._count._all,
                avgMs: r._avg.durationMs,
                totalCost: r._sum.totalCostUsd,
                success: 0,
                failed: 0
            });
        }
        for (const r of workflowSuccessCounts) {
            if (!r.triggerId) continue;
            const e = statsMap.get(r.triggerId);
            if (e) e.success = r._count._all;
        }
        for (const r of workflowFailedCounts) {
            if (!r.triggerId) continue;
            const e = statsMap.get(r.triggerId);
            if (e) e.failed = r._count._all;
        }

        for (const r of networkRunStats) {
            if (!r.triggerId) continue;
            statsMap.set(r.triggerId, {
                total: r._count._all,
                avgMs: r._avg.durationMs,
                totalCost: r._sum.totalCostUsd,
                success: 0,
                failed: 0
            });
        }
        for (const r of networkSuccessCounts) {
            if (!r.triggerId) continue;
            const e = statsMap.get(r.triggerId);
            if (e) e.success = r._count._all;
        }
        for (const r of networkFailedCounts) {
            if (!r.triggerId) continue;
            const e = statsMap.get(r.triggerId);
            if (e) e.failed = r._count._all;
        }

        function buildStats(
            sourceId: string,
            fallbackCount: number,
            lastRunAt: Date | null,
            nextRunAt: Date | null
        ) {
            const s = statsMap.get(sourceId);
            const total = s?.total ?? fallbackCount;
            const success = s?.success ?? 0;
            const failed = s?.failed ?? 0;
            return {
                totalRuns: total,
                successRuns: success,
                failedRuns: failed,
                successRate: total > 0 ? Math.round((success / total) * 100) : 0,
                avgDurationMs: s?.avgMs ? Math.round(s.avgMs) : null,
                totalCostUsd: s?.totalCost ?? null,
                avgCostPerRun: s && s.totalCost && s.total > 0 ? s.totalCost / s.total : null,
                estMonthlyCost:
                    s && s.totalCost && s.total > 0
                        ? Math.round((s.totalCost / s.total) * 30 * (s.total / 7) * 100) / 100
                        : null,
                lastRunAt,
                nextRunAt
            };
        }

        // ── Build automation entries ──
        const scheduleAutomations = schedules.map((s) => ({
            id: `schedule:${s.id}`,
            sourceType: "schedule" as const,
            primitiveType: "agent" as const,
            type: "scheduled" as const,
            name: s.name,
            description: s.description,
            isActive: s.isActive,
            isArchived: s.isArchived,
            archivedAt: s.archivedAt,
            agent: s.agent,
            entity: s.agent,
            config: {
                cronExpr: s.cronExpr,
                timezone: s.timezone,
                color: s.color,
                task: s.task
            },
            stats: buildStats(s.id, s.runCount ?? 0, s.lastRunAt, s.nextRunAt),
            createdAt: s.createdAt
        }));

        const triggerAutomations = triggers.map((t) => {
            const et = t.entityType ?? "agent";
            const entity = et === "workflow" ? t.workflow : et === "network" ? t.network : t.agent;
            return {
                id: `trigger:${t.id}`,
                sourceType: "trigger" as const,
                primitiveType: et as "agent" | "workflow" | "network",
                type: t.triggerType as string,
                name: t.name,
                description: t.description,
                isActive: t.isActive,
                isArchived: t.isArchived,
                archivedAt: t.archivedAt,
                agent: t.agent,
                entity,
                config: {
                    eventName: t.eventName,
                    webhookPath: t.webhookPath,
                    color: t.color
                },
                stats: buildStats(t.id, t.triggerCount ?? 0, t.lastTriggeredAt, null),
                createdAt: t.createdAt
            };
        });

        const campaignScheduleAutomations = campaignSchedules.map((cs) => ({
            id: `campaign-schedule:${cs.id}`,
            sourceType: "campaign-schedule" as const,
            primitiveType: "campaign" as const,
            type: "scheduled" as const,
            name: cs.name || `Schedule for ${cs.template?.name ?? "campaign"}`,
            description: null,
            isActive: cs.isActive,
            isArchived: false,
            archivedAt: null,
            agent: null,
            entity: cs.template
                ? { id: cs.template.id, slug: cs.template.slug, name: cs.template.name }
                : null,
            config: {
                cronExpr: cs.cronExpr,
                timezone: cs.timezone
            },
            stats: {
                totalRuns: cs.runCount ?? 0,
                successRuns: 0,
                failedRuns: 0,
                successRate: 0,
                avgDurationMs: null,
                totalCostUsd: null,
                avgCostPerRun: null,
                estMonthlyCost: null,
                lastRunAt: cs.lastRunAt,
                nextRunAt: cs.nextRunAt
            },
            createdAt: cs.createdAt
        }));

        const campaignTriggerAutomations = campaignTriggers.map((ct) => ({
            id: `campaign-trigger:${ct.id}`,
            sourceType: "campaign-trigger" as const,
            primitiveType: "campaign" as const,
            type: ct.triggerType as string,
            name: ct.name || `Trigger for ${ct.template?.name ?? "campaign"}`,
            description: null,
            isActive: ct.isActive,
            isArchived: false,
            archivedAt: null,
            agent: null,
            entity: ct.template
                ? { id: ct.template.id, slug: ct.template.slug, name: ct.template.name }
                : null,
            config: {
                eventName: ct.eventName
            },
            stats: {
                totalRuns: ct.triggerCount ?? 0,
                successRuns: 0,
                failedRuns: 0,
                successRate: 0,
                avgDurationMs: null,
                totalCostUsd: null,
                avgCostPerRun: null,
                estMonthlyCost: null,
                lastRunAt: ct.lastTriggeredAt,
                nextRunAt: null
            },
            createdAt: ct.createdAt
        }));

        const pulseAutomations = pulses.map((p) => ({
            id: `pulse:${p.id}`,
            sourceType: "pulse" as const,
            primitiveType: "pulse" as const,
            type: "scheduled" as const,
            name: p.name,
            description: null,
            isActive: p.status === "ACTIVE",
            isArchived: p.status === "ARCHIVED",
            archivedAt: null,
            agent: null,
            entity: { id: p.id, slug: p.slug, name: p.name },
            config: {
                cronExpr: p.evalCronExpr
            },
            stats: {
                totalRuns: 0,
                successRuns: 0,
                failedRuns: 0,
                successRate: 0,
                avgDurationMs: null,
                totalCostUsd: null,
                avgCostPerRun: null,
                estMonthlyCost: null,
                lastRunAt: null,
                nextRunAt: null
            },
            createdAt: p.createdAt
        }));

        const automations = [
            ...scheduleAutomations,
            ...triggerAutomations,
            ...campaignScheduleAutomations,
            ...campaignTriggerAutomations,
            ...pulseAutomations
        ];

        // ── Summary ──
        const byPrimitive: Record<string, number> = {};
        for (const a of automations) {
            byPrimitive[a.primitiveType] = (byPrimitive[a.primitiveType] ?? 0) + 1;
        }

        const needsAttention = automations.filter(
            (a) => a.isActive && a.stats.totalRuns > 0 && a.stats.successRate < 50
        ).length;

        const estimatedMonthlyCost = automations.reduce(
            (acc, a) => acc + (a.stats.estMonthlyCost ?? 0),
            0
        );

        const summary = {
            total: automations.length,
            active: automations.filter((a) => a.isActive).length,
            archived: automations.filter((a) => a.isArchived).length,
            schedules: scheduleAutomations.length + campaignScheduleAutomations.length,
            triggers: triggerAutomations.length + campaignTriggerAutomations.length,
            pulses: pulseAutomations.length,
            byPrimitive,
            needsAttention,
            estimatedMonthlyCost:
                estimatedMonthlyCost > 0 ? Math.round(estimatedMonthlyCost * 100) / 100 : null,
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
