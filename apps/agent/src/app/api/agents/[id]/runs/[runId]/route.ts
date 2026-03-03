import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth } from "@/lib/authz/require-auth";
import { requireAgentAccess } from "@/lib/authz/require-agent-access";

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

        const { context, response: authResponse } = await requireAuth(request);
        if (authResponse) return authResponse;
        const { agentId, response: accessResponse } = await requireAgentAccess(
            context.organizationId,
            id
        );
        if (accessResponse) return accessResponse;

        // Find the run
        const run = await prisma.agentRun.findFirst({
            where: {
                id: runId,
                agentId
            },
            include: {
                turns: {
                    orderBy: { turnIndex: "asc" },
                    include: { toolCalls: true }
                },
                trace: {
                    include: {
                        steps: {
                            orderBy: { stepNumber: "asc" }
                        },
                        toolCalls: true
                    }
                },
                evaluation: {
                    include: {
                        calibrationChecks: true,
                        recommendations: true
                    }
                },
                feedbacks: true,
                costEvents: true,
                guardrailEvents: true,
                instance: {
                    select: { id: true, name: true, slug: true }
                }
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
                turnCount: run.turnCount,
                turns: run.turns,
                evaluation: run.evaluation,
                feedback: run.feedbacks,
                costEvent: run.costEvents,
                guardrailEvents: run.guardrailEvents,
                version,
                instanceId: run.instanceId,
                instanceName: run.instance?.name ?? null,
                instanceSlug: run.instance?.slug ?? null
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
