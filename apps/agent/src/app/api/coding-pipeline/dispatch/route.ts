import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
    try {
        const authResult = await authenticateRequest(request);
        if (!authResult) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { sourceType, sourceId, repository, branch, variant } = body;

        if (!sourceType || !sourceId || !repository) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Missing required fields: sourceType, sourceId, repository"
                },
                { status: 400 }
            );
        }

        const validSourceTypes = ["support_ticket", "backlog_task", "github_issue", "manual"];
        if (!validSourceTypes.includes(sourceType)) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Invalid sourceType. Must be one of: ${validSourceTypes.join(", ")}`
                },
                { status: 400 }
            );
        }

        const pipelineRun = await prisma.codingPipelineRun.create({
            data: {
                sourceType,
                sourceId,
                repository,
                baseBranch: branch || "main",
                status: "running",
                variant: variant || "standard",
                organizationId: authResult.organizationId
            }
        });

        const workflowSlug =
            variant === "internal" ? "coding-pipeline-internal" : "coding-pipeline";

        const workflow = await prisma.workflow.findFirst({
            where: { slug: workflowSlug, isActive: true }
        });

        if (!workflow) {
            await prisma.codingPipelineRun.update({
                where: { id: pipelineRun.id },
                data: { status: "failed" }
            });
            return NextResponse.json(
                {
                    success: false,
                    pipelineRunId: pipelineRun.id,
                    error: `Workflow '${workflowSlug}' not found. Create the workflow first.`
                },
                { status: 404 }
            );
        }

        const workflowRun = await prisma.workflowRun.create({
            data: {
                workflowId: workflow.id,
                status: "QUEUED",
                inputJson: {
                    sourceType,
                    sourceId,
                    repository,
                    branch: branch || "main",
                    pipelineRunId: pipelineRun.id,
                    organizationId: authResult.organizationId
                },
                source: "coding-pipeline",
                triggerType: "API"
            }
        });

        await prisma.codingPipelineRun.update({
            where: { id: pipelineRun.id },
            data: { workflowRunId: workflowRun.id }
        });

        if (sourceType === "support_ticket") {
            await prisma.supportTicket
                .update({
                    where: { id: sourceId },
                    data: {
                        status: "IN_PROGRESS",
                        pipelineRunId: pipelineRun.id
                    }
                })
                .catch(() => {});
        } else if (sourceType === "backlog_task") {
            await prisma.backlogTask
                .update({
                    where: { id: sourceId },
                    data: {
                        status: "IN_PROGRESS",
                        pipelineRunId: pipelineRun.id
                    }
                })
                .catch(() => {});
        }

        return NextResponse.json({
            success: true,
            pipelineRunId: pipelineRun.id,
            workflowRunId: workflowRun.id,
            workflowSlug,
            message: "Coding pipeline dispatched successfully"
        });
    } catch (error) {
        console.error("[CodingPipeline] Dispatch error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Internal server error"
            },
            { status: 500 }
        );
    }
}
