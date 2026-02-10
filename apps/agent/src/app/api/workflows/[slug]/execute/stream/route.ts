import { NextRequest } from "next/server";
import { prisma, Prisma } from "@repo/database";
import { executeWorkflowDefinition, type WorkflowDefinition } from "@repo/mastra";
import { refreshWorkflowMetrics } from "@/lib/metrics";
import { resolveRunEnvironment, resolveRunTriggerType } from "@/lib/run-metadata";
import { createTriggerEventRecord } from "@/lib/trigger-events";

function mapStepStatus(status: "completed" | "failed" | "suspended") {
    if (status === "failed") return "FAILED";
    if (status === "suspended") return "RUNNING";
    return "COMPLETED";
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const sendEvent = (event: string, data: unknown) => {
                controller.enqueue(encoder.encode(`event: ${event}\n`));
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            try {
                const { slug } = await params;
                const body = await request.json();

                const workflow = await prisma.workflow.findFirst({
                    where: { OR: [{ slug }, { id: slug }] },
                    include: { workspace: { select: { environment: true } } }
                });

                if (!workflow) {
                    sendEvent("error", { message: `Workflow '${slug}' not found` });
                    controller.close();
                    return;
                }

                const input = body.input ?? body.inputData ?? {};
                const run = await prisma.workflowRun.create({
                    data: {
                        workflowId: workflow.id,
                        status: "RUNNING",
                        inputJson: input,
                        source: body.source || "api",
                        environment: resolveRunEnvironment(
                            body.environment,
                            workflow.workspace?.environment
                        ),
                        triggerType: resolveRunTriggerType(
                            body.triggerType ?? body.trigger,
                            body.source
                        )
                    }
                });

                sendEvent("start", { runId: run.id });

                // Record trigger event for unified triggers dashboard
                try {
                    await createTriggerEventRecord({
                        workflowId: workflow.id,
                        workflowRunId: run.id,
                        workspaceId: workflow.workspaceId,
                        sourceType: body.source || "api",
                        triggerType: body.triggerType || "manual",
                        entityType: "workflow",
                        payload: input,
                        metadata: {
                            workflowSlug: workflow.slug,
                            workflowName: workflow.name,
                            streaming: true
                        }
                    });
                } catch (e) {
                    console.warn("[Workflow Stream] Failed to record trigger event:", e);
                }

                const result = await executeWorkflowDefinition({
                    definition: workflow.definitionJson as unknown as WorkflowDefinition,
                    input,
                    requestContext: body.requestContext,
                    onStepEvent: (event) => {
                        sendEvent("step", {
                            stepId: event.stepId,
                            stepType: event.stepType,
                            status: event.status,
                            output: event.output
                        });
                    }
                });

                const durationMs = result.steps.reduce(
                    (sum, step) => sum + (step.durationMs || 0),
                    0
                );

                if (result.steps.length > 0) {
                    await prisma.workflowRunStep.createMany({
                        data: result.steps.map((step) => ({
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
                        }))
                    });
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
                            durationMs
                        }
                    });
                    await refreshWorkflowMetrics(workflow.id, new Date());
                    sendEvent("suspended", result.suspended);
                    controller.close();
                    return;
                }

                const finalStatus = result.status === "failed" ? "FAILED" : "COMPLETED";
                await prisma.workflowRun.update({
                    where: { id: run.id },
                    data: {
                        status: finalStatus,
                        outputJson: result.output as Prisma.InputJsonValue,
                        completedAt: new Date(),
                        durationMs
                    }
                });
                await refreshWorkflowMetrics(workflow.id, new Date());

                sendEvent("complete", {
                    status: finalStatus === "COMPLETED" ? "success" : "failed",
                    output: result.output,
                    error: result.error
                });

                controller.close();
            } catch (error) {
                sendEvent("error", {
                    message: error instanceof Error ? error.message : "Streaming failed"
                });
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive"
        }
    });
}
