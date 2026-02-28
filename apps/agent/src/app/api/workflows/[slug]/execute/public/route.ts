import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";
import { executeWorkflowDefinition, type WorkflowDefinition } from "@repo/agentc2/workflows";
import { refreshWorkflowMetrics } from "@/lib/metrics";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, maxPerMinute: number): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
        return { allowed: true, remaining: maxPerMinute - 1 };
    }

    if (entry.count >= maxPerMinute) {
        return { allowed: false, remaining: 0 };
    }

    entry.count++;
    return { allowed: true, remaining: maxPerMinute - entry.count };
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;

        const authHeader = request.headers.get("authorization");
        const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

        if (!token) {
            return NextResponse.json(
                { success: false, error: "Missing authorization token" },
                { status: 401 }
            );
        }

        const workflow = await prisma.workflow.findFirst({
            where: {
                slug,
                visibility: "PUBLIC",
                publicToken: token,
                isActive: true
            }
        });

        if (!workflow) {
            return NextResponse.json(
                { success: false, error: "Invalid token or workflow not public" },
                { status: 403 }
            );
        }

        const metadata = workflow.metadata as Record<string, unknown> | null;
        const embedConfig = metadata?.publicEmbed as Record<string, unknown> | undefined;
        const rateLimit = (embedConfig?.rateLimit as number) || 20;
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        const { allowed, remaining } = checkRateLimit(ip, rateLimit);

        if (!allowed) {
            return NextResponse.json(
                { success: false, error: "Rate limit exceeded" },
                { status: 429, headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" } }
            );
        }

        const body = await request.json();
        const input = body.input ?? body.inputData ?? {};

        const run = await prisma.workflowRun.create({
            data: {
                workflowId: workflow.id,
                status: "RUNNING",
                inputJson: input,
                source: "embed"
            }
        });

        const result = await executeWorkflowDefinition({
            definition: workflow.definitionJson as unknown as WorkflowDefinition,
            input,
            workflowMeta: { runId: run.id, workflowSlug: workflow.slug }
        });

        const durationMs = result.steps.reduce((sum, step) => sum + (step.durationMs || 0), 0);

        if (result.steps.length > 0) {
            await prisma.workflowRunStep.createMany({
                data: result.steps.map((step) => ({
                    runId: run.id,
                    stepId: step.stepId,
                    stepType: step.stepType,
                    stepName: step.stepName,
                    status: step.status === "failed" ? "FAILED" : "COMPLETED",
                    inputJson: step.input as Prisma.InputJsonValue,
                    outputJson: step.output as Prisma.InputJsonValue,
                    errorJson: step.error as Prisma.InputJsonValue,
                    iterationIndex: step.iterationIndex,
                    startedAt: step.startedAt,
                    completedAt: step.completedAt,
                    durationMs: step.durationMs
                }))
            });
        }

        const finalStatus = result.status === "failed" ? "FAILED" : "COMPLETED";
        await prisma.workflowRun.update({
            where: { id: run.id },
            data: {
                status: finalStatus,
                outputJson: result.output as Prisma.InputJsonValue,
                completedAt: new Date(),
                durationMs
            }
        });
        refreshWorkflowMetrics(workflow.id, new Date()).catch(() => {});

        const response = NextResponse.json({
            success: true,
            status: finalStatus === "COMPLETED" ? "success" : "failed",
            runId: run.id,
            output: result.output,
            error: result.error
        });
        response.headers.set("X-RateLimit-Remaining", String(remaining));

        return response;
    } catch (error) {
        console.error("[Workflow Public Execute] Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Execute failed" },
            { status: 500 }
        );
    }
}
