import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";
import {
    executeWorkflowDefinition,
    createEngagement,
    type WorkflowDefinition
} from "@repo/agentc2/workflows";
import { refreshWorkflowMetrics } from "@/lib/metrics";
import { resolveRunEnvironment, resolveRunTriggerType } from "@/lib/run-metadata";
import { createTriggerEventRecord } from "@/lib/trigger-events";
import { authenticateRequest } from "@/lib/api-auth";

function mapStepStatus(status: "completed" | "failed" | "suspended") {
    if (status === "failed") return "FAILED";
    if (status === "suspended") return "RUNNING";
    return "COMPLETED";
}

function executeWorkflowInBackground(
    workflow: { id: string; slug: string; workspaceId: string | null; definitionJson: unknown },
    run: { id: string },
    input: Record<string, unknown>,
    body: Record<string, unknown>
) {
    setImmediate(async () => {
        try {
            const result = await executeWorkflowDefinition({
                definition: workflow.definitionJson as unknown as WorkflowDefinition,
                input,
                requestContext: body.requestContext as Record<string, unknown> | undefined,
                workflowMeta: { runId: run.id, workflowSlug: workflow.slug }
            });

            const durationMs = result.steps.reduce((sum, step) => sum + (step.durationMs || 0), 0);

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
                const suspStep = result.steps.find((s) => s.status === "suspended");
                await prisma.workflowRun.update({
                    where: { id: run.id },
                    data: {
                        status: "RUNNING",
                        outputJson: result.output as Prisma.InputJsonValue,
                        suspendedAt: new Date(),
                        suspendedStep: suspStep?.stepId || null,
                        suspendDataJson: suspStep?.output as Prisma.InputJsonValue,
                        durationMs
                    }
                });
            } else {
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
            }
            await refreshWorkflowMetrics(workflow.id, new Date());
        } catch (error) {
            console.error("[Workflow Execute Async] Background error:", error);
            await prisma.workflowRun.update({
                where: { id: run.id },
                data: {
                    status: "FAILED",
                    outputJson:
                        error instanceof Error ? error.message : "Background execution failed",
                    completedAt: new Date()
                }
            });
        }
    });
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { slug } = await params;
        const body = await request.json();

        const workflow = await prisma.workflow.findFirst({
            where: {
                OR: [{ slug }, { id: slug }],
                workspace: { organizationId: authContext.organizationId }
            },
            include: {
                workspace: { select: { environment: true } }
            }
        });

        if (!workflow) {
            return NextResponse.json(
                { success: false, error: `Workflow '${slug}' not found` },
                { status: 404 }
            );
        }

        const input = body.input ?? body.inputData ?? {};
        const asyncMode = body.async === true;
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
                triggerType: resolveRunTriggerType(body.triggerType ?? body.trigger, body.source)
            }
        });

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
                    environment: body.environment
                }
            });
        } catch (e) {
            console.warn("[Workflow Execute] Failed to record trigger event:", e);
        }

        if (asyncMode) {
            executeWorkflowInBackground(workflow, run, input, body);
            return NextResponse.json({
                success: true,
                status: "running",
                runId: run.id,
                message: "Workflow started asynchronously. Poll workflow_get_run for status."
            });
        }

        const SYNC_TIMEOUT_MS = 55_000;
        const executionPromise = executeWorkflowDefinition({
            definition: workflow.definitionJson as unknown as WorkflowDefinition,
            input,
            requestContext: body.requestContext,
            workflowMeta: { runId: run.id, workflowSlug: workflow.slug }
        });

        const timeoutSymbol = Symbol("timeout");
        const raceResult = await Promise.race([
            executionPromise.then((r) => ({ kind: "done" as const, value: r })),
            new Promise<{ kind: "timeout"; value: typeof timeoutSymbol }>((resolve) =>
                setTimeout(
                    () => resolve({ kind: "timeout", value: timeoutSymbol }),
                    SYNC_TIMEOUT_MS
                )
            )
        ]);

        if (raceResult.kind === "timeout") {
            executionPromise
                .then(async (bgResult) => {
                    const bgDuration = bgResult.steps.reduce(
                        (sum, step) => sum + (step.durationMs || 0),
                        0
                    );
                    if (bgResult.steps.length > 0) {
                        await prisma.workflowRunStep.createMany({
                            data: bgResult.steps.map((step) => ({
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
                    if (bgResult.status === "suspended") {
                        const suspStep = bgResult.steps.find((s) => s.status === "suspended");
                        await prisma.workflowRun.update({
                            where: { id: run.id },
                            data: {
                                status: "RUNNING",
                                outputJson: bgResult.output as Prisma.InputJsonValue,
                                suspendedAt: new Date(),
                                suspendedStep: suspStep?.stepId || null,
                                suspendDataJson: suspStep?.output as Prisma.InputJsonValue,
                                durationMs: bgDuration
                            }
                        });
                    } else {
                        const finalStatus = bgResult.status === "failed" ? "FAILED" : "COMPLETED";
                        await prisma.workflowRun.update({
                            where: { id: run.id },
                            data: {
                                status: finalStatus,
                                outputJson: bgResult.output as Prisma.InputJsonValue,
                                completedAt: new Date(),
                                durationMs: bgDuration
                            }
                        });
                    }
                    await refreshWorkflowMetrics(workflow.id, new Date());
                })
                .catch(async (error) => {
                    console.error("[Workflow Execute] Background completion error:", error);
                    await prisma.workflowRun.update({
                        where: { id: run.id },
                        data: {
                            status: "FAILED",
                            outputJson:
                                error instanceof Error
                                    ? error.message
                                    : "Background execution failed",
                            completedAt: new Date()
                        }
                    });
                });

            return NextResponse.json({
                success: true,
                status: "running",
                runId: run.id,
                message: "Workflow still running after 55s. Poll workflow_get_run for status."
            });
        }

        const result = raceResult.value;

        const durationMs = result.steps.reduce((sum, step) => sum + (step.durationMs || 0), 0);

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

            const organizationId =
                body.requestContext?.organizationId ||
                body.requestContext?.resource?.organizationId;
            if (organizationId && result.suspended?.stepId) {
                try {
                    await createEngagement({
                        organizationId,
                        workspaceId: workflow.workspaceId,
                        workflowRunId: run.id,
                        workflowSlug: workflow.slug,
                        suspendedStep: result.suspended.stepId,
                        suspendData: result.suspended.data,
                        stepOutputs: result.steps.map((s) => ({
                            stepId: s.stepId,
                            stepType: s.stepType,
                            output: s.output
                        }))
                    });
                } catch (e) {
                    console.warn("[Workflow Execute] Failed to create engagement:", e);
                }
            }

            return NextResponse.json({
                success: true,
                status: "suspended",
                runId: run.id,
                suspended: result.suspended
            });
        }

        // Extract token/cost estimates from agent step outputs
        let totalTokens: number | undefined;
        let totalCostUsd: number | undefined;
        for (const step of result.steps) {
            const output = step.output as Record<string, unknown> | undefined;
            if (output && typeof output === "object") {
                // Agent steps include _agentSlug for attribution
                // Cost estimation: ~0.01 per 1k tokens for GPT-4o
                if (output._agentSlug && typeof output.text === "string") {
                    const estimatedTokens = Math.ceil((output.text as string).length / 4);
                    totalTokens = (totalTokens || 0) + estimatedTokens;
                    totalCostUsd = (totalCostUsd || 0) + estimatedTokens * 0.00001;
                }
            }
        }

        const finalStatus = result.status === "failed" ? "FAILED" : "COMPLETED";
        await prisma.workflowRun.update({
            where: { id: run.id },
            data: {
                status: finalStatus,
                outputJson: result.output as Prisma.InputJsonValue,
                completedAt: new Date(),
                durationMs,
                totalTokens,
                totalCostUsd:
                    totalCostUsd !== undefined
                        ? Math.round(totalCostUsd * 1000000) / 1000000
                        : undefined
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
        console.error("[Workflow Execute] Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Execute failed" },
            { status: 500 }
        );
    }
}
