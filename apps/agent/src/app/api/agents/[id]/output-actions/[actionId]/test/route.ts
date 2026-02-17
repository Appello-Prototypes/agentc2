import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { executeOutputAction } from "@/lib/output-actions";

/**
 * POST /api/agents/[id]/output-actions/[actionId]/test
 *
 * Test an output action by executing it against the agent's most recent completed run
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; actionId: string }> }
) {
    try {
        const { id, actionId } = await params;

        const agent = await prisma.agent.findFirst({
            where: { OR: [{ slug: id }, { id }] }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        const action = await prisma.outputAction.findFirst({
            where: { id: actionId, agentId: agent.id }
        });

        if (!action) {
            return NextResponse.json(
                { success: false, error: `Output action '${actionId}' not found` },
                { status: 404 }
            );
        }

        const lastRun = await prisma.agentRun.findFirst({
            where: { agentId: agent.id, status: "COMPLETED" },
            orderBy: { completedAt: "desc" },
            select: { id: true, outputText: true, inputText: true, source: true }
        });

        if (!lastRun || !lastRun.outputText) {
            return NextResponse.json(
                {
                    success: false,
                    error: "No completed runs with output found for this agent"
                },
                { status: 404 }
            );
        }

        const result = await executeOutputAction(
            action,
            {
                outputText: lastRun.outputText,
                inputText: lastRun.inputText,
                source: lastRun.source
            },
            { agentId: agent.id, runId: lastRun.id }
        );

        return NextResponse.json({
            success: result.success,
            result: result.success ? "delivered" : undefined,
            error: result.error,
            runId: lastRun.id
        });
    } catch (error) {
        console.error("[OutputActions] Error testing:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to test output action"
            },
            { status: 500 }
        );
    }
}
