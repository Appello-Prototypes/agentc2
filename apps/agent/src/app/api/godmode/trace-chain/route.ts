/**
 * GET /api/godmode/trace-chain
 *
 * Builds a causal execution graph that spans agent boundaries.
 *
 * Given a networkRunId, walks:
 *   TriggerEvent → NetworkRun → NetworkRunStep[] → correlated AgentRun(s) → AgentTrace
 *
 * Given a runId, walks:
 *   AgentRun → AgentTrace → AgentTraceStep[] + AgentToolCall[]
 *   + checks if this run belongs to a network or workflow
 *
 * Returns a tree of CausalNode objects representing the full execution chain.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

interface CausalNode {
    id: string;
    type:
        | "trigger"
        | "network"
        | "network_step"
        | "workflow"
        | "workflow_step"
        | "agent_run"
        | "tool_call";
    label: string;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
    durationMs: number | null;
    metadata: Record<string, unknown>;
    children: CausalNode[];
}

export async function GET(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const networkRunId = searchParams.get("networkRunId");
        const runId = searchParams.get("runId");

        if (!networkRunId && !runId) {
            return NextResponse.json(
                { success: false, error: "Provide networkRunId or runId" },
                { status: 400 }
            );
        }

        let rootNode: CausalNode;

        if (networkRunId) {
            rootNode = await buildNetworkChain(networkRunId);
        } else {
            rootNode = await buildRunChain(runId!);
        }

        return NextResponse.json({ success: true, chain: rootNode });
    } catch (error) {
        console.error("[TraceChain] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to build trace chain"
            },
            { status: 500 }
        );
    }
}

async function buildNetworkChain(networkRunId: string): Promise<CausalNode> {
    const networkRun = await prisma.networkRun.findUnique({
        where: { id: networkRunId },
        include: {
            network: { select: { name: true, slug: true } },
            steps: { orderBy: { stepNumber: "asc" } },
            TriggerEvent: {
                select: {
                    id: true,
                    sourceType: true,
                    triggerType: true,
                    eventName: true,
                    payloadPreview: true,
                    createdAt: true
                }
            }
        }
    });

    if (!networkRun) {
        throw new Error(`NetworkRun ${networkRunId} not found`);
    }

    const stepNodes: CausalNode[] = [];

    for (const step of networkRun.steps) {
        const stepNode: CausalNode = {
            id: step.id,
            type: "network_step",
            label: buildStepLabel(step),
            status: step.status,
            startedAt: step.startedAt?.toISOString() ?? null,
            completedAt: step.completedAt?.toISOString() ?? null,
            durationMs: step.durationMs,
            metadata: {
                stepNumber: step.stepNumber,
                stepType: step.stepType,
                primitiveType: step.primitiveType,
                primitiveId: step.primitiveId,
                routingDecision: step.routingDecision,
                tokens: step.tokens,
                costUsd: step.costUsd
            },
            children: []
        };

        // Correlate agent runs by primitiveId + time window
        if (step.primitiveType === "agent" && step.primitiveId && step.startedAt) {
            const correlatedRuns = await findCorrelatedAgentRuns(
                step.primitiveId,
                step.startedAt,
                step.completedAt
            );

            for (const agentRun of correlatedRuns) {
                stepNode.children.push(await buildRunChain(agentRun.id));
            }
        }

        // Correlate workflow runs via networkRunId
        if (step.primitiveType === "workflow" && step.primitiveId) {
            const workflowRuns = await prisma.workflowRun.findMany({
                where: { networkRunId },
                include: {
                    workflow: { select: { name: true, slug: true } },
                    steps: {
                        orderBy: { stepId: "asc" },
                        include: {
                            agentRun: {
                                select: { id: true }
                            }
                        }
                    }
                }
            });

            for (const wfRun of workflowRuns) {
                stepNode.children.push(buildWorkflowNode(wfRun));
            }
        }

        stepNodes.push(stepNode);
    }

    const networkNode: CausalNode = {
        id: networkRun.id,
        type: "network",
        label: `Network: ${networkRun.network.name}`,
        status: networkRun.status,
        startedAt: networkRun.startedAt.toISOString(),
        completedAt: networkRun.completedAt?.toISOString() ?? null,
        durationMs: networkRun.durationMs,
        metadata: {
            networkSlug: networkRun.network.slug,
            inputPreview: networkRun.inputText.slice(0, 200),
            outputPreview: networkRun.outputText?.slice(0, 200),
            stepsExecuted: networkRun.stepsExecuted,
            totalTokens: networkRun.totalTokens,
            totalCostUsd: networkRun.totalCostUsd
        },
        children: stepNodes
    };

    // Wrap in trigger node if a trigger initiated this
    if (networkRun.TriggerEvent) {
        const trigger = networkRun.TriggerEvent;
        return {
            id: trigger.id,
            type: "trigger",
            label: `Trigger: ${trigger.sourceType}${trigger.eventName ? ` / ${trigger.eventName}` : ""}`,
            status: "fired",
            startedAt: trigger.createdAt.toISOString(),
            completedAt: null,
            durationMs: null,
            metadata: {
                sourceType: trigger.sourceType,
                triggerType: trigger.triggerType,
                eventName: trigger.eventName,
                payloadPreview: trigger.payloadPreview
            },
            children: [networkNode]
        };
    }

    return networkNode;
}

async function buildRunChain(runId: string): Promise<CausalNode> {
    const run = await prisma.agentRun.findUnique({
        where: { id: runId },
        include: {
            agent: { select: { slug: true, name: true } },
            trace: {
                include: {
                    steps: {
                        orderBy: { stepNumber: "asc" },
                        select: {
                            id: true,
                            stepNumber: true,
                            type: true,
                            content: true,
                            durationMs: true,
                            timestamp: true
                        }
                    },
                    toolCalls: {
                        orderBy: { createdAt: "asc" },
                        select: {
                            id: true,
                            toolKey: true,
                            mcpServerId: true,
                            success: true,
                            durationMs: true,
                            createdAt: true,
                            error: true
                        }
                    }
                }
            }
        }
    });

    if (!run) {
        throw new Error(`AgentRun ${runId} not found`);
    }

    const children: CausalNode[] = [];

    // Add trace steps as children
    if (run.trace?.steps) {
        for (const step of run.trace.steps) {
            children.push({
                id: step.id,
                type: "tool_call",
                label: `${step.type}: ${summarizeContent(step.content)}`,
                status: "completed",
                startedAt: step.timestamp.toISOString(),
                completedAt: null,
                durationMs: step.durationMs,
                metadata: {
                    stepNumber: step.stepNumber,
                    type: step.type,
                    content: step.content
                },
                children: []
            });
        }
    }

    // Add tool calls if trace steps are empty
    if (children.length === 0 && run.trace?.toolCalls) {
        for (const tc of run.trace.toolCalls) {
            children.push({
                id: tc.id,
                type: "tool_call",
                label: `Tool: ${tc.toolKey}${tc.mcpServerId ? ` (${tc.mcpServerId})` : ""}`,
                status: tc.success ? "completed" : "failed",
                startedAt: tc.createdAt.toISOString(),
                completedAt: null,
                durationMs: tc.durationMs,
                metadata: {
                    toolKey: tc.toolKey,
                    mcpServerId: tc.mcpServerId,
                    success: tc.success,
                    error: tc.error
                },
                children: []
            });
        }
    }

    return {
        id: run.id,
        type: "agent_run",
        label: `Agent: ${run.agent.name || run.agent.slug}`,
        status: run.status,
        startedAt: run.startedAt.toISOString(),
        completedAt: run.completedAt?.toISOString() ?? null,
        durationMs: run.durationMs,
        metadata: {
            agentSlug: run.agent.slug,
            agentName: run.agent.name,
            inputPreview: run.inputText.slice(0, 200),
            outputPreview: run.outputText?.slice(0, 200),
            modelProvider: run.modelProvider,
            modelName: run.modelName,
            totalTokens: run.totalTokens,
            costUsd: run.costUsd,
            source: run.source
        },
        children
    };
}

/**
 * Find AgentRuns correlated to a NetworkRunStep by agent ID and time window.
 * Without a direct foreign key, we use the step's execution window to narrow
 * down which AgentRun was spawned by this network step.
 */
async function findCorrelatedAgentRuns(
    primitiveId: string,
    stepStartedAt: Date,
    stepCompletedAt: Date | null
) {
    const windowStart = new Date(stepStartedAt.getTime() - 2000);
    const windowEnd = stepCompletedAt
        ? new Date(stepCompletedAt.getTime() + 2000)
        : new Date(Date.now() + 60000);

    return prisma.agentRun.findMany({
        where: {
            agent: {
                OR: [{ id: primitiveId }, { slug: primitiveId }]
            },
            startedAt: {
                gte: windowStart,
                lte: windowEnd
            }
        },
        select: { id: true },
        orderBy: { startedAt: "asc" },
        take: 5
    });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildWorkflowNode(wfRun: any): CausalNode {
    const stepChildren: CausalNode[] = (wfRun.steps ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (step: any) => ({
            id: step.id,
            type: "workflow_step" as const,
            label: `Step: ${step.stepName || step.stepId}`,
            status: step.status,
            startedAt: step.startedAt?.toISOString() ?? null,
            completedAt: step.completedAt?.toISOString() ?? null,
            durationMs: step.durationMs,
            metadata: {
                stepId: step.stepId,
                stepType: step.stepType,
                iterationIndex: step.iterationIndex,
                agentRunId: step.agentRun?.id
            },
            children: []
        })
    );

    return {
        id: wfRun.id,
        type: "workflow",
        label: `Workflow: ${wfRun.workflow?.name || wfRun.workflowId}`,
        status: wfRun.status,
        startedAt: wfRun.startedAt.toISOString(),
        completedAt: wfRun.completedAt?.toISOString() ?? null,
        durationMs: wfRun.durationMs,
        metadata: {
            workflowSlug: wfRun.workflow?.slug,
            totalTokens: wfRun.totalTokens,
            totalCostUsd: wfRun.totalCostUsd
        },
        children: stepChildren
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildStepLabel(step: any): string {
    const type = step.stepType || "step";
    const primitive = step.primitiveType ? `${step.primitiveType}: ${step.primitiveId || "?"}` : "";
    return `${type}${primitive ? ` → ${primitive}` : ""}`;
}

function summarizeContent(content: unknown): string {
    if (typeof content === "string") return content.slice(0, 100);
    if (content && typeof content === "object") {
        const str = JSON.stringify(content);
        return str.slice(0, 100);
    }
    return "...";
}
