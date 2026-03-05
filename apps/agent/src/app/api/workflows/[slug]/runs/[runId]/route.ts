import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(
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
            }
        });

        if (!workflow) {
            return NextResponse.json(
                { success: false, error: `Workflow '${slug}' not found` },
                { status: 404 }
            );
        }

        const run = await prisma.workflowRun.findUnique({
            where: { id: runId },
            include: {
                steps: { orderBy: { startedAt: "asc" } },
                evaluation: true,
                feedback: true
            }
        });

        if (!run || run.workflowId !== workflow.id) {
            return NextResponse.json(
                { success: false, error: `Run '${runId}' not found` },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            run,
            workflow: {
                id: workflow.id,
                slug: workflow.slug,
                name: workflow.name
            }
        });
    } catch (error) {
        console.error("[Workflow Run Detail] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to load workflow run" },
            { status: 500 }
        );
    }
}
