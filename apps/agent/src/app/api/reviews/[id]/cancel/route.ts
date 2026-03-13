import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";
import { refreshWorkflowMetrics } from "@/lib/metrics";

/**
 * POST /api/reviews/[id]/cancel
 *
 * Cancel the workflow run linked to a review (approval request).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        const approval = await prisma.approvalRequest.findFirst({
            where: { id, organizationId: authContext.organizationId },
            select: {
                id: true,
                workflowRunId: true,
                workflowRun: {
                    select: {
                        id: true,
                        status: true,
                        suspendedStep: true,
                        workflowId: true,
                        workflow: { select: { name: true } }
                    }
                }
            }
        });

        if (!approval) {
            return NextResponse.json(
                { success: false, error: "Review not found" },
                { status: 404 }
            );
        }

        if (!approval.workflowRunId || !approval.workflowRun) {
            return NextResponse.json(
                { success: false, error: "Review has no linked workflow run" },
                { status: 409 }
            );
        }

        const run = approval.workflowRun;
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
            where: { id: run.id },
            data: {
                status: "CANCELLED",
                completedAt: new Date(),
                suspendedAt: null,
                suspendedStep: null,
                suspendDataJson: Prisma.DbNull
            }
        });

        await prisma.approvalRequest.updateMany({
            where: { workflowRunId: run.id, status: "pending" },
            data: {
                status: "rejected",
                decidedBy: "system",
                decidedAt: new Date(),
                decisionReason: "Workflow run cancelled by operator"
            }
        });

        await refreshWorkflowMetrics(run.workflowId, new Date());

        return NextResponse.json({
            success: true,
            cancelled: true,
            workflowName: run.workflow?.name ?? null,
            run: {
                id: updatedRun.id,
                status: updatedRun.status,
                completedAt: updatedRun.completedAt
            }
        });
    } catch (error) {
        console.error("[Review Cancel] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to cancel run"
            },
            { status: 500 }
        );
    }
}
