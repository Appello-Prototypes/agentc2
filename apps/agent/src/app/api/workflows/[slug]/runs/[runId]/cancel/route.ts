import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";
import { refreshWorkflowMetrics } from "@/lib/metrics";

/**
 * POST /api/workflows/[slug]/runs/[runId]/cancel
 *
 * Cancel an active or suspended workflow run.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string; runId: string }> }
) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { slug, runId } = await params;

        const workflow = await prisma.workflow.findFirst({
            where: {
                OR: [{ slug }, { id: slug }],
                workspace: { organizationId: authContext.organizationId }
            },
            select: { id: true }
        });

        if (!workflow) {
            return NextResponse.json(
                { success: false, error: `Workflow '${slug}' not found` },
                { status: 404 }
            );
        }

        const run = await prisma.workflowRun.findFirst({
            where: { id: runId, workflowId: workflow.id }
        });

        if (!run) {
            return NextResponse.json(
                { success: false, error: `Run '${runId}' not found` },
                { status: 404 }
            );
        }

        const isCancellable =
            run.status === "QUEUED" || run.status === "RUNNING" || run.suspendedStep != null;

        if (!isCancellable) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Run is not cancellable (status: ${run.status})`
                },
                { status: 409 }
            );
        }

        const updatedRun = await prisma.workflowRun.update({
            where: { id: runId },
            data: {
                status: "CANCELLED",
                completedAt: new Date(),
                suspendedAt: null,
                suspendedStep: null,
                suspendDataJson: Prisma.DbNull
            }
        });

        await prisma.approvalRequest.updateMany({
            where: { workflowRunId: runId, status: "pending" },
            data: {
                status: "rejected",
                decidedBy: "system",
                decidedAt: new Date(),
                decisionReason: "Workflow run cancelled by operator"
            }
        });

        await refreshWorkflowMetrics(workflow.id, new Date());

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
        console.error("[Workflow Run Cancel] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to cancel run"
            },
            { status: 500 }
        );
    }
}
