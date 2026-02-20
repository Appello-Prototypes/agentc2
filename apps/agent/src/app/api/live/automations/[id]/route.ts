import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";
import { requireMonitoringWorkspace } from "@/lib/monitoring-auth";

/**
 * Parse an automation ID into its parts.
 *
 * Formats:
 *   schedule:<cuid>
 *   trigger:<cuid>
 *   implicit:slack:<agentId>
 */
function parseAutomationId(id: string): {
    sourceType: "schedule" | "trigger" | "implicit";
    sourceId: string;
    implicitKind?: "slack";
} | null {
    if (id.startsWith("schedule:")) {
        return { sourceType: "schedule", sourceId: id.slice("schedule:".length) };
    }
    if (id.startsWith("trigger:")) {
        return { sourceType: "trigger", sourceId: id.slice("trigger:".length) };
    }
    if (id.startsWith("implicit:slack:")) {
        return {
            sourceType: "implicit",
            sourceId: id.slice("implicit:slack:".length),
            implicitKind: "slack"
        };
    }
    return null;
}

/** Shared include for enriched run data (matches Live Runs schema). */
const enrichedRunInclude = {
    agent: {
        select: { slug: true, name: true }
    },
    trace: {
        select: {
            stepsJson: true,
            tokensJson: true,
            _count: { select: { steps: true, toolCalls: true } }
        }
    },
    toolCalls: {
        select: { toolKey: true }
    },
    _count: {
        select: { toolCalls: true }
    }
} satisfies Prisma.AgentRunInclude;

/**
 * Format a raw enriched AgentRun row into the Live-Runs-compatible shape.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatEnrichedRun(run: any, versionMap: Map<string, number>) {
    return {
        id: run.id,
        agentId: run.agentId,
        agentSlug: run.agent?.slug ?? null,
        agentName: run.agent?.name ?? null,
        runType: run.runType,
        status: run.status,
        source: run.source || null,
        sessionId: run.sessionId || null,
        threadId: run.threadId || null,
        inputText: run.inputText,
        outputText: run.outputText,
        durationMs: run.durationMs,
        startedAt:
            run.startedAt instanceof Date ? run.startedAt.toISOString() : (run.startedAt ?? null),
        completedAt:
            run.completedAt instanceof Date
                ? run.completedAt.toISOString()
                : (run.completedAt ?? null),
        modelProvider: run.modelProvider ?? null,
        modelName: run.modelName ?? null,
        promptTokens:
            run.promptTokens ?? (run.trace?.tokensJson?.prompt as number | undefined) ?? 0,
        completionTokens:
            run.completionTokens ?? (run.trace?.tokensJson?.completion as number | undefined) ?? 0,
        totalTokens: run.totalTokens ?? (run.trace?.tokensJson?.total as number | undefined) ?? 0,
        costUsd: run.costUsd ?? null,
        toolCallCount:
            run._count?.toolCalls > 0 ? run._count.toolCalls : (run.trace?._count?.toolCalls ?? 0),
        uniqueToolCount: new Set((run.toolCalls || []).map((tc: { toolKey: string }) => tc.toolKey))
            .size,
        stepCount: (() => {
            const stepsFromRelation = run.trace?._count?.steps ?? 0;
            if (stepsFromRelation > 0) return stepsFromRelation;
            return Array.isArray(run.trace?.stepsJson) ? run.trace.stepsJson.length : 0;
        })(),
        versionId: run.versionId || null,
        versionNumber: run.versionId ? (versionMap.get(run.versionId) ?? null) : null
    };
}

/**
 * GET /api/live/automations/[id]
 *
 * Returns paginated, enriched run history for a specific automation.
 * Response shape matches /api/live/runs for UI consistency.
 *
 * Query Parameters:
 *   - limit: Max runs to return (default 20, max 100)
 *   - offset: Pagination offset (default 0)
 *   - status: Filter by run status (completed, failed, running, queued, cancelled)
 *   - from/to: ISO date range filter
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
        const offset = parseInt(searchParams.get("offset") || "0", 10);
        const statusParam = searchParams.get("status");
        const from = searchParams.get("from");
        const to = searchParams.get("to");

        const workspaceContext = await requireMonitoringWorkspace(
            searchParams.get("workspaceId"),
            request
        );
        if (!workspaceContext.ok) {
            return NextResponse.json(
                { success: false, error: workspaceContext.error },
                { status: workspaceContext.status }
            );
        }

        const parsed = parseAutomationId(id);
        if (!parsed) {
            return NextResponse.json(
                { success: false, error: "Invalid automation ID format" },
                { status: 400 }
            );
        }

        // ── Implicit Slack triggers ──────────────────────────────────────
        if (parsed.sourceType === "implicit" && parsed.implicitKind === "slack") {
            // Build where clause for the joined run
            const runWhere: Prisma.AgentRunWhereInput = {};
            if (statusParam && statusParam !== "all") {
                runWhere.status = statusParam.toUpperCase() as Prisma.EnumRunStatusFilter;
            }
            const startedAtFilter: Prisma.DateTimeFilter = {};
            if (from) startedAtFilter.gte = new Date(from);
            if (to) startedAtFilter.lte = new Date(to);
            if (Object.keys(startedAtFilter).length > 0) {
                runWhere.startedAt = startedAtFilter;
            }

            const eventWhere: Prisma.TriggerEventWhereInput = {
                sourceType: "slack",
                agentId: parsed.sourceId,
                ...(Object.keys(runWhere).length > 0 ? { run: runWhere } : {})
            };

            const [events, total] = await Promise.all([
                prisma.triggerEvent.findMany({
                    where: eventWhere,
                    orderBy: { createdAt: "desc" },
                    take: limit,
                    skip: offset,
                    select: {
                        id: true,
                        createdAt: true,
                        payloadPreview: true,
                        errorMessage: true,
                        run: {
                            include: enrichedRunInclude
                        }
                    }
                }),
                prisma.triggerEvent.count({ where: eventWhere })
            ]);

            // Resolve version numbers for Slack runs
            const versionIds = Array.from(
                new Set(events.map((e) => e.run?.versionId).filter(Boolean) as string[])
            );
            const versionMap = new Map<string, number>();
            if (versionIds.length > 0) {
                const versions = await prisma.agentVersion.findMany({
                    where: { id: { in: versionIds } },
                    select: { id: true, version: true }
                });
                for (const v of versions) versionMap.set(v.id, v.version);
            }

            return NextResponse.json({
                success: true,
                runs: events.map((e) => {
                    if (e.run) {
                        return formatEnrichedRun(e.run, versionMap);
                    }
                    // Fallback for events without a linked run
                    return {
                        id: e.id,
                        agentId: null,
                        agentSlug: null,
                        agentName: null,
                        runType: null,
                        status: "UNKNOWN",
                        source: "slack",
                        sessionId: null,
                        threadId: null,
                        inputText: e.payloadPreview?.slice(0, 200) ?? null,
                        outputText: null,
                        durationMs: null,
                        startedAt:
                            e.createdAt instanceof Date
                                ? e.createdAt.toISOString()
                                : (e.createdAt ?? null),
                        completedAt: null,
                        modelProvider: null,
                        modelName: null,
                        promptTokens: 0,
                        completionTokens: 0,
                        totalTokens: 0,
                        costUsd: null,
                        toolCallCount: 0,
                        uniqueToolCount: 0,
                        stepCount: 0,
                        versionId: null,
                        versionNumber: null
                    };
                }),
                pagination: { limit, offset, total, hasMore: offset + limit < total }
            });
        }

        // ── Schedule / Trigger automations ───────────────────────────────
        const baseWhere: Prisma.AgentRunWhereInput = { triggerId: parsed.sourceId };
        if (statusParam && statusParam !== "all") {
            baseWhere.status = statusParam.toUpperCase() as Prisma.EnumRunStatusFilter;
        }
        const startedAtFilter: Prisma.DateTimeFilter = {};
        if (from) startedAtFilter.gte = new Date(from);
        if (to) startedAtFilter.lte = new Date(to);
        if (Object.keys(startedAtFilter).length > 0) {
            baseWhere.startedAt = startedAtFilter;
        }

        const [runs, total] = await Promise.all([
            prisma.agentRun.findMany({
                where: baseWhere,
                include: enrichedRunInclude,
                orderBy: { startedAt: "desc" },
                take: limit,
                skip: offset
            }),
            prisma.agentRun.count({ where: baseWhere })
        ]);

        // Resolve version numbers
        const versionIds = Array.from(
            new Set(runs.map((r) => r.versionId).filter(Boolean)) as Set<string>
        );
        const versionMap = new Map<string, number>();
        if (versionIds.length > 0) {
            const versions = await prisma.agentVersion.findMany({
                where: { id: { in: versionIds } },
                select: { id: true, version: true }
            });
            for (const v of versions) versionMap.set(v.id, v.version);
        }

        return NextResponse.json({
            success: true,
            runs: runs.map((r) => formatEnrichedRun(r, versionMap)),
            pagination: { limit, offset, total, hasMore: offset + limit < total }
        });
    } catch (error) {
        console.error("[Automations Detail] GET error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch automation runs" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/live/automations/[id]
 *
 * Toggle isActive (pause/resume) or isArchived (archive/unarchive) for a schedule or trigger.
 * Implicit automations cannot be toggled.
 *
 * Body: { isActive?: boolean, isArchived?: boolean }
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { isActive, isArchived } = body as { isActive?: boolean; isArchived?: boolean };

        if (typeof isActive !== "boolean" && typeof isArchived !== "boolean") {
            return NextResponse.json(
                { success: false, error: "isActive (boolean) or isArchived (boolean) is required" },
                { status: 400 }
            );
        }

        const workspaceContext = await requireMonitoringWorkspace(null, request);
        if (!workspaceContext.ok) {
            return NextResponse.json(
                { success: false, error: workspaceContext.error },
                { status: workspaceContext.status }
            );
        }

        const parsed = parseAutomationId(id);
        if (!parsed) {
            return NextResponse.json(
                { success: false, error: "Invalid automation ID format" },
                { status: 400 }
            );
        }

        if (parsed.sourceType === "implicit") {
            return NextResponse.json(
                {
                    success: false,
                    error: "Implicit automations (e.g. Slack listener) cannot be toggled from here"
                },
                { status: 400 }
            );
        }

        const updateData: Record<string, unknown> = {};

        if (typeof isArchived === "boolean") {
            updateData.isArchived = isArchived;
            if (isArchived) {
                updateData.archivedAt = new Date();
                updateData.isActive = false;
                if (parsed.sourceType === "schedule") {
                    updateData.nextRunAt = null;
                }
            } else {
                updateData.archivedAt = null;
            }
        }

        if (typeof isActive === "boolean" && typeof isArchived !== "boolean") {
            updateData.isActive = isActive;
        }

        if (parsed.sourceType === "schedule") {
            if (updateData.isActive === false && typeof isArchived !== "boolean") {
                updateData.nextRunAt = null;
            }

            const schedule = await prisma.agentSchedule.update({
                where: { id: parsed.sourceId },
                data: updateData
            });
            return NextResponse.json({
                success: true,
                automation: {
                    id: `schedule:${schedule.id}`,
                    isActive: schedule.isActive,
                    isArchived: schedule.isArchived,
                    archivedAt: schedule.archivedAt
                }
            });
        }

        if (parsed.sourceType === "trigger") {
            const trigger = await prisma.agentTrigger.update({
                where: { id: parsed.sourceId },
                data: updateData
            });
            return NextResponse.json({
                success: true,
                automation: {
                    id: `trigger:${trigger.id}`,
                    isActive: trigger.isActive,
                    isArchived: trigger.isArchived,
                    archivedAt: trigger.archivedAt
                }
            });
        }

        return NextResponse.json(
            { success: false, error: "Unsupported source type" },
            { status: 400 }
        );
    } catch (error) {
        console.error("[Automations Detail] PATCH error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to update automation" },
            { status: 500 }
        );
    }
}
