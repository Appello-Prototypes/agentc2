import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /api/agents/[id]/runs/[runId]
 *
 * Get a specific run by ID
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

        // Find the run
        const run = await prisma.agentRun.findFirst({
            where: {
                id: runId,
                agentId: agent.id
            },
            include: {
                trace: {
                    include: {
                        steps: {
                            orderBy: { stepNumber: "asc" }
                        },
                        toolCalls: true
                    }
                },
                evaluation: true,
                feedback: true,
                costEvent: true,
                guardrailEvents: true
            }
        });

        if (!run) {
            return NextResponse.json(
                { success: false, error: `Run '${runId}' not found` },
                { status: 404 }
            );
        }

        const version = run.versionId
            ? await prisma.agentVersion.findFirst({
                  where: { id: run.versionId },
                  select: {
                      id: true,
                      version: true,
                      description: true,
                      instructions: true,
                      modelProvider: true,
                      modelName: true,
                      snapshot: true,
                      createdAt: true
                  }
              })
            : null;

        // If trace exists but has no tool calls via relation, fall back to
        // querying tool calls directly by runId
        let traceData = run.trace;
        if (traceData && traceData.toolCalls.length === 0) {
            const directToolCalls = await prisma.agentToolCall.findMany({
                where: { runId },
                orderBy: { createdAt: "asc" }
            });
            if (directToolCalls.length > 0) {
                traceData = { ...traceData, toolCalls: directToolCalls };
            }
        }

        return NextResponse.json({
            success: true,
            run: {
                id: run.id,
                agentId: run.agentId,
                runType: run.runType,
                status: run.status,
                inputText: run.inputText,
                outputText: run.outputText,
                durationMs: run.durationMs,
                startedAt: run.startedAt,
                completedAt: run.completedAt,
                modelProvider: run.modelProvider,
                modelName: run.modelName,
                versionId: run.versionId,
                promptTokens: run.promptTokens,
                completionTokens: run.completionTokens,
                totalTokens: run.totalTokens,
                costUsd: run.costUsd,
                trace: traceData,
                evaluation: run.evaluation,
                feedback: run.feedback,
                costEvent: run.costEvent,
                guardrailEvents: run.guardrailEvents,
                version
            }
        });
    } catch (error) {
        console.error("[Agent Run Detail] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get run"
            },
            { status: 500 }
        );
    }
}
