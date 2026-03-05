import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { slug } = await params;
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

        const feedback = await prisma.workflowRunFeedback.findMany({
            where: { workflowId: workflow.id },
            orderBy: { createdAt: "desc" },
            take: 100,
            include: {
                workflowRun: {
                    select: { id: true, status: true, createdAt: true }
                }
            }
        });

        const positive = feedback.filter((f) => f.thumbs === true).length;
        const negative = feedback.filter((f) => f.thumbs === false).length;

        return NextResponse.json({
            success: true,
            feedback,
            summary: { total: feedback.length, positive, negative }
        });
    } catch (error) {
        console.error("[Workflow Feedback] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to list feedback" },
            { status: 500 }
        );
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { slug } = await params;
        const body = await request.json();

        if (!body.workflowRunId) {
            return NextResponse.json(
                { success: false, error: "workflowRunId is required" },
                { status: 400 }
            );
        }

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

        const entry = await prisma.workflowRunFeedback.create({
            data: {
                workflowRunId: body.workflowRunId,
                workflowId: workflow.id,
                thumbs: body.thumbs,
                rating: body.rating,
                comment: body.comment,
                source: body.source || "api"
            }
        });

        return NextResponse.json({ success: true, feedback: entry }, { status: 201 });
    } catch (error) {
        console.error("[Workflow Feedback Create] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to create feedback" },
            { status: 500 }
        );
    }
}
