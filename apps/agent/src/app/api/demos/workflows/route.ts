import { NextRequest, NextResponse } from "next/server";
import { mastra } from "@repo/mastra";
import { auth } from "@repo/auth";
import { headers } from "next/headers";

export async function POST(req: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { workflowType, input } = await req.json();

        if (!workflowType) {
            return NextResponse.json({ error: "Workflow type is required" }, { status: 400 });
        }

        const workflow = mastra.getWorkflow(workflowType);
        if (!workflow) {
            return NextResponse.json(
                { error: `Workflow "${workflowType}" not found` },
                { status: 404 }
            );
        }

        const run = await workflow.createRun();
        const result = await run.start({ inputData: input });

        return NextResponse.json({
            workflowType,
            runId: run.runId,
            status: result.status,
            result: result.status === "success" ? result.result : undefined,
            error: result.status === "failed" ? result.error?.message : undefined,
            suspended: result.status === "suspended",
            suspendedSteps: result.status === "suspended" ? result.suspended : undefined
        });
    } catch (error) {
        console.error("Workflow error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Workflow failed" },
            { status: 500 }
        );
    }
}
