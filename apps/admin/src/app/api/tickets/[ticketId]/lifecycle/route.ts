import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdmin, AdminAuthError } from "@repo/admin-auth";

/**
 * GET /admin/api/tickets/[ticketId]/lifecycle
 *
 * Returns the dispatch lifecycle for a ticket: all workflow runs that
 * reference this ticket, their status, steps, and error details.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ ticketId: string }> }
) {
    try {
        await requireAdmin(request, "platform_admin");

        const { ticketId } = await params;

        const ticket = await prisma.supportTicket.findUnique({
            where: { id: ticketId },
            select: { id: true, pipelineRunId: true, metadata: true }
        });

        if (!ticket) {
            return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
        }

        // Collect all known run IDs: current + historical from metadata
        const runIds: string[] = [];
        if (ticket.pipelineRunId) runIds.push(ticket.pipelineRunId);

        const meta = ticket.metadata as Record<string, unknown> | null;
        const dispatches = (meta?.dispatches as Array<{ runId?: string }>) ?? [];
        for (const d of dispatches) {
            if (d.runId && !runIds.includes(d.runId)) {
                runIds.push(d.runId);
            }
        }

        if (runIds.length === 0) {
            return NextResponse.json({
                ticketId,
                dispatched: false,
                runs: [],
                lastDispatchedAt: meta?.lastDispatchedAt ?? null,
                lastDispatchedBy: meta?.lastDispatchedBy ?? null
            });
        }

        const workflowRuns = await prisma.workflowRun.findMany({
            where: { id: { in: runIds } },
            include: {
                workflow: { select: { slug: true, name: true } },
                steps: {
                    orderBy: { startedAt: "asc" },
                    select: {
                        stepId: true,
                        stepType: true,
                        stepName: true,
                        status: true,
                        errorJson: true,
                        durationMs: true,
                        startedAt: true,
                        completedAt: true,
                        iterationIndex: true
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        const runs = workflowRuns.map((run) => {
            const failedStep = run.steps.find((s) => s.status === "FAILED");
            const errorMessage = failedStep?.errorJson
                ? typeof failedStep.errorJson === "string"
                    ? failedStep.errorJson
                    : (failedStep.errorJson as Record<string, unknown>)?.message ||
                      JSON.stringify(failedStep.errorJson)
                : typeof run.outputJson === "string" && run.status === "FAILED"
                  ? run.outputJson
                  : null;

            const inputJson = run.inputJson as Record<string, unknown> | null;

            return {
                runId: run.id,
                status: run.status,
                workflowSlug: run.workflow?.slug ?? null,
                workflowName: run.workflow?.name ?? null,
                source: run.source,
                triggerType: run.triggerType,
                isCurrent: run.id === ticket.pipelineRunId,
                createdAt: run.createdAt.toISOString(),
                completedAt: run.completedAt?.toISOString() ?? null,
                durationMs: run.durationMs,
                errorMessage,
                repository: inputJson?.repository ?? null,
                steps: run.steps.map((s) => ({
                    stepId: s.stepId,
                    stepType: s.stepType,
                    stepName: s.stepName,
                    status: s.status,
                    durationMs: s.durationMs,
                    startedAt: s.startedAt?.toISOString() ?? null,
                    completedAt: s.completedAt?.toISOString() ?? null,
                    error:
                        s.status === "FAILED" && s.errorJson
                            ? typeof s.errorJson === "string"
                                ? s.errorJson
                                : (s.errorJson as Record<string, unknown>)?.message ||
                                  JSON.stringify(s.errorJson)
                            : null
                })),
                totalSteps: run.steps.length,
                completedSteps: run.steps.filter((s) => s.status === "COMPLETED").length,
                failedSteps: run.steps.filter((s) => s.status === "FAILED").length
            };
        });

        return NextResponse.json({
            ticketId,
            dispatched: true,
            currentRunId: ticket.pipelineRunId,
            runs,
            lastDispatchedAt: meta?.lastDispatchedAt ?? null,
            lastDispatchedBy: meta?.lastDispatchedBy ?? null
        });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[Ticket Lifecycle] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
