import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
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

/**
 * GET /api/live/automations/[id]
 *
 * Returns paginated run history for a specific automation.
 *
 * Query Parameters:
 *   - limit: Max runs to return (default 20, max 100)
 *   - offset: Pagination offset (default 0)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
        const offset = parseInt(searchParams.get("offset") || "0", 10);

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

        if (parsed.sourceType === "implicit" && parsed.implicitKind === "slack") {
            // For Slack implicit triggers, query TriggerEvent joined with runs
            const events = await prisma.triggerEvent.findMany({
                where: {
                    sourceType: "slack",
                    agentId: parsed.sourceId
                },
                orderBy: { createdAt: "desc" },
                take: limit,
                skip: offset,
                select: {
                    id: true,
                    createdAt: true,
                    payloadPreview: true,
                    errorMessage: true,
                    run: {
                        select: {
                            id: true,
                            status: true,
                            startedAt: true,
                            completedAt: true,
                            durationMs: true,
                            inputText: true,
                            outputText: true
                        }
                    }
                }
            });

            const total = await prisma.triggerEvent.count({
                where: {
                    sourceType: "slack",
                    agentId: parsed.sourceId
                }
            });

            return NextResponse.json({
                success: true,
                runs: events.map((e) => ({
                    id: e.run?.id ?? e.id,
                    status: e.run?.status ?? "UNKNOWN",
                    startedAt: e.run?.startedAt ?? e.createdAt,
                    completedAt: e.run?.completedAt ?? null,
                    durationMs: e.run?.durationMs ?? null,
                    inputPreview:
                        e.run?.inputText?.slice(0, 200) ?? e.payloadPreview?.slice(0, 200) ?? null,
                    outputPreview: e.run?.outputText?.slice(0, 200) ?? null,
                    error: e.errorMessage
                })),
                pagination: { limit, offset, total, hasMore: offset + limit < total }
            });
        }

        // For schedule/trigger automations, query AgentRun by triggerId
        const [runs, total] = await Promise.all([
            prisma.agentRun.findMany({
                where: { triggerId: parsed.sourceId },
                orderBy: { startedAt: "desc" },
                take: limit,
                skip: offset,
                select: {
                    id: true,
                    status: true,
                    startedAt: true,
                    completedAt: true,
                    durationMs: true,
                    inputText: true,
                    outputText: true
                }
            }),
            prisma.agentRun.count({
                where: { triggerId: parsed.sourceId }
            })
        ]);

        return NextResponse.json({
            success: true,
            runs: runs.map((r) => ({
                id: r.id,
                status: r.status,
                startedAt: r.startedAt,
                completedAt: r.completedAt,
                durationMs: r.durationMs,
                inputPreview: r.inputText?.slice(0, 200) ?? null,
                outputPreview: r.outputText?.slice(0, 200) ?? null,
                error: null
            })),
            pagination: { limit, offset, total, hasMore: offset + limit < total }
        });
    } catch (error) {
        console.error("[Automations Detail] GET error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to fetch automation runs"
            },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/live/automations/[id]
 *
 * Toggle isActive (pause/resume) for a schedule or trigger.
 * Implicit automations cannot be toggled.
 *
 * Body: { isActive: boolean }
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { isActive } = body as { isActive?: boolean };

        if (typeof isActive !== "boolean") {
            return NextResponse.json(
                { success: false, error: "isActive (boolean) is required" },
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

        if (parsed.sourceType === "schedule") {
            const schedule = await prisma.agentSchedule.update({
                where: { id: parsed.sourceId },
                data: { isActive }
            });
            return NextResponse.json({
                success: true,
                automation: {
                    id: `schedule:${schedule.id}`,
                    isActive: schedule.isActive
                }
            });
        }

        if (parsed.sourceType === "trigger") {
            const trigger = await prisma.agentTrigger.update({
                where: { id: parsed.sourceId },
                data: { isActive }
            });
            return NextResponse.json({
                success: true,
                automation: {
                    id: `trigger:${trigger.id}`,
                    isActive: trigger.isActive
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
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to update automation"
            },
            { status: 500 }
        );
    }
}
