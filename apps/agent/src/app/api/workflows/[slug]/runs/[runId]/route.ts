import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ slug: string; runId: string }> }
) {
    try {
        const { slug, runId } = await params;
        const workflow = await prisma.workflow.findFirst({
            where: { OR: [{ slug }, { id: slug }] }
        });

        if (!workflow) {
            return NextResponse.json(
                { success: false, error: `Workflow '${slug}' not found` },
                { status: 404 }
            );
        }

        const run = await prisma.workflowRun.findUnique({
            where: { id: runId },
            include: { steps: true }
        });

        if (!run || run.workflowId !== workflow.id) {
            return NextResponse.json(
                { success: false, error: `Run '${runId}' not found` },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            run
        });
    } catch (error) {
        console.error("[Workflow Run Detail] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to load workflow run" },
            { status: 500 }
        );
    }
}
