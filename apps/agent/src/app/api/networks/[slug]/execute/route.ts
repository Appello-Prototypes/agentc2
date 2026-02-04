import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";
import { buildNetworkAgent } from "@repo/mastra";
import { refreshNetworkMetrics } from "@/lib/metrics";
import { resolveRunEnvironment, resolveRunTriggerType } from "@/lib/run-metadata";

function inferStepType(eventType: string) {
    if (eventType.includes("routing")) return "routing";
    if (eventType.includes("agent")) return "agent";
    if (eventType.includes("workflow")) return "workflow";
    if (eventType.includes("tool")) return "tool";
    return "event";
}

function inferPrimitive(eventType: string, payload: Record<string, unknown>) {
    if (payload.agentId) return { type: "agent", id: payload.agentId as string };
    if (payload.workflowId) return { type: "workflow", id: payload.workflowId as string };
    if (payload.toolName) return { type: "tool", id: payload.toolName as string };
    if (payload.toolId) return { type: "tool", id: payload.toolId as string };
    if (eventType.includes("agent")) return { type: "agent", id: payload.agentId as string };
    if (eventType.includes("workflow"))
        return { type: "workflow", id: payload.workflowId as string };
    if (eventType.includes("tool")) return { type: "tool", id: payload.toolName as string };
    return { type: undefined, id: undefined };
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;
        const body = await request.json();
        const message = body.message || body.input;

        if (!message) {
            return NextResponse.json(
                { success: false, error: "Message is required" },
                { status: 400 }
            );
        }

        const network = await prisma.network.findFirst({
            where: { OR: [{ slug }, { id: slug }] },
            include: { workspace: { select: { environment: true } } }
        });

        if (!network) {
            return NextResponse.json(
                { success: false, error: `Network '${slug}' not found` },
                { status: 404 }
            );
        }

        const { agent } = await buildNetworkAgent(network.id);
        const run = await prisma.networkRun.create({
            data: {
                networkId: network.id,
                status: "RUNNING",
                inputText: message,
                threadId: body.threadId || `thread-${Date.now()}`,
                resourceId: body.resourceId || null,
                source: body.source || "api",
                environment: resolveRunEnvironment(
                    body.environment,
                    network.workspace?.environment
                ),
                triggerType: resolveRunTriggerType(body.triggerType ?? body.trigger, body.source)
            }
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (agent as any).network(message, {
            maxSteps: network.maxSteps,
            memory: {
                thread: body.threadId || run.threadId,
                resource: body.resourceId || run.resourceId || "default"
            }
        });

        const steps: Array<{
            stepNumber: number;
            stepType: string;
            primitiveType?: string;
            primitiveId?: string;
            routingDecision?: Record<string, unknown>;
            inputJson?: Record<string, unknown>;
            outputJson?: Record<string, unknown>;
        }> = [];

        let stepNumber = 0;
        let outputText = "";
        let outputJson: Record<string, unknown> | undefined;

        for await (const chunk of result) {
            const chunkAny = chunk as { type: string; payload?: Record<string, unknown> };
            const payload = chunkAny.payload || {};

            if (chunkAny.type === "agent-execution-event-text-delta" && payload.textDelta) {
                outputText += payload.textDelta as string;
            }

            if (chunkAny.type === "network-object-result") {
                outputJson = payload as Record<string, unknown>;
            }

            const stepType = inferStepType(chunkAny.type);
            const primitive = inferPrimitive(chunkAny.type, payload);
            if (
                chunkAny.type.includes("start") ||
                chunkAny.type.includes("end") ||
                chunkAny.type.includes("step-finish") ||
                chunkAny.type.includes("routing")
            ) {
                steps.push({
                    stepNumber: stepNumber++,
                    stepType,
                    primitiveType: primitive.type,
                    primitiveId: primitive.id,
                    routingDecision: stepType === "routing" ? payload : undefined,
                    inputJson: payload.input as Record<string, unknown>,
                    outputJson: payload.result as Record<string, unknown>
                });
            }
        }

        if (steps.length > 0) {
            await prisma.networkRunStep.createMany({
                data: steps.map((step) => ({
                    runId: run.id,
                    stepNumber: step.stepNumber,
                    stepType: step.stepType,
                    primitiveType: step.primitiveType,
                    primitiveId: step.primitiveId,
                    routingDecision: step.routingDecision
                        ? (step.routingDecision as Prisma.InputJsonValue)
                        : Prisma.DbNull,
                    inputJson: step.inputJson as Prisma.InputJsonValue,
                    outputJson: step.outputJson as Prisma.InputJsonValue
                }))
            });
        }

        await prisma.networkRun.update({
            where: { id: run.id },
            data: {
                status: "COMPLETED",
                outputText,
                outputJson: outputJson as Prisma.InputJsonValue,
                completedAt: new Date(),
                stepsExecuted: steps.length
            }
        });
        await refreshNetworkMetrics(network.id, new Date());

        return NextResponse.json({
            success: true,
            runId: run.id,
            outputText,
            outputJson,
            steps: steps.length
        });
    } catch (error) {
        console.error("[Network Execute] Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Execute failed" },
            { status: 500 }
        );
    }
}
