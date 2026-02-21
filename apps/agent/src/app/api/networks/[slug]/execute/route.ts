import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma, RunStatus } from "@repo/database";
import { buildNetworkAgent } from "@repo/agentc2/networks";
import { recordActivity, inputPreview } from "@repo/agentc2/activity/service";
import { refreshNetworkMetrics } from "@/lib/metrics";
import { resolveRunEnvironment, resolveRunTriggerType } from "@/lib/run-metadata";
import { createTriggerEventRecord } from "@/lib/trigger-events";

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

function tryParseJson(value: string) {
    try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }
    } catch {
        return null;
    }
    return null;
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
            include: { workspace: { select: { environment: true, organizationId: true } } }
        });

        if (!network) {
            return NextResponse.json(
                { success: false, error: `Network '${slug}' not found` },
                { status: 404 }
            );
        }

        const networkOrgId = network.workspace?.organizationId || "";
        const { agent } = await buildNetworkAgent(network.id);
        const scopedThreadId = body.threadId
            ? networkOrgId
                ? `${networkOrgId}:${body.threadId}`
                : body.threadId
            : networkOrgId
              ? `${networkOrgId}:thread-${Date.now()}`
              : `thread-${Date.now()}`;
        const scopedResourceId = body.resourceId
            ? networkOrgId
                ? `${networkOrgId}:${body.resourceId}`
                : body.resourceId
            : null;
        const run = await prisma.networkRun.create({
            data: {
                networkId: network.id,
                status: RunStatus.RUNNING,
                inputText: message,
                threadId: scopedThreadId,
                resourceId: scopedResourceId,
                source: body.source || "api",
                environment: resolveRunEnvironment(
                    body.environment,
                    network.workspace?.environment
                ),
                triggerType: resolveRunTriggerType(body.triggerType ?? body.trigger, body.source)
            }
        });

        // Record trigger event for unified triggers dashboard
        try {
            await createTriggerEventRecord({
                networkId: network.id,
                networkRunId: run.id,
                workspaceId: network.workspaceId,
                sourceType: body.source || "api",
                triggerType: body.triggerType || "manual",
                entityType: "network",
                payload: { message },
                metadata: {
                    networkSlug: network.slug,
                    networkName: network.name,
                    environment: body.environment
                }
            });
        } catch (e) {
            console.warn("[Network Execute] Failed to record trigger event:", e);
        }

        // Record to Activity Feed
        recordActivity({
            type: "NETWORK_ROUTED",
            summary: `Network "${network.name}" received: ${inputPreview(message)}`,
            status: "info",
            source: body.source || "api",
            networkRunId: run.id,
            metadata: { networkSlug: network.slug, networkName: network.name }
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (agent as any).network(message, {
            maxSteps: network.maxSteps,
            memory: {
                thread: run.threadId,
                resource: run.resourceId || (networkOrgId ? `${networkOrgId}:default` : "default")
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
            status: RunStatus;
        }> = [];

        let stepNumber = 0;
        let outputText = "";
        let outputJson: Record<string, unknown> | undefined;
        let lastResult: Record<string, unknown> | undefined;
        let lastResultText: string | undefined;

        // Token/cost tracking
        let totalTokens = 0;
        let totalCostUsd = 0;

        for await (const chunk of result) {
            const chunkAny = chunk as { type: string; payload?: Record<string, unknown> };
            const payload = chunkAny.payload || {};

            if (chunkAny.type === "agent-execution-event-text-delta" && payload.textDelta) {
                outputText += payload.textDelta as string;
            }

            if (chunkAny.type === "network-object-result") {
                outputJson = payload as Record<string, unknown>;
            }

            // Extract token usage from step-finish or usage events
            if (payload.usage && typeof payload.usage === "object") {
                const usage = payload.usage as {
                    promptTokens?: number;
                    completionTokens?: number;
                    totalTokens?: number;
                };
                if (usage.totalTokens) {
                    totalTokens += usage.totalTokens;
                } else if (usage.promptTokens || usage.completionTokens) {
                    totalTokens += (usage.promptTokens || 0) + (usage.completionTokens || 0);
                }
            }

            // Some events carry cost directly
            if (typeof payload.costUsd === "number") {
                totalCostUsd += payload.costUsd;
            }

            if (
                payload.result &&
                typeof payload.result === "object" &&
                !Array.isArray(payload.result)
            ) {
                lastResult = payload.result as Record<string, unknown>;
            }
            if (typeof payload.result === "string") {
                lastResultText = payload.result;
                const parsed = tryParseJson(payload.result);
                if (parsed) {
                    lastResult = parsed;
                }
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
                    outputJson: payload.result as Record<string, unknown>,
                    status: RunStatus.COMPLETED
                });
            }
        }

        if (!outputJson && lastResult) {
            outputJson = lastResult;
        }
        if (!outputText) {
            if (lastResultText) {
                outputText = lastResultText;
            } else if (outputJson) {
                outputText = JSON.stringify(outputJson, null, 2);
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
                    inputJson: step.inputJson
                        ? (step.inputJson as Prisma.InputJsonValue)
                        : Prisma.DbNull,
                    outputJson: step.outputJson
                        ? (step.outputJson as Prisma.InputJsonValue)
                        : Prisma.DbNull,
                    status: step.status
                }))
            });
        }

        const completedAt = new Date();
        const durationMs = completedAt.getTime() - run.createdAt.getTime();

        await prisma.networkRun.update({
            where: { id: run.id },
            data: {
                status: RunStatus.COMPLETED,
                outputText,
                outputJson: outputJson ? (outputJson as Prisma.InputJsonValue) : Prisma.DbNull,
                completedAt,
                durationMs,
                stepsExecuted: steps.length,
                totalTokens: totalTokens > 0 ? totalTokens : undefined,
                totalCostUsd: totalCostUsd > 0 ? totalCostUsd : undefined
            }
        });
        await refreshNetworkMetrics(network.id, new Date());

        // Record to Activity Feed
        recordActivity({
            type: "NETWORK_COMPLETED",
            summary: `Network "${network.name}" completed (${steps.length} steps, ${durationMs}ms)`,
            status: "success",
            source: body.source || "api",
            networkRunId: run.id,
            durationMs,
            costUsd: totalCostUsd > 0 ? totalCostUsd : undefined,
            tokenCount: totalTokens > 0 ? totalTokens : undefined,
            metadata: { networkSlug: network.slug, stepsExecuted: steps.length }
        });

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
