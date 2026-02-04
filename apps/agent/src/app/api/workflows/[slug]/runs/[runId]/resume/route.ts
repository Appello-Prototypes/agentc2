import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";
import { executeWorkflowDefinition, type WorkflowDefinition } from "@repo/mastra";
import { refreshWorkflowMetrics } from "@/lib/metrics";

function mapStepStatus(status: "completed" | "failed" | "suspended") {
    if (status === "failed") return "FAILED";
    if (status === "suspended") return "RUNNING";
    return "COMPLETED";
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string; runId: string }> }
) {
    try {
        const { slug, runId } = await params;
        const body = await request.json();

        const workflow = await prisma.workflow.findFirst({
            where: { OR: [{ slug }, { id: slug }] }
        });

        if (!workflow) {
            return NextResponse.json(
                { success: false, error: `Workflow '${slug}' not found` },
                { status: 404 }
            );
        }

        const run = await prisma.workflowRun.findUnique({
            where: { id: runId },
            include: { steps: true }
        });

        if (!run) {
            return NextResponse.json(
                { success: false, error: `Run '${runId}' not found` },
                { status: 404 }
            );
        }

        if (!run.suspendedStep) {
            return NextResponse.json(
                { success: false, error: "Run is not suspended" },
                { status: 400 }
            );
        }

        const existingSteps: Record<string, unknown> = {};
        run.steps.forEach((step) => {
            if (step.outputJson !== null && step.outputJson !== undefined) {
                existingSteps[step.stepId] = step.outputJson;
            }
        });

        const result = await executeWorkflowDefinition({
            definition: workflow.definitionJson as unknown as WorkflowDefinition,
            input: run.inputJson,
            resume: {
                stepId: run.suspendedStep,
                data: body.resumeData || {}
            },
            existingSteps,
            requestContext: body.requestContext
        });

        const durationMs = result.steps.reduce((sum, step) => sum + (step.durationMs || 0), 0);

        for (const step of result.steps) {
            const existing = run.steps.find((existingStep) => existingStep.stepId === step.stepId);
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
                    resumedAt: new Date(),
                    resumeDataJson: (body.resumeData || {}) as Prisma.InputJsonValue,
                    durationMs: (run.durationMs || 0) + durationMs
                }
            });
            await refreshWorkflowMetrics(workflow.id, new Date());

            return NextResponse.json({
                success: true,
                status: "suspended",
                runId: run.id,
                suspended: result.suspended
            });
        }

        const finalStatus = result.status === "failed" ? "FAILED" : "COMPLETED";
        await prisma.workflowRun.update({
            where: { id: run.id },
            data: {
                status: finalStatus,
                outputJson: result.output as Prisma.InputJsonValue,
                completedAt: new Date(),
                resumedAt: new Date(),
                resumeDataJson: (body.resumeData || {}) as Prisma.InputJsonValue,
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
            output: result.output,
            error: result.error
        });
    } catch (error) {
        console.error("[Workflow Resume] Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Resume failed" },
            { status: 500 }
        );
    }
}
