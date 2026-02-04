import { NextRequest, NextResponse } from "next/server";
import { validateWorkflowDefinition } from "@/lib/workflow-validation";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { definitionJson } = body;

        const validation = validateWorkflowDefinition(definitionJson);

        return NextResponse.json({
            success: true,
            ...validation
        });
    } catch (error) {
        console.error("[Workflow Validate] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to validate workflow" },
            { status: 500 }
        );
    }
}
