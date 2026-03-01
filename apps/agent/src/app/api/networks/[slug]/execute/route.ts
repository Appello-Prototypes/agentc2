import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma, RunStatus } from "@repo/database";
import { buildNetworkAgent } from "@repo/agentc2/networks";
import { recordActivity, inputPreview } from "@repo/agentc2/activity/service";
import { refreshNetworkMetrics } from "@/lib/metrics";
import { resolveRunEnvironment, resolveRunTriggerType } from "@/lib/run-metadata";
import { createTriggerEventRecord } from "@/lib/trigger-events";
import { processNetworkStreamWithSubRuns } from "@/lib/network-stream-processor";

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

        const { outputText, outputJson, steps, totalTokens, totalCostUsd } =
            await processNetworkStreamWithSubRuns(result, {
                networkRunId: run.id,
                networkSlug: network.slug,
                tenantId: networkOrgId || undefined,
                inputMessage: message
            });

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
                    status: step.status,
                    agentRunId: step.agentRunId || undefined
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
