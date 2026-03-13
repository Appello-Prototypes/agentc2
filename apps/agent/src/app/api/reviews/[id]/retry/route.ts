import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";
import { executeWorkflowDefinition, type WorkflowDefinition } from "@repo/agentc2/workflows";
import { refreshWorkflowMetrics } from "@/lib/metrics";
import { authenticateRequest } from "@/lib/api-auth";

function mapStepStatus(status: "completed" | "failed" | "suspended") {
    if (status === "failed") return "FAILED";
    if (status === "suspended") return "RUNNING";
    return "COMPLETED";
}

/**
 * POST /api/reviews/[id]/retry
 *
 * Retry a failed workflow step for a review's linked workflow run.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const { stepId } = body;

        if (!stepId) {
            return NextResponse.json(
                { success: false, error: "stepId is required" },
                { status: 400 }
            );
        }

        const approval = await prisma.approvalRequest.findFirst({
            where: { id, organizationId: authContext.organizationId },
            select: {
                id: true,
                workflowRunId: true,
                workflowRun: {
                    select: {
                        id: true,
                        status: true,
                        inputJson: true,
                        durationMs: true,
                        workflow: {
                            select: {
                                id: true,
                                slug: true,
                                workspaceId: true,
                                definitionJson: true
                            }
                        },
                        steps: {
                            select: {
                                id: true,
                                stepId: true,
                                stepType: true,
                                stepName: true,
                                status: true,
                                inputJson: true,
                                outputJson: true,
                                errorJson: true,
                                iterationIndex: true,
                                startedAt: true,
                                completedAt: true,
                                durationMs: true
                            }
                        }
                    }
                }
            }
        });

        if (!approval) {
            return NextResponse.json(
                { success: false, error: "Review not found" },
                { status: 404 }
            );
        }

        if (!approval.workflowRunId || !approval.workflowRun) {
            return NextResponse.json(
                { success: false, error: "Review has no linked workflow run" },
                { status: 400 }
            );
        }

        const run = approval.workflowRun;
        const workflow = run.workflow;

        if (!workflow) {
            return NextResponse.json(
                { success: false, error: "Workflow not found for this run" },
                { status: 404 }
            );
        }

        const terminalStates = ["COMPLETED", "CANCELLED"];
        if (terminalStates.includes(run.status)) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Run is in a terminal state (${run.status})`
                },
                { status: 409 }
            );
        }

        const targetStep = run.steps.find((s) => s.stepId === stepId);
        if (!targetStep) {
            return NextResponse.json(
                { success: false, error: `Step '${stepId}' not found in run` },
                { status: 404 }
            );
        }

        if (targetStep.status !== "FAILED") {
            return NextResponse.json(
                {
                    success: false,
                    error: `Step '${stepId}' is not in FAILED state (current: ${targetStep.status})`
                },
                { status: 409 }
            );
        }

        const existingSteps: Record<string, unknown> = {};
        for (const step of run.steps) {
            if (
                step.status === "COMPLETED" &&
                step.outputJson !== null &&
                step.outputJson !== undefined
            ) {
                existingSteps[step.stepId] = step.outputJson;
            }
        }

        await prisma.workflowRun.update({
            where: { id: run.id },
            data: { status: "RUNNING" }
        });

        const result = await executeWorkflowDefinition({
            definition: workflow.definitionJson as unknown as WorkflowDefinition,
            input: run.inputJson,
            resume: { stepId, data: {} },
            existingSteps,
            requestContext: { organizationId: authContext.organizationId },
            workflowMeta: { runId: run.id, workflowSlug: workflow.slug }
        });

        const durationMs = result.steps.reduce((sum, step) => sum + (step.durationMs || 0), 0);

        for (const step of result.steps) {
            const existing = run.steps.find((s) => s.stepId === step.stepId);
            if (existing && existing.status !== "COMPLETED") {
                await prisma.workflowRunStep.update({
                    where: { id: existing.id },
                    data: {
                        status: mapStepStatus(step.status),
                        inputJson: step.input as Prisma.InputJsonValue,
                        outputJson: step.output as Prisma.InputJsonValue,
                        errorJson: step.error as Prisma.InputJsonValue,
                        iterationIndex: step.iterationIndex,
                        startedAt: step.startedAt,
                        completedAt: step.completedAt,
                        durationMs: step.durationMs
                    }
                });
            } else if (!existing) {
                await prisma.workflowRunStep.create({
                    data: {
                        runId: run.id,
                        stepId: step.stepId,
                        stepType: step.stepType,
                        stepName: step.stepName,
                        status: mapStepStatus(step.status),
                        inputJson: step.input as Prisma.InputJsonValue,
                        outputJson: step.output as Prisma.InputJsonValue,
                        errorJson: step.error as Prisma.InputJsonValue,
                        iterationIndex: step.iterationIndex,
                        startedAt: step.startedAt,
                        completedAt: step.completedAt,
                        durationMs: step.durationMs
                    }
                });
            }
        }

        if (result.status === "suspended") {
            await prisma.workflowRun.update({
                where: { id: run.id },
                data: {
                    suspendedAt: new Date(),
                    suspendedStep: result.suspended?.stepId,
                    suspendDataJson: result.suspended?.data
                        ? (result.suspended.data as Prisma.InputJsonValue)
                        : Prisma.DbNull,
                    durationMs: (run.durationMs || 0) + durationMs
                }
            });
            await refreshWorkflowMetrics(workflow.id, new Date());

            return NextResponse.json({
                success: true,
                status: "suspended",
                runId: run.id,
                retriedStepId: stepId
            });
        }

        const finalStatus = result.status === "failed" ? "FAILED" : "COMPLETED";
        await prisma.workflowRun.update({
            where: { id: run.id },
            data: {
                status: finalStatus,
                outputJson: result.output as Prisma.InputJsonValue,
                completedAt: new Date(),
                durationMs: (run.durationMs || 0) + durationMs,
                suspendedAt: null,
                suspendedStep: null,
                suspendDataJson: Prisma.DbNull
            }
        });
        await refreshWorkflowMetrics(workflow.id, new Date());

        return NextResponse.json({
            success: true,
            status: finalStatus === "COMPLETED" ? "success" : "failed",
            runId: run.id,
            retriedStepId: stepId
        });
    } catch (error) {
        console.error("[Review Retry] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Retry failed"
            },
            { status: 500 }
        );
    }
}
