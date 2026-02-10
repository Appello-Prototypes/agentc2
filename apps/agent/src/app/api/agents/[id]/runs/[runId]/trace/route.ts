import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /api/agents/[id]/runs/[runId]/trace
 *
 * Get the trace for a specific run
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; runId: string }> }
) {
    try {
        const { id, runId } = await params;

        // Find agent by slug or id
        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id: id }],
                isActive: true
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        // Find the trace for this run
        const trace = await prisma.agentTrace.findFirst({
            where: {
                runId: runId,
                agentId: agent.id
            },
            include: {
                steps: {
                    orderBy: { stepNumber: "asc" }
                },
                toolCalls: {
                    orderBy: { createdAt: "asc" }
                }
            }
        });

        if (!trace) {
            return NextResponse.json(
                { success: false, error: `Trace for run '${runId}' not found` },
                { status: 404 }
            );
        }

        // If trace has no tool calls via the trace relation, fall back to
        // querying tool calls directly by runId (they may be linked only to the run)
        let toolCalls = trace.toolCalls;
        if (toolCalls.length === 0) {
            toolCalls = await prisma.agentToolCall.findMany({
                where: { runId },
                orderBy: { createdAt: "asc" }
            });
        }

        return NextResponse.json({
            success: true,
            trace: {
                id: trace.id,
                runId: trace.runId,
                agentId: trace.agentId,
                status: trace.status,
                inputText: trace.inputText,
                outputText: trace.outputText,
                durationMs: trace.durationMs,
                stepsJson: trace.stepsJson,
                modelJson: trace.modelJson,
                tokensJson: trace.tokensJson,
                scoresJson: trace.scoresJson,
                createdAt: trace.createdAt,
                steps: trace.steps.map((step) => ({
                    id: step.id,
                    stepNumber: step.stepNumber,
                    type: step.type,
                    content: step.content,
                    timestamp: step.timestamp,
                    durationMs: step.durationMs
                })),
                toolCalls: toolCalls.map((call) => ({
                    id: call.id,
                    toolKey: call.toolKey,
                    mcpServerId: call.mcpServerId,
                    inputJson: call.inputJson,
                    outputJson: call.outputJson,
                    success: call.success,
                    error: call.error,
                    durationMs: call.durationMs,
                    createdAt: call.createdAt
                }))
            }
        });
    } catch (error) {
        console.error("[Agent Run Trace] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get trace"
            },
            { status: 500 }
        );
    }
}
