import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import crypto from "crypto";

const PIPELINE_LABEL = "agentc2-autofix";

function verifyGitHubSignature(body: string, signature: string | null, secret: string): boolean {
    if (!signature) return false;
    const hmac = crypto.createHmac("sha256", secret);
    const digest = `sha256=${hmac.update(body).digest("hex")}`;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();
        const event = request.headers.get("x-github-event");

        const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
        if (webhookSecret) {
            const signature = request.headers.get("x-hub-signature-256");
            if (!verifyGitHubSignature(rawBody, signature, webhookSecret)) {
                return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
            }
        }

        if (event !== "issues") {
            return NextResponse.json({ message: "Event ignored", event });
        }

        const payload = JSON.parse(rawBody);
        const action = payload.action;

        if (action !== "labeled") {
            return NextResponse.json({
                message: "Action ignored",
                action
            });
        }

        const label = payload.label?.name;
        if (label !== PIPELINE_LABEL) {
            return NextResponse.json({
                message: "Label not matching",
                label
            });
        }

        const issue = payload.issue;
        const repo = payload.repository;

        if (!issue || !repo) {
            return NextResponse.json(
                { error: "Missing issue or repository data" },
                { status: 400 }
            );
        }

        const repository = repo.html_url || `https://github.com/${repo.full_name}`;

        const pipelineRun = await prisma.codingPipelineRun.create({
            data: {
                sourceType: "github_issue",
                sourceId: String(issue.number),
                repository,
                baseBranch: repo.default_branch || "main",
                status: "running",
                variant: "standard",
                organizationId: null
            }
        });

        const workflow = await prisma.workflow.findFirst({
            where: { slug: "coding-pipeline", isActive: true }
        });

        if (!workflow) {
            await prisma.codingPipelineRun.update({
                where: { id: pipelineRun.id },
                data: { status: "failed" }
            });
            return NextResponse.json(
                {
                    success: false,
                    error: "coding-pipeline workflow not found"
                },
                { status: 404 }
            );
        }

        const workflowRun = await prisma.workflowRun.create({
            data: {
                workflowId: workflow.id,
                status: "QUEUED",
                inputJson: {
                    sourceType: "github_issue",
                    sourceId: String(issue.number),
                    repository,
                    branch: repo.default_branch || "main",
                    pipelineRunId: pipelineRun.id,
                    issueTitle: issue.title,
                    issueBody: issue.body || "",
                    issueLabels: (issue.labels || []).map((l: { name: string }) => l.name)
                },
                source: "github-webhook",
                triggerType: "WEBHOOK"
            }
        });

        await prisma.codingPipelineRun.update({
            where: { id: pipelineRun.id },
            data: { workflowRunId: workflowRun.id }
        });

        return NextResponse.json({
            success: true,
            pipelineRunId: pipelineRun.id,
            workflowRunId: workflowRun.id,
            issue: {
                number: issue.number,
                title: issue.title
            }
        });
    } catch (error) {
        console.error("[CodingPipeline] GitHub webhook error:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Internal server error"
            },
            { status: 500 }
        );
    }
}
