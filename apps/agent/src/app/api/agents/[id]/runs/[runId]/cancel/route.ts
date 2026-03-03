import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth } from "@/lib/authz/require-auth";
import { requireAgentAccess } from "@/lib/authz/require-agent-access";

/**
 * POST /api/agents/[id]/runs/[runId]/cancel
 *
 * Cancel a running agent execution
 */
export async function POST(
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
            }
        });

        if (!run) {
            return NextResponse.json(
                { success: false, error: `Run '${runId}' not found` },
                { status: 404 }
            );
        }

        // Check if run is in a cancellable state
        if (run.status !== "QUEUED" && run.status !== "RUNNING") {
            return NextResponse.json(
                {
                    success: false,
                    error: `Run '${runId}' is not in a cancellable state (current: ${run.status})`
                },
                { status: 409 }
            );
        }

        // Update run status to CANCELLED
        const updatedRun = await prisma.agentRun.update({
            where: { id: runId },
            data: {
                status: "CANCELLED",
                completedAt: new Date()
            }
        });

        // Update trace if exists
        await prisma.agentTrace.updateMany({
            where: { runId: runId },
            data: {
                status: "CANCELLED"
            }
        });

        // Create an alert for the cancellation
        await prisma.agentAlert.create({
            data: {
                agentId,
                severity: "INFO",
                message: `Run ${runId} was cancelled`,
                source: "SYSTEM"
            }
        });

        return NextResponse.json({
            success: true,
            cancelled: true,
            run: {
                id: updatedRun.id,
                status: updatedRun.status,
                completedAt: updatedRun.completedAt
            }
        });
    } catch (error) {
        console.error("[Agent Run Cancel] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to cancel run"
            },
            { status: 500 }
        );
    }
}
