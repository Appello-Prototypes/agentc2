import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

const MAX_OUTPUT_LENGTH = 2000;

function truncateOutput(val: unknown): unknown {
    if (typeof val === "string") {
        return val.length > MAX_OUTPUT_LENGTH ? val.slice(0, MAX_OUTPUT_LENGTH) + "…" : val;
    }
    if (val && typeof val === "object") {
        const obj = val as Record<string, unknown>;
        const text =
            (obj.text as string | undefined) ||
            (obj.response as string | undefined) ||
            (obj.summary as string | undefined);
        if (typeof text === "string" && text.length > MAX_OUTPUT_LENGTH) {
            return {
                ...obj,
                [text === obj.text ? "text" : text === obj.response ? "response" : "summary"]:
                    text.slice(0, MAX_OUTPUT_LENGTH) + "…"
            };
        }
    }
    return val;
}

/**
 * GET /api/reviews/[id]/steps
 *
 * Fetch workflow run steps for a review's linked workflow run.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        const approval = await prisma.approvalRequest.findFirst({
            where: { id, organizationId: authContext.organizationId },
            select: {
                workflowRunId: true,
                sourceId: true,
                workflowRun: {
                    select: {
                        status: true,
                        suspendedStep: true
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

        if (!approval.workflowRunId) {
            return NextResponse.json({ success: true, steps: [] });
        }

        const steps = await prisma.workflowRunStep.findMany({
            where: { runId: approval.workflowRunId },
            select: {
                id: true,
                stepId: true,
                stepType: true,
                stepName: true,
                status: true,
                outputJson: true,
                errorJson: true,
                durationMs: true,
                startedAt: true,
                completedAt: true,
                iterationIndex: true
            },
            orderBy: { startedAt: "asc" }
        });

        const truncatedSteps = steps.map((s) => ({
            ...s,
            outputJson: truncateOutput(s.outputJson)
        }));

        return NextResponse.json({
            success: true,
            runStatus: approval.workflowRun?.status ?? null,
            suspendedStep: approval.workflowRun?.suspendedStep ?? approval.sourceId ?? null,
            steps: truncatedSteps
        });
    } catch (error) {
        console.error("[Reviews Steps] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed"
            },
            { status: 500 }
        );
    }
}
