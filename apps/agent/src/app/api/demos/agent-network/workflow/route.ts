import { NextRequest, NextResponse } from "next/server";
import { mastra } from "@repo/mastra";
import { getDemoSession } from "@/lib/standalone-auth";

/**
 * Agent Network Workflow API Route
 *
 * Direct access to trip planner workflows for demos that want to
 * trigger specific workflows without going through the routing agent.
 */
export async function POST(req: NextRequest) {
    try {
        const session = await getDemoSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { workflowType, input } = await req.json();

        if (!workflowType) {
            return NextResponse.json({ error: "Workflow type is required" }, { status: 400 });
        }

        // Map workflow names
        const workflowMap: Record<string, string> = {
            "parallel-research": "trip-parallel-research",
            "itinerary-assembly": "trip-itinerary-assembly",
            "budget-approval": "trip-budget-approval"
        };

        const workflowId = workflowMap[workflowType] || workflowType;
        const workflow = mastra.getWorkflow(workflowId);

        if (!workflow) {
            return NextResponse.json(
                { error: `Workflow "${workflowType}" not found` },
                { status: 404 }
            );
        }

        const startTime = Date.now();
        const run = await workflow.createRun();
        const result = await run.start({ inputData: input });
        const executionTime = Date.now() - startTime;

        // Format suspended steps for the frontend
        let suspended: Array<{ step: string; data: Record<string, unknown> }> | undefined;
        if (result.status === "suspended" && result.suspended) {
            const suspendedSteps = result.suspended as unknown as Array<{
                step: string;
                data?: Record<string, unknown>;
            }>;
            suspended = suspendedSteps.map((s) => ({
                step: s.step,
                data: s.data || {}
            }));
        }

        return NextResponse.json({
            workflowType,
            workflowId,
            runId: run.runId,
            status: result.status,
            result: result.status === "success" ? result.result : undefined,
            error: result.status === "failed" ? result.error?.message : undefined,
            suspended,
            executionTime
        });
    } catch (error) {
        console.error("Workflow error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Workflow failed" },
            { status: 500 }
        );
    }
}

/**
 * Resume a suspended workflow
 */
export async function PUT(req: NextRequest) {
    try {
        const session = await getDemoSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { workflowId, runId, stepId, resumeData } = await req.json();

        if (!workflowId || !runId || !stepId) {
            return NextResponse.json(
                { error: "workflowId, runId, and stepId are required" },
                { status: 400 }
            );
        }

        const workflow = mastra.getWorkflow(workflowId);
        if (!workflow) {
            return NextResponse.json(
                { error: `Workflow "${workflowId}" not found` },
                { status: 404 }
            );
        }

        const run = await workflow.createRun({ runId });
        const result = await run.resume({
            step: stepId,
            resumeData
        });

        return NextResponse.json({
            workflowId,
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
