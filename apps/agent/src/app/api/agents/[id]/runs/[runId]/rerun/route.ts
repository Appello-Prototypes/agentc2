import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";
import { agentResolver } from "@repo/mastra";

/**
 * POST /api/agents/[id]/runs/[runId]/rerun
 *
 * Rerun an agent execution with the same input
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; runId: string }> }
) {
    try {
        const { id, runId } = await params;
        const body = await request.json().catch(() => ({}));

        const { versionId } = body;

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

        // Find the original run
        const originalRun = await prisma.agentRun.findFirst({
            where: {
                id: runId,
                agentId: agent.id
            }
        });

        if (!originalRun) {
            return NextResponse.json(
                { success: false, error: `Run '${runId}' not found` },
                { status: 404 }
            );
        }

        // Resolve the agent
        const {
            agent: mastraAgent,
            record,
            source
        } = await agentResolver.resolve({
            slug: agent.slug,
            id: agent.id
        });

        if (!record) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found in database` },
                { status: 404 }
            );
        }

        // Create the new run record
        const newRun = await prisma.agentRun.create({
            data: {
                agentId: record.id,
                runType: originalRun.runType,
                status: "RUNNING",
                inputText: originalRun.inputText,
                modelProvider: record.modelProvider,
                modelName: record.modelName,
                versionId: versionId || originalRun.versionId,
                startedAt: new Date()
            }
        });

        // Create trace record
        await prisma.agentTrace.create({
            data: {
                runId: newRun.id,
                agentId: record.id,
                status: "RUNNING",
                inputText: originalRun.inputText
            }
        });

        const startTime = Date.now();

        // Execute the agent
        try {
            const result = await mastraAgent.generate(originalRun.inputText);

            const durationMs = Date.now() - startTime;

            // Extract usage data
            const usage = result.usage
                ? {
                      promptTokens: (result.usage as { promptTokens?: number }).promptTokens ?? 0,
                      completionTokens:
                          (result.usage as { completionTokens?: number }).completionTokens ?? 0,
                      totalTokens: (result.usage as { totalTokens?: number }).totalTokens ?? 0
                  }
                : null;

            // Update run with results
            await prisma.agentRun.update({
                where: { id: newRun.id },
                data: {
                    status: "COMPLETED",
                    outputText: result.text,
                    durationMs,
                    completedAt: new Date(),
                    promptTokens: usage?.promptTokens,
                    completionTokens: usage?.completionTokens,
                    totalTokens: usage?.totalTokens
                }
            });

            // Update trace
            await prisma.agentTrace.update({
                where: { runId: newRun.id },
                data: {
                    status: "COMPLETED",
                    outputText: result.text,
                    durationMs,
                    tokensJson: usage ? (usage as Prisma.InputJsonValue) : Prisma.JsonNull
                }
            });

            return NextResponse.json({
                success: true,
                newRunId: newRun.id,
                originalRunId: runId,
                output: result.text,
                durationMs,
                usage: result.usage,
                source
            });
        } catch (runError) {
            const durationMs = Date.now() - startTime;

            // Update run with failure
            await prisma.agentRun.update({
                where: { id: newRun.id },
                data: {
                    status: "FAILED",
                    durationMs,
                    completedAt: new Date()
                }
            });

            await prisma.agentTrace.update({
                where: { runId: newRun.id },
                data: {
                    status: "FAILED",
                    durationMs
                }
            });

            throw runError;
        }
    } catch (error) {
        console.error("[Agent Run Rerun] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to rerun agent"
            },
            { status: 500 }
        );
    }
}
