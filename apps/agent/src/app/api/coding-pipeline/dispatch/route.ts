import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";
import { inngest } from "@/lib/inngest";

/**
 * @deprecated The direct dispatch path (without via=github) is deprecated.
 * Use via=github to create a GitHub Issue that triggers the SDLC workflow
 * through the generic trigger system at /api/webhooks/[path].
 */
export async function POST(request: NextRequest) {
    try {
        const authResult = await authenticateRequest(request);
        if (!authResult) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const {
            sourceType,
            sourceId,
            repository,
            branch,
            variant,
            via,
            title,
            description,
            labels
        } = body;

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

        // GitHub Issue dispatch mode: create a GitHub Issue and let the webhook handle the rest
        if (via === "github") {
            const { ticketToGithubIssueTool } =
                await import("@repo/agentc2/tools/ticket-to-github-issue");

            const issueTitle = title || `[Ticket] ${sourceId}`;
            const issueBody =
                (description || "") +
                `\n\n---\n_Source: ${sourceType} \`${sourceId}\` via AgentC2_`;

            // Parse repository URL to owner/repo format
            let repoPath = repository;
            if (repoPath.startsWith("https://github.com/")) {
                repoPath = repoPath.replace("https://github.com/", "").replace(/\.git$/, "");
            }

            const result = await ticketToGithubIssueTool.execute!(
                {
                    title: issueTitle,
                    description: issueBody,
                    repository: repoPath,
                    labels: labels || ["agentc2-sdlc"],
                    sourceTicketId: sourceId,
                    organizationId: authResult.organizationId
                },
                {} as Parameters<NonNullable<typeof ticketToGithubIssueTool.execute>>[1]
            );

            if ("error" in result) {
                return NextResponse.json(
                    { success: false, error: "Failed to create GitHub issue" },
                    { status: 500 }
                );
            }

            // Determine SDLC workflow variant from labels
            const labelNames = (labels || []) as string[];
            const isBug = labelNames.some((l: string) =>
                ["bug", "bugfix", "fix"].includes(l.toLowerCase())
            );
            const sdlcSlug = isBug ? "sdlc-bugfix" : "sdlc-bugfix"; // TODO: add sdlc-feature routing

            const sdlcWorkflow = await prisma.workflow.findFirst({
                where: { slug: sdlcSlug, isActive: true }
            });

            let workflowRunId: string | null = null;

            if (sdlcWorkflow) {
                const workflowRun = await prisma.workflowRun.create({
                    data: {
                        workflowId: sdlcWorkflow.id,
                        status: "QUEUED",
                        inputJson: {
                            title: issueTitle,
                            description: issueBody,
                            repository: repoPath,
                            existingIssueUrl: result.issueUrl,
                            existingIssueNumber: result.issueNumber,
                            labels: labels || ["agentc2-sdlc"],
                            sourceType,
                            sourceId,
                            organizationId: authResult.organizationId
                        },
                        source: "coding-pipeline",
                        triggerType: "API"
                    }
                });
                workflowRunId = workflowRun.id;

                await inngest.send({
                    name: "workflow/execute.async",
                    data: {
                        workflowRunId: workflowRun.id,
                        workflowId: sdlcWorkflow.id,
                        workflowSlug: sdlcWorkflow.slug,
                        input: {
                            title: issueTitle,
                            description: issueBody,
                            repository: repoPath,
                            existingIssueUrl: result.issueUrl,
                            existingIssueNumber: result.issueNumber,
                            labels: labels || ["agentc2-sdlc"],
                            sourceType,
                            sourceId,
                            organizationId: authResult.organizationId
                        }
                    }
                });
            }

            if (sourceType === "support_ticket") {
                await prisma.supportTicket
                    .update({
                        where: { id: sourceId },
                        data: { status: "IN_PROGRESS" }
                    })
                    .catch(() => {});
            } else if (sourceType === "backlog_task") {
                await prisma.backlogTask
                    .update({
                        where: { id: sourceId },
                        data: { status: "IN_PROGRESS" }
                    })
                    .catch(() => {});
            }

            return NextResponse.json({
                success: true,
                via: "github",
                issueNumber: result.issueNumber,
                issueUrl: result.issueUrl,
                repository: result.repository,
                workflowRunId,
                workflowSlug: sdlcWorkflow?.slug ?? null,
                message: workflowRunId
                    ? "GitHub Issue created and SDLC workflow triggered."
                    : "GitHub Issue created. No active SDLC workflow found to trigger."
            });
        }

        console.warn(
            "[DEPRECATED] /api/coding-pipeline/dispatch called without via=github. " +
                "Use via=github to route through the generic trigger system."
        );

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

        await inngest.send({
            name: "workflow/execute.async",
            data: {
                workflowRunId: workflowRun.id,
                workflowId: workflow.id,
                workflowSlug: workflow.slug,
                input: {
                    sourceType,
                    sourceId,
                    repository,
                    branch: branch || "main",
                    pipelineRunId: pipelineRun.id,
                    organizationId: authResult.organizationId
                },
                pipelineRunId: pipelineRun.id
            }
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
