import { NextRequest, NextResponse } from "next/server";
import { mastra } from "@repo/mastra/core";
import { getDemoSession } from "@/lib/standalone-auth";

export async function POST(req: NextRequest) {
    try {
        const session = await getDemoSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { workflowType, runId, step, resumeData } = await req.json();

        if (!workflowType || !runId || !step) {
            return NextResponse.json(
                { error: "workflowType, runId, and step are required" },
                { status: 400 }
            );
        }

        const workflow = mastra.getWorkflow(workflowType);
        if (!workflow) {
            return NextResponse.json(
                { error: `Workflow "${workflowType}" not found` },
                { status: 404 }
            );
        }

        const run = await workflow.createRun({ runId });
        const result = await run.resume({
            step,
            resumeData
        });

        return NextResponse.json({
            workflowType,
            runId,
            status: result.status,
            result: result.status === "success" ? result.result : undefined,
            error: result.status === "failed" ? result.error?.message : undefined
        });
    } catch (error) {
        console.error("Workflow resume error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Resume failed" },
            { status: 500 }
        );
    }
}
